import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler, notFound } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import jobRoutes from './routes/jobs';
import resumeRoutes from './routes/resume';
import complianceRoutes from './routes/compliance';
import companiesRoutes from './routes/companies';
import assistantRoutes from './routes/assistant';
import referralsRoutes from './routes/referrals';
import interviewsRoutes from './routes/interviews';
import networkingRoutes from './routes/networking';
import dashboardRoutes from './routes/dashboard';
import newsRoutes from './routes/news';
import jobDiscoveryRoutes from './routes/jobDiscovery';
import practiceRoutes from './routes/practice';
import adminRoutes from './routes/admin';
import salaryRoutes from './routes/salary';
import settingsRoutes from './routes/settings';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(compression());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

app.use('/api', limiter);
app.use('/api/assistant/chat', aiLimiter);
app.use('/api/resume/optimize', aiLimiter);

const healthHandler = (_req: express.Request, res: express.Response) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: config.env });

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/interviews', interviewsRoutes);
app.use('/api/networking', networkingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/job-discovery', jobDiscoveryRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/settings', settingsRoutes);

// ─── Serve the built React client (single-service production deploy) ─────────
// In production the API and the SPA are the same origin, so the client's
// relative `/api` calls just work with no CORS. Looks for client/dist next to
// the server build (works for both `dist/` compiled output and ts-node).
const clientDist = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../../../client/dist'),
].find(p => fs.existsSync(path.join(p, 'index.html')));

if (clientDist) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html so client routing works.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
