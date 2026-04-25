import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { queryKB } from '../services/vectorStore';
import { getDb } from '../db/index';

const router = Router();
router.use(requireAuth);

function formatCheckins(checkins: any[], employeeName?: string): string {
  return checkins.map(c => {
    const qs: string[] = JSON.parse(c.questions || '[]');
    const rs: string[] = JSON.parse(c.responses || '[]');
    const date = new Date(c.completed_at).toLocaleDateString();
    const pairs = qs.map((q: string, i: number) => {
      if (q.startsWith('slider:')) return `${q.slice(7)}: ${rs[i]}/5`;
      if (q.startsWith('text:')) return `${q.slice(5)}: ${rs[i]}`;
      return `${q}: ${rs[i]}`;
    }).join('; ');
    const prefix = employeeName ? `${employeeName} — ` : '';
    return `${prefix}Check-in on ${date} (score: ${c.sentiment_score?.toFixed(1) ?? 'N/A'}, struggle: ${c.struggle_type ?? 'none'}): ${pairs}`;
  }).join('\n\n');
}

router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { question, history } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required' });
    }

    const db = getDb();
    const user = req.user!;
    const isManager = user.role === 'Manager';
    let checkinContext: string | null = null;

    if (isManager) {
      const reports = db.prepare(`
        SELECT id, name, email, is_at_risk FROM users WHERE manager_id = ?
      `).all(user.id) as any[];

      if (reports.length > 0) {
        const sections: string[] = [];
        const atRiskCount = reports.filter((r: any) => r.is_at_risk).length;
        sections.push(`TEAM SUMMARY: ${reports.length} direct reports, ${atRiskCount} flagged at-risk.`);
        sections.push(`Team members: ${reports.map((r: any) => `${r.name} (${r.email}${r.is_at_risk ? ', AT RISK' : ''})`).join(', ')}`);

        for (const report of reports) {
          const checkins = db.prepare(`
            SELECT completed_at, sentiment_score, struggle_type, responses, questions
            FROM checkins WHERE employee_id = ? AND status = 'completed'
            ORDER BY completed_at DESC LIMIT 3
          `).all(report.id) as any[];

          if (checkins.length > 0) {
            sections.push(`\n--- ${report.name}'s recent check-ins ---`);
            sections.push(formatCheckins(checkins, report.name));
          } else {
            sections.push(`\n--- ${report.name}: no completed check-ins yet ---`);
          }
        }
        checkinContext = sections.join('\n');
      }
    } else {
      const recentCheckins = db.prepare(`
        SELECT completed_at, sentiment_score, struggle_type, responses, questions
        FROM checkins WHERE employee_id = ? AND status = 'completed'
        ORDER BY completed_at DESC LIMIT 3
      `).all(user.id) as any[];

      if (recentCheckins.length > 0) {
        checkinContext = formatCheckins(recentCheckins);
      }
    }

    const result = await queryKB(question, checkinContext, history, isManager);

    if (!result || !result.answer) {
      return res.json({
        answer: null,
        contacts: [],
        documents: [],
        message: 'No relevant information found. Try asking about a specific team member or topic.'
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('POST /kb/ask error:', err);
    return res.status(503).json({ error: 'Mission Control is temporarily offline. Try again in a moment.' });
  }
});

export default router;
