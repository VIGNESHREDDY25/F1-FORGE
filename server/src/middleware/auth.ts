import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { findOne } from '../db/store';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as { userId: string; email: string };
    const user = findOne<{ id: string; email: string }>('users', (u) => u.id === payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as any);
}
