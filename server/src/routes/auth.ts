import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { findOne, insert, update } from '../db/store';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { config } from '../config';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function sanitizeUser(u: any) {
  const { password_hash, ...safe } = u;
  return safe;
}

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  const existing = findOne('users', (u: any) => u.email === email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = insert('users', {
    email, password_hash: passwordHash,
    first_name: firstName, last_name: lastName,
    profile_complete_pct: 0, email_verified: false,
  });

  const token = generateToken(user.id, user.email);
  return res.status(201).json({ token, user: sanitizeUser(user) });
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = findOne<any>('users', (u: any) => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateToken(user.id, user.email);
  return res.json({ token, user: sanitizeUser(user) });
});

router.get('/google', (_req, res) => {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query as { code: string };
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: config.google.clientId, client_secret: config.google.clientSecret, redirect_uri: config.google.callbackUrl, grant_type: 'authorization_code' }),
    });
    const tokenData = await tokenRes.json() as any;
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const profile = await profileRes.json() as any;

    let user = findOne<any>('users', (u: any) => u.google_id === profile.id || u.email === profile.email);
    if (!user) {
      user = insert('users', { email: profile.email, google_id: profile.id, first_name: profile.given_name, last_name: profile.family_name, avatar_url: profile.picture, email_verified: true, profile_complete_pct: 0 });
    } else if (!user.google_id) {
      user = update('users', user.id, { google_id: profile.id });
    }

    const token = generateToken(user!.id, user!.email);
    return res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  } catch {
    return res.redirect(`${config.clientUrl}/auth/error`);
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = findOne<any>('users', (u: any) => u.id === req.user!.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(sanitizeUser(user));
});

router.patch('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const allowed = ['university', 'major', 'graduation_date', 'visa_type', 'target_roles', 'target_companies', 'tech_stack', 'location_preferences', 'first_name', 'last_name'];
  const fieldMap: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', graduationDate: 'graduation_date', visaType: 'visa_type', targetRoles: 'target_roles', targetCompanies: 'target_companies', techStack: 'tech_stack', locationPreferences: 'location_preferences' };

  const updates: Record<string, any> = {};
  for (const [key, val] of Object.entries(req.body)) {
    const dbKey = fieldMap[key] || key;
    if (allowed.includes(dbKey)) updates[dbKey] = val;
  }

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields' });

  const completionFields = ['university', 'major', 'graduation_date', 'visa_type', 'target_roles', 'tech_stack', 'location_preferences'];
  const currentUser = findOne<any>('users', (u: any) => u.id === req.user!.id)!;
  const merged = { ...currentUser, ...updates };
  const filled = completionFields.filter(f => merged[f] && (!Array.isArray(merged[f]) || merged[f].length > 0)).length;
  const pct = Math.round((filled / completionFields.length) * 100);

  const user = update('users', req.user!.id, { ...updates, profile_complete_pct: pct });
  res.json(sanitizeUser(user!));
});

export default router;
