import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { generateCheckInQuestions, classifyCheckIn } from '../services/llm';
import { queryKB } from '../services/vectorStore';
import { CultureValue, CultureChampion, RoutingResult } from '../types/index';

const router = Router();

// All check-in routes require authentication
router.use(requireAuth);

// GET /api/checkins/pending
// Returns the oldest pending check-in where due_at <= now(), or { pending: null }
router.get('/pending', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const checkin = db.prepare(`
      SELECT * FROM checkins
      WHERE employee_id = ? AND status = 'pending' AND due_at <= ?
      ORDER BY due_at ASC
      LIMIT 1
    `).get(req.user!.id, now) as any;

    if (!checkin) {
      return res.json({ pending: null });
    }

    return res.json({
      pending: {
        id: checkin.id,
        employeeId: checkin.employee_id,
        status: checkin.status,
        dueAt: checkin.due_at,
        completedAt: checkin.completed_at,
        sentimentScore: checkin.sentiment_score,
        struggleType: checkin.struggle_type,
        questions: JSON.parse(checkin.questions),
        responses: checkin.responses ? JSON.parse(checkin.responses) : null,
        routing: checkin.routing ? JSON.parse(checkin.routing) : null,
      }
    });
  } catch (err) {
    console.error('GET /checkins/pending error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/checkins/generate
// Creates a new pending check-in with LLM-generated questions
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const employeeId = req.user!.id;

    // Fetch culture values for question generation
    const cultureValues = db.prepare('SELECT * FROM culture_values').all() as CultureValue[];

    // Generate questions via LLM
    const questions = await generateCheckInQuestions(cultureValues);

    const id = uuidv4();
    const now = new Date().toISOString();
    // Due immediately (now)
    const dueAt = now;

    db.prepare(`
      INSERT INTO checkins (id, employee_id, status, due_at, questions, created_at)
      VALUES (?, ?, 'pending', ?, ?, ?)
    `).run(id, employeeId, dueAt, JSON.stringify(questions), now);

    saveDb();

    return res.status(201).json({ checkinId: id, questions });
  } catch (err) {
    console.error('POST /checkins/generate error:', err);
    return res.status(503).json({ error: 'Mission Control is temporarily offline. Try again in a moment.' });
  }
});

// POST /api/checkins/:id/submit
// Submits responses, classifies, applies at-risk logic, returns routing
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const employeeId = req.user!.id;
    const checkinId = req.params.id;
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'responses array is required' });
    }

    // Validate check-in belongs to this employee
    const checkin = db.prepare(`
      SELECT * FROM checkins WHERE id = ? AND employee_id = ?
    `).get(checkinId, employeeId) as any;

    if (!checkin) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    if (checkin.status === 'completed') {
      return res.status(400).json({ error: 'Check-in already completed' });
    }

    const questions: string[] = JSON.parse(checkin.questions);
    const cultureValues = db.prepare('SELECT * FROM culture_values').all() as CultureValue[];

    // Classify via LLM
    const classification = await classifyCheckIn(questions, responses, cultureValues);

    // Build routing result
    const routing = await buildRoutingResult(classification, cultureValues, db);

    const now = new Date().toISOString();

    // Persist classification results
    db.prepare(`
      UPDATE checkins
      SET status = 'completed',
          completed_at = ?,
          sentiment_score = ?,
          struggle_type = ?,
          responses = ?,
          routing = ?
      WHERE id = ?
    `).run(
      now,
      classification.sentimentScore,
      classification.struggleType,
      JSON.stringify(responses),
      JSON.stringify(routing),
      checkinId
    );

    // Apply at-risk logic
    await applyAtRiskLogic(db, employeeId, classification.sentimentScore);

    saveDb();

    return res.json({
      sentimentScore: classification.sentimentScore,
      struggleType: classification.struggleType,
      summary: classification.summary,
      routing,
    });
  } catch (err) {
    console.error('POST /checkins/:id/submit error:', err);
    return res.status(503).json({ error: 'Mission Control is temporarily offline. Try again in a moment.' });
  }
});

