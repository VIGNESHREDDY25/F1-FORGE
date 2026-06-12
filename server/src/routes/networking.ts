import { Router, Response } from 'express';
import { z } from 'zod';
import { findAll, findOne, insert, update } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateNetworkingMessage, parseAndGenerateOutreach } from '../services/aiAssistant';

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

// ── Hiring-manager console: paste raw JD blob + raw profile blob → parsed
// card + tailored message. Nothing is saved until the user clicks Save, which
// files it into the Referral & Outreach tracker (referral_contacts). ─────────
const hiringManagerSchema = z.object({
  jobDescription: z.string().min(30, 'Paste the job description (at least a few sentences)'),
  hiringManagerInfo: z.string().min(3, 'Paste the hiring manager profile info'),
  hiringManagerLinkedin: z.string().optional(),
});

router.post('/hiring-manager', validate(hiringManagerSchema), async (req: AuthRequest, res: Response) => {
  const { jobDescription, hiringManagerInfo, hiringManagerLinkedin } = req.body;
  const user = findOne<any>('users', u => u.id === req.user!.id);

  // Latest uploaded resume (profile copy first, then Resume Optimizer history)
  // grounds the message in real experience instead of generic profile facts.
  const latestResume = user?.resume_text
    || findAll<any>('resume_optimizations', r => r.user_id === req.user!.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.resume_text;

  const result = await parseAndGenerateOutreach({
    jdText: jobDescription,
    managerText: hiringManagerInfo,
    managerLinkedin: hiringManagerLinkedin,
    userName: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || undefined,
    userUniversity: user?.university,
    userMajor: user?.major,
    userSkills: user?.tech_stack,
    userLinkedin: user?.linkedin_url,
    resumeText: latestResume || undefined,
    linkedinText: user?.linkedin_text || undefined,
  });
  res.json({ ...result, usedResume: !!latestResume });
});

const hiringManagerSaveSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  company: z.string().min(1),
  role: z.string().optional(),
  linkedinUrl: z.string().optional(),
  message: z.string().min(1),
  connectionNote: z.string().optional(),
});

router.post('/hiring-manager/save', validate(hiringManagerSaveSchema), (req: AuthRequest, res: Response) => {
  const { name, title, company, role, linkedinUrl, message, connectionNote } = req.body;
  const contact = insert('referral_contacts', {
    user_id: req.user!.id,
    target_company: company,
    contact_name: name,
    contact_role: title || '',
    target_role: role || '',
    linkedin_url: linkedinUrl || '',
    notes: [connectionNote && `Connection note:\n${connectionNote}`, `Message:\n${message}`].filter(Boolean).join('\n\n'),
    source: 'hiring_manager',
    status: 'not_contacted',
  });
  res.status(201).json(contact);
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
