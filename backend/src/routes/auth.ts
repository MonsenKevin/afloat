import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index';
import { signToken } from '../services/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, name, password, role, managerId, startDate } = req.body;
    if (!email || !name || !password || !role) {
      return res.status(400).json({ error: 'email, name, password, and role are required' });
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO users (id, email, name, password_hash, role, manager_id, start_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, email, name, passwordHash, role, managerId || null,
      startDate || now.split('T')[0], now
    );
    saveDb();
    const user = db.prepare('SELECT id, email, name, role, manager_id as managerId, start_date as startDate, is_at_risk as isAtRisk FROM users WHERE id = ?').get(id) as any;
    const token = signToken({ id: user.id, role: user.role, managerId: user.managerId });
    return res.status(201).json({ token, user: { ...user, isAtRisk: Boolean(user.isAtRisk) } });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ id: user.id, role: user.role, managerId: user.manager_id });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        managerId: user.manager_id,
        startDate: user.start_date,
        isAtRisk: Boolean(user.is_at_risk),
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
