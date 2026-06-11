import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { findAll, getById } from '../db/store';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate as any, requireAdmin as any);

// ── Strip password fields from a user object ─────────────────────────────────
function safeUser(u: any): any {
  const { password_hash, password, ...rest } = u;
  return rest;
}

// ── GET /stats ────────────────────────────────────────────────────────────────
router.get('/stats', (_req: AuthRequest, res: Response) => {
  const users = findAll('users');
  const applications = findAll('job_applications');
  const resumes = findAll('resume_optimizations');

  // Signups per week — last 8 weeks
  const now = Date.now();
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  const signupsPerWeek: { week: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now - (i + 1) * MS_PER_WEEK);
    const weekEnd = new Date(now - i * MS_PER_WEEK);
    const count = users.filter((u: any) => {
      const t = new Date(u.created_at).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    }).length;
    // Label like "Jun 2"
    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    signupsPerWeek.push({ week: label, count });
  }

  res.json({
    totalUsers: users.length,
    totalApplications: applications.length,
    totalResumesOptimized: resumes.length,
    signupsPerWeek,
  });
});

// ── GET /users ────────────────────────────────────────────────────────────────
router.get('/users', (_req: AuthRequest, res: Response) => {
  const users = findAll('users');
  const applications = findAll('job_applications');
  const resumes = findAll('resume_optimizations');

  const result = users.map((u: any) => {
    const safe = safeUser(u);
    return {
      id: safe.id,
      email: safe.email,
      name: [safe.first_name, safe.last_name].filter(Boolean).join(' ') || safe.email,
      university: safe.university ?? null,
      major: safe.major ?? null,
      createdAt: safe.created_at,
      applicationCount: applications.filter((a: any) => a.user_id === safe.id).length,
      resumeCount: resumes.filter((r: any) => r.user_id === safe.id).length,
    };
  });

  // Most recently signed up first
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(result);
});

// ── GET /users/:id ────────────────────────────────────────────────────────────
router.get('/users/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const user = getById('users', id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const profile = safeUser(user);

  const jobApplications = findAll('job_applications', (a: any) => a.user_id === id);

  const resumeOptimizations = findAll('resume_optimizations', (r: any) => r.user_id === id).map(
    (r: any) => {
      const { password_hash, password, ...rest } = r;
      return rest;
    }
  );

  const referralContacts = findAll('referral_contacts', (c: any) => c.user_id === id);

  const optCompliance = findAll('opt_compliance', (o: any) => o.user_id === id);

  res.json({
    profile,
    jobApplications,
    resumeOptimizations,
    referralContacts,
    optCompliance,
  });
});

export default router;
