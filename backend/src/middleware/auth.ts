import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth';
import { getDb } from '../db';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    const db = getDb();
    const userRow = db.prepare('SELECT org_id FROM users WHERE id = ?').get(payload.id) as { org_id: string } | undefined;
    req.user = {
      id: payload.id,
      role: payload.role,
      managerId: payload.managerId,
      orgId: userRow?.org_id ?? 'default',
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

export function requireManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role !== 'Manager') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  return next();
}
