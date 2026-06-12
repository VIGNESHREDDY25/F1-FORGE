import { Router, Response } from 'express';
import { z } from 'zod';
import { findAll, findOne, insert, update } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateNetworkingMessage, generateHiringManagerMessage } from '../services/aiAssistant';

const router = Router();
router.use(authenticate);

const generateSchema = z.object({
  messageType: z.enum(['linkedin_connect','follow_up','cold_email','referral_ask','thank_you','negotiation']),
  targetName: z.string().min(1),
  targetCompany: z.string().min(1),
  targetRole: z.string().min(1),
  sharedContext: z.string().optional(),
});

router.post('/generate', validate(generateSchema), async (req: AuthRequest, res: Response) => {
  const { messageType, targetName, targetCompany, targetRole, sharedContext } = req.body;
  const user = findOne<any>('users', u => u.id === req.user!.id);

  const result = await generateNetworkingMessage({
    messageType, targetName, targetCompany, targetRole, sharedContext,
    userUniversity: user?.university,
  });

  const msg = insert('networking_messages', {
    user_id: req.user!.id, message_type: messageType, target_name: targetName,
    target_company: targetCompany, target_role: targetRole,
    generated_message: result.message, subject_line: result.subjectLine,
    outcome: 'pending',
  });
  res.json(msg);
});

// ── Hiring-manager console: paste a JD + the hiring manager, get a tailored
// message + connection note, auto-saved to the outreach tracker ─────────────
const hiringManagerSchema = z.object({
  hiringManagerName: z.string().min(1),
  hiringManagerTitle: z.string().optional(),
  hiringManagerLinkedin: z.string().optional(),
  company: z.string().min(1),
  role: z.string().min(1),
  jobDescription: z.string().min(30, 'Paste the job description (at least a few sentences)'),
});

router.post('/hiring-manager', validate(hiringManagerSchema), async (req: AuthRequest, res: Response) => {
  const { hiringManagerName, hiringManagerTitle, hiringManagerLinkedin, company, role, jobDescription } = req.body;
  const user = findOne<any>('users', u => u.id === req.user!.id);

  const result = await generateHiringManagerMessage({
    hiringManagerName, hiringManagerTitle, company, role, jobDescription,
    userName: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || undefined,
    userUniversity: user?.university,
    userMajor: user?.major,
    userSkills: user?.tech_stack,
    userLinkedin: user?.linkedin_url,
  });

  const msg = insert('networking_messages', {
    user_id: req.user!.id,
    message_type: 'hiring_manager',
    target_name: hiringManagerName,
    target_title: hiringManagerTitle || '',
    target_linkedin: hiringManagerLinkedin || '',
    target_company: company,
    target_role: role,
    jd_snippet: jobDescription.slice(0, 400),
    generated_message: result.message,
    connection_note: result.connectionNote,
    outcome: 'pending',
  });
  res.json({ ...msg, connectionNote: result.connectionNote });
});

router.get('/', (req: AuthRequest, res: Response) => {
  const messages = findAll<any>('networking_messages', m => m.user_id === req.user!.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(messages);
});

router.patch('/:id/outcome', (req: AuthRequest, res: Response) => {
  const { outcome } = req.body;
  const valid = ['pending','responded','no_response','meeting_scheduled'];
  if (!valid.includes(outcome)) return res.status(400).json({ error: 'Invalid outcome' });

  const msg = findOne<any>('networking_messages', m => m.id === req.params.id && m.user_id === req.user!.id);
  if (!msg) return res.status(404).json({ error: 'Not found' });

  const updated = update('networking_messages', req.params.id, { outcome });
  res.json(updated);
});

router.get('/stats', (req: AuthRequest, res: Response) => {
  const msgs = findAll<any>('networking_messages', m => m.user_id === req.user!.id);
  res.json({
    total: msgs.length,
    connections: msgs.filter(m => m.message_type === 'linkedin_connect').length,
    responses: msgs.filter(m => m.outcome === 'responded').length,
    meetings: msgs.filter(m => m.outcome === 'meeting_scheduled').length,
  });
});

export default router;
