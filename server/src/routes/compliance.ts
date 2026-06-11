import { Router, Response } from 'express';
import { z } from 'zod';
import { differenceInDays, addDays, parseISO, format } from 'date-fns';
import { findOne, insert, update } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

const complianceSchema = z.object({
  optStartDate: z.string(),
  optEndDate: z.string(),
  employmentStartDate: z.string().optional(),
  stemOptEligible: z.boolean().default(false),
  stemOptStartDate: z.string().optional(),
  stemOptEndDate: z.string().optional(),
});

router.get('/', (req: AuthRequest, res: Response) => {
  const compliance = findOne<any>('opt_compliance', c => c.user_id === req.user!.id);
  if (!compliance) return res.json(null);
  res.json(enrichComplianceData(compliance));
});

router.post('/', validate(complianceSchema), (req: AuthRequest, res: Response) => {
  const { optStartDate, optEndDate, employmentStartDate, stemOptEligible, stemOptStartDate, stemOptEndDate } = req.body;

  const existing = findOne<any>('opt_compliance', c => c.user_id === req.user!.id);
  let compliance;

  if (existing) {
    compliance = update('opt_compliance', existing.id, {
      opt_start_date: optStartDate, opt_end_date: optEndDate,
      employment_start_date: employmentStartDate, stem_opt_eligible: stemOptEligible,
      stem_opt_start_date: stemOptStartDate, stem_opt_end_date: stemOptEndDate,
    });
  } else {
    compliance = insert('opt_compliance', {
      user_id: req.user!.id, opt_start_date: optStartDate, opt_end_date: optEndDate,
      employment_start_date: employmentStartDate, stem_opt_eligible: stemOptEligible,
      stem_opt_start_date: stemOptStartDate, stem_opt_end_date: stemOptEndDate,
      unemployment_days_used: 0,
    });
  }

  res.json(enrichComplianceData(compliance!));
});

router.patch('/unemployment-days', (req: AuthRequest, res: Response) => {
  const { days } = req.body;
  if (typeof days !== 'number') return res.status(400).json({ error: 'days must be a number' });

  const existing = findOne<any>('opt_compliance', c => c.user_id === req.user!.id);
  if (!existing) return res.status(404).json({ error: 'Compliance record not found' });

  const compliance = update('opt_compliance', existing.id, { unemployment_days_used: days });
  res.json(enrichComplianceData(compliance!));
});

function enrichComplianceData(compliance: any) {
  const today = new Date();
  const optEnd = parseISO(compliance.opt_end_date);
  const daysUntilOptEnd = differenceInDays(optEnd, today);
  const unemploymentDaysRemaining = 90 - (compliance.unemployment_days_used || 0);

  let riskStatus: 'green' | 'yellow' | 'red' = 'green';
  if (unemploymentDaysRemaining < 15 || daysUntilOptEnd < 14) riskStatus = 'red';
  else if (unemploymentDaysRemaining < 30 || daysUntilOptEnd < 30) riskStatus = 'yellow';

  const timelines = [
    { label: 'OPT Start', date: compliance.opt_start_date, type: 'start' },
    { label: 'OPT End', date: compliance.opt_end_date, type: 'deadline' },
  ];

  if (compliance.stem_opt_eligible && compliance.opt_end_date) {
    const stemWindow = addDays(parseISO(compliance.opt_end_date), -90);
    timelines.push({ label: 'STEM OPT Application Window Opens', date: format(stemWindow, 'yyyy-MM-dd'), type: 'warning' });
  }

  const year = new Date().getMonth() >= 3 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  const nextH1bLottery = {
    registrationStart: `${year}-03-01`,
    registrationEnd: `${year}-03-18`,
    lotterDate: `${year}-03-31`,
  };

  return { ...compliance, daysUntilOptEnd, unemploymentDaysRemaining, riskStatus, timelines, nextH1bLottery };
}

export default router;
