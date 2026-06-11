import { Router, Response } from 'express';
import { z } from 'zod';
import { findAll, findOne, insert, update, remove } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { aiClient, hasAI, AI_MODEL } from '../services/aiClient';

const router = Router();
router.use(authenticate);

const createJobSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  jdUrl: z.string().url().optional().or(z.literal('')),
  stage: z.enum(['saved','applied','assessment','interview','offer','rejected']).default('saved'),
  recruiterName: z.string().optional(),
  recruiterLinkedin: z.string().optional(),
  salaryMin: z.number().int().optional(),
  salaryMax: z.number().int().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
  appliedDate: z.string().optional(),
});

router.get('/', (req: AuthRequest, res: Response) => {
  const jobs = findAll<any>('job_applications', j => j.user_id === req.user!.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Attach H1B info
  const enriched = jobs.map(j => {
    const h1bCo = findOne<any>('h1b_companies', c => c.name.toLowerCase() === j.company.toLowerCase());
    return { ...j, h1b_approval_rate: h1bCo?.approval_rate };
  });
  res.json(enriched);
});

router.post('/', validate(createJobSchema), (req: AuthRequest, res: Response) => {
  const { company, role, jdUrl, stage, recruiterName, recruiterLinkedin, salaryMin, salaryMax, followUpDate, notes, appliedDate } = req.body;
  const h1bCo = findOne<any>('h1b_companies', c => c.name.toLowerCase() === company.toLowerCase());

  const job = insert('job_applications', {
    user_id: req.user!.id, company, role,
    jd_url: jdUrl, stage,
    recruiter_name: recruiterName, recruiter_linkedin: recruiterLinkedin,
    salary_min: salaryMin, salary_max: salaryMax,
    follow_up_date: followUpDate, notes, applied_date: appliedDate,
    sponsors_h1b: !!h1bCo,
  });
  res.status(201).json(job);
});

router.patch('/:id', (req: AuthRequest, res: Response) => {
  const job = findOne<any>('job_applications', j => j.id === req.params.id && j.user_id === req.user!.id);
  if (!job) return res.status(404).json({ error: 'Not found' });

  const fieldMap: Record<string, string> = {
    jdUrl: 'jd_url', recruiterName: 'recruiter_name', recruiterLinkedin: 'recruiter_linkedin',
    salaryMin: 'salary_min', salaryMax: 'salary_max', followUpDate: 'follow_up_date', appliedDate: 'applied_date',
  };
  const updates: Record<string, any> = {};
  for (const [k, v] of Object.entries(req.body)) {
    updates[fieldMap[k] || k] = v;
  }

  const updated = update('job_applications', req.params.id, updates);
  res.json(updated);
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const job = findOne<any>('job_applications', j => j.id === req.params.id && j.user_id === req.user!.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  remove('job_applications', req.params.id);
  res.status(204).send();
});

router.post('/assistant', async (req: AuthRequest, res: Response) => {
  const { message } = req.body as { message?: string };
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const jobs = findAll<any>('job_applications', j => j.user_id === req.user!.id)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Build a compact context summary
  const stageCounts: Record<string, number> = { saved: 0, applied: 0, assessment: 0, interview: 0, offer: 0, rejected: 0 };
  for (const j of jobs) { if (stageCounts[j.stage] !== undefined) stageCounts[j.stage]++; }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = jobs.filter((j: any) => new Date(j.created_at) >= oneWeekAgo);

  const followUpsDue = jobs.filter((j: any) => {
    if (!j.follow_up_date) return false;
    const d = new Date(j.follow_up_date);
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return d <= future;
  });

  const recentItems = jobs.slice(0, 8).map((j: any) =>
    `- ${j.company} | ${j.role} | stage: ${j.stage}` +
    (j.applied_date ? ` | applied: ${j.applied_date}` : '') +
    (j.follow_up_date ? ` | follow-up: ${j.follow_up_date}` : '') +
    (j.sponsors_h1b ? ' | H1B sponsor' : '')
  ).join('\n');

  const contextSummary = `User has ${jobs.length} total job applications.
Stage breakdown: saved=${stageCounts.saved}, applied=${stageCounts.applied}, assessment=${stageCounts.assessment}, interview=${stageCounts.interview}, offer=${stageCounts.offer}, rejected=${stageCounts.rejected}.
Applied this week: ${thisWeek.length} application(s).
Follow-ups due within 7 days: ${followUpsDue.length} (${followUpsDue.map((j: any) => `${j.company} on ${j.follow_up_date}`).join(', ') || 'none'}).
Recent applications:
${recentItems || 'None yet.'}`;

  if (!hasAI || !aiClient) {
    // Fallback: compute a helpful templated answer
    const responseRate = jobs.length > 0
      ? Math.round(((stageCounts.assessment + stageCounts.interview + stageCounts.offer) / jobs.length) * 100)
      : 0;

    const fallback = `Here's your application summary:

**Total:** ${jobs.length} applications
**Stage breakdown:** ${stageCounts.saved} saved, ${stageCounts.applied} applied, ${stageCounts.assessment} in assessment, ${stageCounts.interview} interviewing, ${stageCounts.offer} offers, ${stageCounts.rejected} rejected
**Response rate:** ${responseRate}%
**Applied this week:** ${thisWeek.length}
**Follow-ups due soon:** ${followUpsDue.length > 0 ? followUpsDue.map((j: any) => `${j.company} (${j.follow_up_date})`).join(', ') : 'None in the next 7 days'}

${stageCounts.interview > 0 ? `You have ${stageCounts.interview} active interview(s) — keep up the momentum!` : ''}
${stageCounts.offer > 0 ? `Congratulations — you have ${stageCounts.offer} offer(s) to consider!` : ''}`;

    return res.json({ reply: fallback.trim() });
  }

  try {
    const completion = await aiClient.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a helpful job search assistant for an F1 visa student. You have access to the user's real application data. Answer questions concisely and helpfully. Use markdown for structure when appropriate. Focus on actionable insights. Keep responses under 200 words unless asked for detail.`,
        },
        {
          role: 'user',
          content: `My application data:\n${contextSummary}\n\nMy question: ${message}`,
        },
      ],
      max_tokens: 400,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? 'Sorry, I could not generate a response.';
    return res.json({ reply });
  } catch (err) {
    console.error('AI assistant error:', err);
    return res.status(500).json({ error: 'AI request failed' });
  }
});

router.get('/analytics', (req: AuthRequest, res: Response) => {
  const jobs = findAll<any>('job_applications', j => j.user_id === req.user!.id);
  const now = new Date();

  const stages = {
    applied: jobs.filter(j => j.stage === 'applied').length,
    assessment: jobs.filter(j => j.stage === 'assessment').length,
    interview: jobs.filter(j => j.stage === 'interview').length,
    offer: jobs.filter(j => j.stage === 'offer').length,
    rejected: jobs.filter(j => j.stage === 'rejected').length,
    saved: jobs.filter(j => j.stage === 'saved').length,
    total: jobs.length,
  };

  const responseRate = stages.total > 0
    ? Math.round(((stages.assessment + stages.interview + stages.offer) / stages.total) * 100)
    : 0;

  // Weekly volume last 12 weeks
  const weeklyVolume: { week: string; count: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - w * 7 - weekStart.getDay());
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = jobs.filter(j => { const d = new Date(j.created_at); return d >= weekStart && d < weekEnd; }).length;
    weeklyVolume.push({ week: weekStart.toISOString(), count });
  }

  res.json({ stages, weeklyVolume, responseRate });
});

export default router;
