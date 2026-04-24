import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getBlameContacts } from '../services/github';

const router = Router();

router.use(requireAuth);

// POST /api/github/blame
// Returns contributors for a given repo and file path
router.post('/blame', async (req: Request, res: Response) => {
  try {
    const { repo, filePath } = req.body;
    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({ error: 'repo is required' });
    }
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const contacts = await getBlameContacts(repo, filePath);
    return res.json({ contacts });
  } catch (err: any) {
    console.error('POST /github/blame error:', err);
    const message = err.message || 'Failed to fetch GitHub blame data.';
    if (message.includes('not found') || message.includes('rate limit') || message.includes('access denied')) {
      return res.status(422).json({ error: message });
    }
    return res.status(503).json({ error: 'Mission Control is temporarily offline. Try again in a moment.' });
  }
});

export default router;
