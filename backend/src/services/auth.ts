import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Role } from '../types/index';

const JWT_SECRET = process.env.JWT_SECRET || 'afloat-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface TokenPayload {
  id: string;
  role: Role;
  managerId: string | null;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