// GET /api/checkins/peer-reviews/pending — get pending peer reviews for this reviewer
router.get('/peer-reviews/pending', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const reviewerId = req.user!.id;

    const rows = db.prepare(`
      SELECT pr.*, su.name as subject_name
      FROM peer_reviews pr
      JOIN users su ON pr.subject_id = su.id
      WHERE pr.reviewer_id = ? AND pr.status = 'pending_reviewer'
      ORDER BY pr.created_at DESC
    `).all(reviewerId) as any[];

    const peerReviews = rows.map(row => ({
      id: row.id,
      reviewerId: row.reviewer_id,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      status: row.status,
      questions: JSON.parse(row.questions || '[]'),
      responses: row.responses ? JSON.parse(row.responses) : null,
      managerNotes: row.manager_notes || null,
      createdAt: row.created_at,
    }));

    return res.json({ peerReviews });
  } catch (err) {
    console.error('GET /checkins/peer-reviews/pending error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/checkins/peer-reviews/:id/submit — reviewer submits responses
router.post('/peer-reviews/:id/submit', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const reviewerId = req.user!.id;
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'responses array is required' });
    }

    const review = db.prepare(`
      SELECT * FROM peer_reviews WHERE id = ? AND reviewer_id = ?
    `).get(req.params.id, reviewerId) as any;

    if (!review) {
      return res.status(404).json({ error: 'Peer review not found' });
    }
    if (review.status !== 'pending_reviewer') {
      return res.status(400).json({ error: 'Peer review is not pending your response' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE peer_reviews
      SET status = 'pending_manager', responses = ?, completed_at = ?
      WHERE id = ?
    `).run(JSON.stringify(responses), now, req.params.id);

    saveDb();

    const updated = db.prepare('SELECT * FROM peer_reviews WHERE id = ?').get(req.params.id) as any;
    return res.json({
      peerReview: {
        id: updated.id,
        reviewerId: updated.reviewer_id,
        subjectId: updated.subject_id,
        status: updated.status,
        questions: JSON.parse(updated.questions || '[]'),
        responses: updated.responses ? JSON.parse(updated.responses) : null,
        managerNotes: updated.manager_notes || null,
        createdAt: updated.created_at,
        completedAt: updated.completed_at || null,
      }
    });
  } catch (err) {
    console.error('POST /checkins/peer-reviews/:id/submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/checkins/peer-reviews/received — blocked: peer review feedback is manager-only
router.get('/peer-reviews/received', (req: Request, res: Response) => {
  return res.status(403).json({ error: 'Peer review feedback is not available to subjects' });
});


router.get('/history', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM checkins
      WHERE employee_id = ? AND status = 'completed'
      ORDER BY completed_at DESC
    `).all(req.user!.id) as any[];

    const checkins = rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id,
      status: row.status,
      dueAt: row.due_at,
      completedAt: row.completed_at,
      sentimentScore: row.sentiment_score,
      struggleType: row.struggle_type,
      questions: JSON.parse(row.questions),
      responses: row.responses ? JSON.parse(row.responses) : null,
      routing: row.routing ? JSON.parse(row.routing) : null,
    }));

    return res.json({ checkins });
  } catch (err) {
    console.error('GET /checkins/history error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/checkins/:id/notes
// Adds a note to a check-in
router.post('/:id/notes', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const employeeId = req.user!.id;
    const checkinId = req.params.id;
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    // Validate check-in belongs to this employee
    const checkin = db.prepare('SELECT id FROM checkins WHERE id = ? AND employee_id = ?').get(checkinId, employeeId);
    if (!checkin) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO checkin_notes (id, checkin_id, employee_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, checkinId, employeeId, content, now);

    saveDb();

    return res.status(201).json({ id, checkinId, employeeId, content, createdAt: now });
  } catch (err) {
    console.error('POST /checkins/:id/notes error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Helpers ---

async function buildRoutingResult(
  classification: { sentimentScore: number; struggleType: string; implicatedValues: string[]; summary: string },
  cultureValues: CultureValue[],
  db: ReturnType<typeof getDb>
): Promise<RoutingResult> {
  const { struggleType, implicatedValues, summary } = classification;
  const routing: RoutingResult = {
    struggleType: struggleType as any,
    message: summary,
  };

  if (struggleType === 'HUMAN' || struggleType === 'BOTH') {
    // Find culture champions for implicated values
    const champions: CultureChampion[] = [];
    for (const valueName of implicatedValues) {
      const rows = db.prepare(`
        SELECT cc.id, cc.user_id, cc.bio, u.name, u.email, cv.id as culture_value_id, cv.name as culture_value_name
        FROM culture_champions cc
        JOIN users u ON cc.user_id = u.id
        JOIN culture_values cv ON cc.culture_value_id = cv.id
        WHERE cv.name = ?
      `).all(valueName) as any[];

      for (const row of rows) {
        champions.push({
          userId: row.user_id,
          name: row.name,
          email: row.email,
          cultureValueId: row.culture_value_id,
          cultureValueName: row.culture_value_name,
          bio: row.bio || '',
        });
      }
    }
    routing.cultureChampions = champions;
  }

  if (struggleType === 'TECHNICAL' || struggleType === 'BOTH') {
    try {
      const result = await queryKB(summary);
      // Convert StructuredAnswer to KBAnswer[] for routing
      routing.kbAnswers = result ? [{ answer: result.answer, citation: result.documents.map(d => `${d.title} > ${d.section}`).join(', ') || '', confidence: 1 }] : [];
    } catch (err) {
      console.error('KB query error during routing:', err);
      routing.kbAnswers = [];
    }
    routing.githubContacts = [];
  }

  return routing;
}

async function applyAtRiskLogic(
  db: ReturnType<typeof getDb>,
  employeeId: string,
  newScore: number
): Promise<void> {
  // Get last 2 completed check-ins for this employee (including the one just submitted)
  const recent = db.prepare(`
    SELECT sentiment_score FROM checkins
    WHERE employee_id = ? AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 2
  `).all(employeeId) as any[];

  const scores = recent.map((r: any) => r.sentiment_score as number);

  if (newScore < 3) {
    // Flag as at-risk, set 7-day interval
    db.prepare(`
      UPDATE users SET is_at_risk = 1, checkin_interval_days = 7 WHERE id = ?
    `).run(employeeId);
  } else if (scores.length >= 2 && scores[0] >= 3 && scores[1] >= 3) {
    // Two consecutive >= 3: clear at-risk flag, revert to 14-day interval
    db.prepare(`
      UPDATE users SET is_at_risk = 0, checkin_interval_days = 14 WHERE id = ?
    `).run(employeeId);
  }

  // If last 2 scores both < 2: insert manager notification
  if (scores.length >= 2 && scores[0] < 2 && scores[1] < 2) {
    const employee = db.prepare('SELECT manager_id, name FROM users WHERE id = ?').get(employeeId) as any;
    if (employee?.manager_id) {
      const notifId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO manager_notifications (id, manager_id, employee_id, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        notifId,
        employee.manager_id,
        employeeId,
        `${employee.name} has had two consecutive check-in scores below 2. Immediate attention may be needed.`,
        now
      );
    }
  }
}

export default router;
