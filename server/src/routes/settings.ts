import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getById, update } from '../db/store';

const router = Router();
router.use(authenticate as any);

// GET /api/settings — return sanitized settings (no raw tokens)
router.get('/', (req: AuthRequest, res: Response) => {
  const user = getById('users', req.user!.id) as any;
  const s = user?.settings ?? {};
  res.json({
    gmailConnected: !!s.gmailToken,
    linkedinConnected: !!s.linkedinToken,
    gmailEmail: s.gmailEmail ?? null,
    autoTrackApplications: s.autoTrackApplications ?? true,
    autoSyncInterval: s.autoSyncInterval ?? 60,
  });
});

// POST /api/settings — save settings
router.post('/', (req: AuthRequest, res: Response) => {
  const { gmailToken, linkedinToken, autoTrackApplications, autoSyncInterval } = req.body;
  const user = getById('users', req.user!.id) as any;
  const current = user?.settings ?? {};

  const next: any = { ...current };
  if (gmailToken !== undefined) next.gmailToken = gmailToken || null;
  if (linkedinToken !== undefined) next.linkedinToken = linkedinToken || null;
  if (autoTrackApplications !== undefined) next.autoTrackApplications = autoTrackApplications;
  if (autoSyncInterval !== undefined) next.autoSyncInterval = autoSyncInterval;

  update('users', req.user!.id, { settings: next });
  res.json({ ok: true });
});

// POST /api/settings/sync-emails — scan Gmail for application confirmations
router.post('/sync-emails', async (req: AuthRequest, res: Response) => {
  const user = getById('users', req.user!.id) as any;
  const token = user?.settings?.gmailToken;

  if (!token) {
    return res.status(400).json({ error: 'No Gmail token configured. Go to Settings → Integrations to connect Gmail.' });
  }

  // Full Gmail API integration: would use googleapis to search sent mail for
  // subjects matching job application confirmation patterns and auto-create
  // job_application records. Returning placeholder until OAuth flow is wired.
  res.json({ synced: 0, message: 'Token saved. Full Gmail sync will be available after OAuth verification.' });
});

export default router;
