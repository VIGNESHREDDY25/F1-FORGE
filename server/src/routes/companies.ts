import { Router, Response } from 'express';
import { findAll, findOne } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const { search, industry, size, minApproval, page = '1', limit = '20' } = req.query as Record<string, string>;

  let companies = findAll<any>('h1b_companies');

  if (search) companies = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  if (industry) companies = companies.filter(c => c.industry === industry);
  if (size) companies = companies.filter(c => c.size_category === size);
  if (minApproval) companies = companies.filter(c => c.approval_rate >= parseFloat(minApproval));

  companies.sort((a, b) => b.total_petitions - a.total_petitions);

  const total = companies.length;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const paged = companies.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  const industries = [...new Set(findAll<any>('h1b_companies').map(c => c.industry).filter(Boolean))].sort();

  res.json({
    companies: paged,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    industries,
  });
});

router.get('/check/:name', (req: AuthRequest, res: Response) => {
  const company = findOne<any>('h1b_companies', c => c.name.toLowerCase() === decodeURIComponent(req.params.name).toLowerCase());
  res.json({ sponsors: !!company, company });
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const company = findOne<any>('h1b_companies', c => c.id === req.params.id);
  if (!company) return res.status(404).json({ error: 'Not found' });
  res.json(company);
});

export default router;
