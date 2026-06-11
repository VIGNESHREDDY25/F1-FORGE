import { Router, Response } from 'express';
import { z } from 'zod';
import { findAll, findOne, insert, update, remove } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { generateNetworkingMessage } from '../services/aiAssistant';

const router = Router();
router.use(authenticate);

const contactSchema = z.object({
  targetCompany: z.string().min(1),
  contactName: z.string().optional(),
  contactRole: z.string().optional(),
  graduationYear: z.number().int().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  university: z.string().optional(),
  notes: z.string().optional(),
});

// ── Existing CRUD ─────────────────────────────────────────────────────────────

router.get('/stats', (req: AuthRequest, res: Response) => {
  const contacts = findAll<any>('referral_contacts', c => c.user_id === req.user!.id);
  res.json({
    total: contacts.length,
    contacted: contacts.filter(c => c.status === 'contacted').length,
    responded: contacts.filter(c => c.status === 'responded').length,
    meetings: contacts.filter(c => c.status === 'meeting_scheduled').length,
  });
});

router.get('/', (req: AuthRequest, res: Response) => {
  const { company } = req.query as { company?: string };
  let contacts = findAll<any>('referral_contacts', c => c.user_id === req.user!.id);
  if (company) contacts = contacts.filter(c => c.target_company.toLowerCase().includes(company.toLowerCase()));
  contacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(contacts);
});

router.post('/', validate(contactSchema), (req: AuthRequest, res: Response) => {
  const { targetCompany, contactName, contactRole, graduationYear, linkedinUrl, university, notes } = req.body;
  const contact = insert('referral_contacts', {
    user_id: req.user!.id, target_company: targetCompany, contact_name: contactName,
    contact_role: contactRole, graduation_year: graduationYear, linkedin_url: linkedinUrl,
    university, notes, status: 'not_contacted',
  });
  res.status(201).json(contact);
});

router.patch('/:id', (req: AuthRequest, res: Response) => {
  const contact = findOne<any>('referral_contacts', c => c.id === req.params.id && c.user_id === req.user!.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });

  const fieldMap: Record<string, string> = { outreachDate: 'outreach_date', linkedinUrl: 'linkedin_url', contactName: 'contact_name', contactRole: 'contact_role' };
  const updates: Record<string, any> = {};
  for (const [k, v] of Object.entries(req.body)) updates[fieldMap[k] || k] = v;

  const updated = update('referral_contacts', req.params.id, updates);
  res.json(updated);
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const contact = findOne<any>('referral_contacts', c => c.id === req.params.id && c.user_id === req.user!.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  remove('referral_contacts', req.params.id);
  res.status(204).send();
});

// ── Generate: LinkedIn deep-links + AI outreach messages ─────────────────────

const generateSchema = z.object({
  company: z.string().min(1),
  role: z.string().optional(),
});

function buildLinkedInUrl(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
}

router.post('/generate', validate(generateSchema), async (req: AuthRequest, res: Response) => {
  const { company, role } = req.body as { company: string; role?: string };

  // Fetch full user profile (includes university, major, name, target_roles)
  const userRow = findOne<any>('users', u => u.id === req.user!.id);
  if (!userRow) return res.status(404).json({ error: 'User not found' });

  const firstName = userRow.first_name || 'Student';
  const lastName = userRow.last_name || '';
  const university = userRow.university || 'my university';
  const major = userRow.major || 'Computer Science';
  const targetRoles: string[] = userRow.target_roles || [];
  const primaryRole = role || (targetRoles.length ? targetRoles[0] : 'Software Engineer');

  // ── Build LinkedIn deep-link URLs ──────────────────────────────────────────

  // (a) Alumni at company
  const alumniKeywords = `"${university}" "${company}"`;
  const alumniUrl = buildLinkedInUrl(alumniKeywords);

  // (b) Recruiters / talent acquisition at company
  const recruiterKeywords = `recruiter "${company}" "talent acquisition" OR "technical recruiter" OR "university recruiting"`;
  const recruiterUrl = buildLinkedInUrl(recruiterKeywords);

  // (c) People in user's target role at company
  const roleKeywords = `"${primaryRole}" "${company}"`;
  const roleUrl = buildLinkedInUrl(roleKeywords);

  // ── Generate AI outreach messages for each target type ────────────────────

  const sharedCtx = `${firstName} ${lastName}, ${major} student at ${university}, interested in ${primaryRole} roles`;

  const [alumniConnect, alumniEmail, recruiterConnect, recruiterEmail, roleConnect, roleEmail] =
    await Promise.all([
      generateNetworkingMessage({
        messageType: 'linkedin_connect',
        targetName: `${company} Alumnus`,
        targetCompany: company,
        targetRole: `${university} Alumni`,
        userUniversity: university,
        sharedContext: `Fellow ${university} alum now at ${company}. ${sharedCtx}`,
      }),
      generateNetworkingMessage({
        messageType: 'cold_email',
        targetName: `${company} Alumnus`,
        targetCompany: company,
        targetRole: `${university} Alumni`,
        userUniversity: university,
        sharedContext: `${sharedCtx}. Reaching out to a fellow ${university} alum for advice and a potential referral.`,
      }),
      generateNetworkingMessage({
        messageType: 'linkedin_connect',
        targetName: `${company} Recruiter`,
        targetCompany: company,
        targetRole: 'Technical Recruiter',
        userUniversity: university,
        sharedContext: `${sharedCtx}. F1 OPT authorized. Looking for ${primaryRole} opportunities at ${company}.`,
      }),
      generateNetworkingMessage({
        messageType: 'cold_email',
        targetName: `${company} Recruiter`,
        targetCompany: company,
        targetRole: 'Technical Recruiter',
        userUniversity: university,
        sharedContext: `${sharedCtx}. F1 OPT authorized, available immediately. Excited about ${company}.`,
      }),
      generateNetworkingMessage({
        messageType: 'linkedin_connect',
        targetName: `${company} Engineer`,
        targetCompany: company,
        targetRole: primaryRole,
        userUniversity: university,
        sharedContext: `${sharedCtx}. Would love to learn about the ${primaryRole} experience at ${company}.`,
      }),
      generateNetworkingMessage({
        messageType: 'cold_email',
        targetName: `${company} Engineer`,
        targetCompany: company,
        targetRole: primaryRole,
        userUniversity: university,
        sharedContext: `${sharedCtx}. Asking for insights into the role and team at ${company}.`,
      }),
    ]);

  res.json({
    company,
    role: primaryRole,
    userContext: { firstName, university, major },
    targets: [
      {
        type: 'alumni',
        label: 'Alumni',
        description: `${university} alumni now at ${company}`,
        linkedinUrl: alumniUrl,
        linkedinKeywords: alumniKeywords,
        messages: {
          connectionNote: alumniConnect.message,
          email: alumniEmail.message,
          emailSubject: alumniEmail.subjectLine,
        },
      },
      {
        type: 'recruiters',
        label: 'Recruiters',
        description: `Technical recruiters & talent acquisition at ${company}`,
        linkedinUrl: recruiterUrl,
        linkedinKeywords: recruiterKeywords,
        messages: {
          connectionNote: recruiterConnect.message,
          email: recruiterEmail.message,
          emailSubject: recruiterEmail.subjectLine,
        },
      },
      {
        type: 'role',
        label: primaryRole,
        description: `${primaryRole}s currently at ${company}`,
        linkedinUrl: roleUrl,
        linkedinKeywords: roleKeywords,
        messages: {
          connectionNote: roleConnect.message,
          email: roleEmail.message,
          emailSubject: roleEmail.subjectLine,
        },
      },
    ],
  });
});

export default router;
