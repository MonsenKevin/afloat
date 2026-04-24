import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { queryKB } from '../services/vectorStore';

const router = Router();

router.use(requireAuth);

// POST /api/kb/ask
// Queries the knowledge base and returns answers with citations
router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required' });
    }

    const answers = await queryKB(question);

    if (!answers.length) {
      return res.json({
        answers: [],
        message: 'No relevant documents found. Consider asking a teammate.'
      });
    }

    return res.json({ answers });
  } catch (err) {
    console.error('POST /kb/ask error:', err);
    return res.status(503).json({ error: 'Mission Control is temporarily offline. Try again in a moment.' });
  }
});

export default router;
