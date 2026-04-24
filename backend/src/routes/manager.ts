import { Router, Request, Response } from 'express';
import { getDb } from '../db/index';
import { requireAuth, requireManager } from '../middleware/auth';
import { SentimentTrend } from '../types/index';

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

    // For each employee, get their latest completed check-in score
    const reports = employees.map(emp => {
      const latest = db.prepare(`
        SELECT sentiment_score, completed_at
        FROM checkins
        WHERE employee_id = ? AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 1
      `).get(emp.id) as any;

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

export default router;
