import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

const DEFAULT_ADMINS = ['moluguvigneshreddy2@gmail.com', 'vignesh@gmu.edu'];

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw || !raw.trim()) return DEFAULT_ADMINS;
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const userEmail = req.user?.email?.toLowerCase() ?? '';
  const admins = getAdminEmails();
  if (!admins.includes(userEmail)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
