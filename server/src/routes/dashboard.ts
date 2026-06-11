import { Router, Response } from 'express';
import { findAll, findOne } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const uid = req.user!.id;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const today = now.toISOString().slice(0, 10);

  const jobs = findAll<any>('job_applications', j => j.user_id === uid);
  const compliance = findOne<any>('opt_compliance', c => c.user_id === uid);
  const latestResume = findAll<any>('resume_optimizations', o => o.user_id === uid)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const networking = findAll<any>('networking_messages', m => m.user_id === uid);
  const interviewSessions = findAll<any>('interview_sessions', s => s.user_id === uid && s.completed);
  const notifications = findAll<any>('notifications', n => n.user_id === uid && !n.read)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);
  const user = findOne<any>('users', u => u.id === uid);

  const thisWeek = jobs.filter(j => new Date(j.created_at) >= weekAgo).length;
  const lastWeek = jobs.filter(j => new Date(j.created_at) >= twoWeeksAgo && new Date(j.created_at) < weekAgo).length;

  const optDaysRemaining = compliance ? 90 - (compliance.unemployment_days_used || 0) : null;
  const interviewScores = interviewSessions.map(s => s.overall_score).filter(Boolean);

  res.json({
    user: { firstName: user?.first_name, profileCompletePct: user?.profile_complete_pct ?? 0, visaType: user?.visa_type },
    applications: {
      thisWeek,
      lastWeek,
      inInterview: jobs.filter(j => j.stage === 'interview').length,
      offers: jobs.filter(j => j.stage === 'offer').length,
      followUpsToday: jobs.filter(j => j.follow_up_date === today).length,
    },
    optDaysRemaining,
    compliance,
    latestResumeScore: latestResume?.ats_score ?? null,
    networking: {
      total: networking.length,
      pending: networking.filter(m => m.outcome === 'pending').length,
    },
    interviews: {
      totalSessions: interviewSessions.length,
      bestScore: interviewScores.length ? Math.max(...interviewScores) : 0,
      thisWeek: interviewSessions.filter(s => new Date(s.created_at) >= weekAgo).length,
    },
    notifications,
  });
});

router.get('/notifications', (req: AuthRequest, res: Response) => {
  const notifications = findAll<any>('notifications', n => n.user_id === req.user!.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);
  res.json(notifications);
});

router.patch('/notifications/:id/read', (req: AuthRequest, res: Response) => {
  const n = findOne<any>('notifications', n => n.id === req.params.id && n.user_id === req.user!.id);
  if (n) { const { update } = require('../db/store'); update('notifications', req.params.id, { read: true }); }
  res.status(204).send();
});

router.patch('/notifications/read-all', (req: AuthRequest, res: Response) => {
  const { update } = require('../db/store');
  findAll<any>('notifications', n => n.user_id === req.user!.id && !n.read)
    .forEach(n => update('notifications', n.id, { read: true }));
  res.status(204).send();
});

export default router;
