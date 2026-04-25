import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index';
import { requireAuth, requireManager } from '../middleware/auth';
import { SentimentTrend } from '../types/index';

const PEER_REVIEW_QUESTIONS = JSON.stringify([
  'slider:Customer Obsession',
  'slider:Bias for Action',
  'slider:Earn Trust',
  'text:What are this person\'s greatest technical strengths and contributions?',
  'text:How well does this person collaborate with and support the team?',
]);

const router = Router();

// All manager routes require auth + manager role
router.use(requireAuth, requireManager);

// GET /api/manager/reports
// Returns direct reports with latest sentimentScore and atRisk flag
router.get('/reports', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const managerId = req.user!.id;

    // Get all direct reports
    const employees = db.prepare(`
      SELECT id, email, name, role, manager_id, start_date, is_at_risk, checkin_interval_days
      FROM users
      WHERE manager_id = ?
    `).all(managerId) as any[];

    // For each employee, get their latest completed check-in score and peer score
    const reports = employees.map(emp => {
      const latest = db.prepare(`
        SELECT sentiment_score, completed_at
        FROM checkins
        WHERE employee_id = ? AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 1
      `).get(emp.id) as any;

      // Compute peer score: mean of all slider responses from approved peer reviews
      const approvedReviews = db.prepare(`
        SELECT questions, responses
        FROM peer_reviews
        WHERE subject_id = ? AND manager_id = ? AND status = 'approved'
          AND responses IS NOT NULL
      `).all(emp.id, managerId) as any[];

      let peerScore: number | null = null;
      const sliderValues: number[] = [];
      for (const review of approvedReviews) {
        const questions: string[] = JSON.parse(review.questions || '[]');
        const responses: string[] = JSON.parse(review.responses || '[]');
        questions.forEach((q: string, i: number) => {
          if (q.startsWith('slider:') && responses[i] !== undefined) {
            const val = parseFloat(responses[i]);
            if (!isNaN(val)) sliderValues.push(val);
          }
        });
      }
      if (sliderValues.length > 0) {
        const mean = sliderValues.reduce((a, b) => a + b, 0) / sliderValues.length;
        peerScore = Math.round(mean * 10) / 10;
      }

      return {
        id: emp.id,
        email: emp.email,
        name: emp.name,
        role: emp.role,
        managerId: emp.manager_id,
        startDate: emp.start_date,
        atRisk: Boolean(emp.is_at_risk),
        checkinIntervalDays: emp.checkin_interval_days,
        latestSentimentScore: latest?.sentiment_score ?? null,
        latestCheckinDate: latest?.completed_at ?? null,
        peerScore,
      };
    });

    return res.json({ reports });
  } catch (err) {
    console.error('GET /manager/reports error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/manager/reports/:id/trend
// Returns SentimentTrend[] for a direct report (403 if not their report)
router.get('/reports/:id/trend', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const managerId = req.user!.id;
    const employeeId = req.params.id;

    // Verify the employee is a direct report of this manager
    const employee = db.prepare(`
      SELECT id FROM users WHERE id = ? AND manager_id = ?
    `).get(employeeId, managerId) as any;

    if (!employee) {
      return res.status(403).json({ error: 'Access denied: employee is not your direct report' });
    }

    // Return sentiment trend (no raw responses)
    const rows = db.prepare(`
      SELECT id, completed_at, sentiment_score
      FROM checkins
      WHERE employee_id = ? AND status = 'completed' AND sentiment_score IS NOT NULL
      ORDER BY completed_at ASC
    `).all(employeeId) as any[];

    const trend: SentimentTrend[] = rows.map(row => ({
      checkinId: row.id,
      date: row.completed_at,
      score: row.sentiment_score,
    }));

    return res.json({ trend });
  } catch (err) {
    console.error('GET /manager/reports/:id/trend error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/manager/reports/:id/checkins
// Returns full check-in history for a direct report
router.get('/reports/:id/checkins', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const managerId = req.user!.id;
    const employeeId = req.params.id;

    const employee = db.prepare(`SELECT id FROM users WHERE id = ? AND manager_id = ?`).get(employeeId, managerId) as any;
    if (!employee) {
      return res.status(403).json({ error: 'Access denied: employee is not your direct report' });
    }

    const rows = db.prepare(`
      SELECT id, completed_at, sentiment_score, struggle_type, questions, responses
      FROM checkins
      WHERE employee_id = ? AND status = 'completed'
      ORDER BY completed_at DESC
    `).all(employeeId) as any[];

    const checkins = rows.map(row => ({
      id: row.id,
      completedAt: row.completed_at,
      sentimentScore: row.sentiment_score,
      struggleType: row.struggle_type,
      questions: JSON.parse(row.questions || '[]'),
      responses: JSON.parse(row.responses || '[]'),
    }));

    return res.json({ checkins });
  } catch (err) {
    console.error('GET /manager/reports/:id/checkins error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/manager/peer-reviews — assign a peer review
router.post('/peer-reviews', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const managerId = req.user!.id;
    const { reviewerId, subjectId } = req.body;

    if (!reviewerId || !subjectId) {
      return res.status(400).json({ error: 'reviewerId and subjectId are required' });
    }
    if (reviewerId === subjectId) {
      return res.status(400).json({ error: 'Reviewer and subject must be different people' });
    }

    // Validate both are direct reports of this manager
    const reviewer = db.prepare('SELECT id FROM users WHERE id = ? AND manager_id = ?').get(reviewerId, managerId) as any;
    if (!reviewer) {
      return res.status(403).json({ error: 'Reviewer is not your direct report' });
    }
    const subject = db.prepare('SELECT id FROM users WHERE id = ? AND manager_id = ?').get(subjectId, managerId) as any;
    if (!subject) {
      return res.status(403).json({ error: 'Subject is not your direct report' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO peer_reviews (id, manager_id, reviewer_id, subject_id, status, questions, created_at)
      VALUES (?, ?, ?, ?, 'pending_reviewer', ?, ?)
    `).run(id, managerId, reviewerId, subjectId, PEER_REVIEW_QUESTIONS, now);

    saveDb();

    const created = db.prepare('SELECT * FROM peer_reviews WHERE id = ?').get(id) as any;
    return res.status(201).json({ peerReview: formatPeerReview(created) });
  } catch (err) {
    console.error('POST /manager/peer-reviews error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/manager/peer-reviews — list all peer reviews for this manager
router.get('/peer-reviews', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const managerId = req.user!.id;

    const rows = db.prepare(`
      SELECT pr.*,
        ru.name as reviewer_name, ru.email as reviewer_email,
        su.name as subject_name, su.email as subject_email
      FROM peer_reviews pr
      JOIN users ru ON pr.reviewer_id = ru.id
      JOIN users su ON pr.subject_id = su.id
      WHERE pr.manager_id = ?
      ORDER BY pr.created_at DESC
    `).all(managerId) as any[];

    const peerReviews = rows.map(row => ({
      ...formatPeerReview(row),
      reviewerName: row.reviewer_name,
      reviewerEmail: row.reviewer_email,
      subjectName: row.subject_name,
      subjectEmail: row.subject_email,
    }));

    return res.json({ peerReviews });
  } catch (err) {
    console.error('GET /manager/peer-reviews error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/manager/peer-reviews/:id — get a specific peer review
router.get('/peer-reviews/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const managerId = req.user!.id;

    const row = db.prepare(`
      SELECT pr.*,
        ru.name as reviewer_name, ru.email as reviewer_email,
        su.name as subject_name, su.email as subject_email
      FROM peer_reviews pr
      JOIN users ru ON pr.reviewer_id = ru.id
      JOIN users su ON pr.subject_id = su.id
      WHERE pr.id = ? AND pr.manager_id = ?
    `).get(req.params.id, managerId) as any;

    if (!row) {
      return res.status(404).json({ error: 'Peer review not found' });
    }

    return res.json({
      peerReview: {
        ...formatPeerReview(row),
        reviewerName: row.reviewer_name,
        reviewerEmail: row.reviewer_email,
        subjectName: row.subject_name,
        subjectEmail: row.subject_email,
      }
    });
  } catch (err) {
    console.error('GET /manager/peer-reviews/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/manager/peer-reviews/:id/approve — approve and deliver
router.post('/peer-reviews/:id/approve', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const managerId = req.user!.id;
    const { managerNotes } = req.body;

    const review = db.prepare('SELECT * FROM peer_reviews WHERE id = ? AND manager_id = ?').get(req.params.id, managerId) as any;
    if (!review) {
      return res.status(404).json({ error: 'Peer review not found' });
    }
    if (review.status !== 'pending_manager') {
      return res.status(400).json({ error: 'Peer review is not pending manager approval' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE peer_reviews
      SET status = 'approved', approved_at = ?, manager_notes = ?
      WHERE id = ?
    `).run(now, managerNotes || null, req.params.id);

    saveDb();

    const updated = db.prepare('SELECT * FROM peer_reviews WHERE id = ?').get(req.params.id) as any;
    return res.json({ peerReview: formatPeerReview(updated) });
  } catch (err) {
    console.error('POST /manager/peer-reviews/:id/approve error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/manager/peer-reviews/:id/reject — send back to reviewer
router.post('/peer-reviews/:id/reject', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const managerId = req.user!.id;
    const { feedback } = req.body;

    if (!feedback || typeof feedback !== 'string') {
      return res.status(400).json({ error: 'feedback is required' });
    }

    const review = db.prepare('SELECT * FROM peer_reviews WHERE id = ? AND manager_id = ?').get(req.params.id, managerId) as any;
    if (!review) {
      return res.status(404).json({ error: 'Peer review not found' });
    }

    db.prepare(`
      UPDATE peer_reviews
      SET status = 'pending_reviewer', manager_notes = ?
      WHERE id = ?
    `).run(feedback, req.params.id);

    saveDb();

    const updated = db.prepare('SELECT * FROM peer_reviews WHERE id = ?').get(req.params.id) as any;
    return res.json({ peerReview: formatPeerReview(updated) });
  } catch (err) {
    console.error('POST /manager/peer-reviews/:id/reject error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Helpers ---

function formatPeerReview(row: any) {
  return {
    id: row.id,
    managerId: row.manager_id,
    reviewerId: row.reviewer_id,
    subjectId: row.subject_id,
    status: row.status,
    questions: JSON.parse(row.questions || '[]'),
    responses: row.responses ? JSON.parse(row.responses) : null,
    managerNotes: row.manager_notes || null,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    approvedAt: row.approved_at || null,
  };
}

export default router;

