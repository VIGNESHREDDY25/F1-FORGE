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

// ── Today's Plan: a prioritized daily action list built from data the app
// already has — follow-ups due, pending outreach, stale applications, prep ──
router.get('/today-plan', (req: AuthRequest, res: Response) => {
  const uid = req.user!.id;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in3days = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const jobs = findAll<any>('job_applications', j => j.user_id === uid);
  const contacts = findAll<any>('referral_contacts', c => c.user_id === uid);
  const sessions = findAll<any>('interview_sessions', s => s.user_id === uid && s.completed);
  const user = findOne<any>('users', (u: any) => u.id === uid);

  const items: { id: string; emoji: string; title: string; detail: string; link: string; priority: number }[] = [];

  // 1. Overdue / due-soon follow-ups (highest priority — these convert)
  const followUps = jobs.filter(j => j.follow_up_date && j.follow_up_date <= in3days && !['offer', 'rejected'].includes(j.stage));
  if (followUps.length) {
    const overdue = followUps.filter(j => j.follow_up_date < today).length;
    items.push({
      id: 'followups', emoji: '⏰',
      title: `Send ${followUps.length} follow-up${followUps.length > 1 ? 's' : ''}`,
      detail: overdue
        ? `${overdue} overdue — ${followUps.slice(0, 3).map(j => j.company).join(', ')}`
        : `Due soon: ${followUps.slice(0, 3).map(j => j.company).join(', ')}`,
      link: '/jobs', priority: 1,
    });
  }

  // 2. Pending outreach saved but never sent
  const pendingOutreach = contacts.filter(c => c.status === 'not_contacted');
  if (pendingOutreach.length) {
    items.push({
      id: 'outreach', emoji: '📨',
      title: `Send ${pendingOutreach.length} saved outreach message${pendingOutreach.length > 1 ? 's' : ''}`,
      detail: `Waiting on: ${pendingOutreach.slice(0, 3).map(c => `${c.contact_name || 'contact'} @ ${c.target_company}`).join(', ')}`,
      link: '/referrals', priority: 2,
    });
  }

  // 3. Stale applications — applied 7+ days ago, no follow-up scheduled
  const stale = jobs.filter(j => j.stage === 'applied' && !j.follow_up_date && new Date(j.created_at) < weekAgo);
  if (stale.length) {
    items.push({
      id: 'stale', emoji: '🪦',
      title: `${stale.length} application${stale.length > 1 ? 's' : ''} going stale`,
      detail: `No follow-up scheduled for ${stale.slice(0, 3).map(j => j.company).join(', ')} — schedule one or nudge the recruiter`,
      link: '/jobs', priority: 3,
    });
  }

  // 4. Fresh jobs nudge — always actionable
  const targetRole = user?.target_roles?.[0] || 'Software Engineer';
  items.push({
    id: 'fresh-jobs', emoji: '🔥',
    title: `Apply to 3 fresh ${targetRole} roles`,
    detail: 'Jobs posted in the last 24h get 3-4x more recruiter views on your application',
    link: `/job-discovery?q=${encodeURIComponent(targetRole)}`, priority: 4,
  });

  // 5. Interview prep nudge if nothing this week
  const practicedThisWeek = sessions.some(s => new Date(s.created_at) >= weekAgo);
  if (!practicedThisWeek) {
    items.push({
      id: 'mock-interview', emoji: '🎤',
      title: 'Run one mock interview',
      detail: sessions.length
        ? 'None this week — 15 minutes keeps you sharp'
        : 'Try your first AI-scored session — 5 questions, instant feedback',
      link: '/interviews', priority: 5,
    });
  }

  // 6. Profile gaps that weaken every other feature
  if (!user?.resume_text) {
    items.push({
      id: 'resume', emoji: '📄',
      title: 'Upload your resume once',
      detail: 'Unlocks ATS scoring and resume-grounded outreach messages',
      link: '/resume', priority: 6,
    });
  } else if (!user?.linkedin_text) {
    items.push({
      id: 'linkedin', emoji: '💼',
      title: 'Import your LinkedIn profile',
      detail: 'One paste — makes every outreach message more personal',
      link: '/profile', priority: 6,
    });
  }

  items.sort((a, b) => a.priority - b.priority);
  res.json({ date: today, items: items.slice(0, 5) });
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

router.get('/analytics', (req: AuthRequest, res: Response) => {
  const uid = req.user!.id;
  const jobs = findAll<any>('job_applications', j => j.user_id === uid);
  const now = new Date();

  // ── Funnel counts by stage ────────────────────────────────────────────────
  const STAGES = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected'] as const;
  const stageCounts: Record<string, number> = {};
  for (const s of STAGES) stageCounts[s] = 0;
  for (const j of jobs) {
    if (stageCounts[j.stage] !== undefined) stageCounts[j.stage]++;
  }

  const funnel = STAGES.map(stage => ({ stage, count: stageCounts[stage] }));

  // ── Conversion / response rates ───────────────────────────────────────────
  const totalApplied = stageCounts['applied'] + stageCounts['assessment'] +
    stageCounts['interview'] + stageCounts['offer'] + stageCounts['rejected'];
  const interviewCount = stageCounts['interview'] + stageCounts['offer'];
  const offerCount = stageCounts['offer'];

  const interviewRate = totalApplied > 0
    ? Math.round((interviewCount / totalApplied) * 100)
    : 0;
  const offerRate = totalApplied > 0
    ? Math.round((offerCount / totalApplied) * 100)
    : 0;
  // response rate = any active/positive signal past applied
  const responseRate = totalApplied > 0
    ? Math.round(((stageCounts['assessment'] + stageCounts['interview'] + stageCounts['offer']) / totalApplied) * 100)
    : 0;

  // ── Applications per week (last 8 weeks) ──────────────────────────────────
  const weeklyActivity: { week: string; label: string; count: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const count = jobs.filter(j => {
      const d = new Date(j.created_at);
      return d >= weekStart && d <= weekEnd;
    }).length;

    const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    weeklyActivity.push({ week: weekStart.toISOString().slice(0, 10), label, count });
  }

  // ── Top companies applied to ───────────────────────────────────────────────
  const companyCounts: Record<string, number> = {};
  for (const j of jobs) {
    const name = j.company || 'Unknown';
    companyCounts[name] = (companyCounts[name] || 0) + 1;
  }
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([company, count]) => ({ company, count }));

  // ── Status distribution (for pie / donut) ─────────────────────────────────
  const statusDistribution = funnel
    .filter(f => f.count > 0)
    .map(f => ({ stage: f.stage, count: f.count }));

  res.json({
    total: jobs.length,
    totalApplied,
    funnel,
    interviewRate,
    offerRate,
    responseRate,
    weeklyActivity,
    topCompanies,
    statusDistribution,
  });
});

export default router;
