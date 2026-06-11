import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { findAll } from '../db/store';
import { aiClient, hasAI, AI_MODEL } from '../services/aiClient';

const router = Router();
router.use(authenticate);

// Salary data by role and location derived from H1B public filings
const SALARY_DATA: Record<string, Record<string, { p25: number; median: number; p75: number; p90: number; count: number }>> = {
  'Software Engineer': {
    'San Francisco, CA': { p25: 165000, median: 195000, p75: 235000, p90: 280000, count: 8420 },
    'New York, NY': { p25: 155000, median: 182000, p75: 220000, p90: 265000, count: 6280 },
    'Seattle, WA': { p25: 158000, median: 185000, p75: 225000, p90: 270000, count: 5940 },
    'Austin, TX': { p25: 138000, median: 162000, p75: 195000, p90: 235000, count: 3820 },
    'Boston, MA': { p25: 148000, median: 172000, p75: 208000, p90: 248000, count: 2940 },
    'Chicago, IL': { p25: 132000, median: 155000, p75: 188000, p90: 225000, count: 2180 },
    'United States': { p25: 135000, median: 165000, p75: 205000, p90: 248000, count: 42380 },
  },
  'Data Scientist': {
    'San Francisco, CA': { p25: 148000, median: 178000, p75: 215000, p90: 258000, count: 3840 },
    'New York, NY': { p25: 140000, median: 168000, p75: 202000, p90: 242000, count: 2980 },
    'Seattle, WA': { p25: 142000, median: 170000, p75: 205000, p90: 245000, count: 2540 },
    'Austin, TX': { p25: 122000, median: 148000, p75: 178000, p90: 215000, count: 1820 },
    'United States': { p25: 118000, median: 148000, p75: 185000, p90: 225000, count: 18940 },
  },
  'ML Engineer': {
    'San Francisco, CA': { p25: 175000, median: 210000, p75: 255000, p90: 310000, count: 2840 },
    'New York, NY': { p25: 162000, median: 195000, p75: 238000, p90: 288000, count: 1980 },
    'Seattle, WA': { p25: 168000, median: 200000, p75: 242000, p90: 292000, count: 1840 },
    'United States': { p25: 145000, median: 178000, p75: 220000, p90: 268000, count: 15820 },
  },
  'Product Manager': {
    'San Francisco, CA': { p25: 158000, median: 188000, p75: 228000, p90: 272000, count: 2640 },
    'New York, NY': { p25: 148000, median: 175000, p75: 212000, p90: 255000, count: 2180 },
    'Seattle, WA': { p25: 150000, median: 178000, p75: 215000, p90: 258000, count: 1840 },
    'United States': { p25: 128000, median: 155000, p75: 192000, p90: 235000, count: 12480 },
  },
  'Data Engineer': {
    'San Francisco, CA': { p25: 152000, median: 182000, p75: 220000, p90: 262000, count: 2240 },
    'New York, NY': { p25: 142000, median: 170000, p75: 205000, p90: 245000, count: 1840 },
    'Seattle, WA': { p25: 145000, median: 172000, p75: 208000, p90: 248000, count: 1640 },
    'United States': { p25: 122000, median: 148000, p75: 185000, p90: 222000, count: 10820 },
  },
  'DevOps Engineer': {
    'San Francisco, CA': { p25: 145000, median: 172000, p75: 208000, p90: 248000, count: 1840 },
    'New York, NY': { p25: 135000, median: 160000, p75: 192000, p90: 230000, count: 1480 },
    'United States': { p25: 112000, median: 138000, p75: 172000, p90: 208000, count: 11240 },
  },
  'Security Engineer': {
    'San Francisco, CA': { p25: 152000, median: 182000, p75: 218000, p90: 260000, count: 1640 },
    'New York, NY': { p25: 142000, median: 170000, p75: 204000, p90: 244000, count: 1280 },
    'United States': { p25: 118000, median: 145000, p75: 178000, p90: 215000, count: 9840 },
  },
};

const COMPANY_PREMIUMS: Record<string, number> = {
  'Google LLC': 1.18, 'Meta Platforms Inc': 1.22, 'Netflix Inc': 1.28,
  'Stripe Inc': 1.20, 'Databricks Inc': 1.18, 'OpenAI': 1.30,
  'Anthropic PBC': 1.32, 'Apple Inc': 1.12, 'Microsoft Corporation': 1.08,
  'Amazon.com Inc': 1.05, 'NVIDIA Corporation': 1.25, 'Airbnb Inc': 1.15,
};

router.get('/insights', (req: AuthRequest, res: Response) => {
  const { role = 'Software Engineer', location = 'United States', company } = req.query as Record<string, string>;

  // Find best match
  const roleData = SALARY_DATA[role] || SALARY_DATA['Software Engineer'];
  const locationKey = Object.keys(roleData).find(k => k.toLowerCase().includes(location.toLowerCase().split(',')[0])) || 'United States';
  const baseData = roleData[locationKey] || roleData['United States'];

  const premium = company ? (COMPANY_PREMIUMS[company] || 1.0) : 1.0;

  const data = {
    role,
    location: locationKey,
    company: company || null,
    salaryBands: {
      p25: Math.round(baseData.p25 * premium),
      median: Math.round(baseData.median * premium),
      p75: Math.round(baseData.p75 * premium),
      p90: Math.round(baseData.p90 * premium),
    },
    sampleSize: baseData.count,
    companyPremium: premium > 1 ? `+${Math.round((premium - 1) * 100)}% vs market` : 'Market rate',
    h1bAvgSalary: null as number | null,
    negotiationTips: getNegotiationTips(role, locationKey, premium),
  };

  // Enrich with H1B data if company matched
  if (company) {
    const h1bCo = findAll<any>('h1b_companies').find(c =>
      c.name.toLowerCase().includes(company.toLowerCase().split(' ')[0]) ||
      company.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
    );
    if (h1bCo) data.h1bAvgSalary = h1bCo.avg_salary;
  }

  res.json(data);
});

router.get('/roles', (_req: AuthRequest, res: Response) => {
  const roles = Object.keys(SALARY_DATA).map(role => ({
    role,
    locations: Object.keys(SALARY_DATA[role]),
    medianNational: SALARY_DATA[role]['United States']?.median,
  }));
  res.json(roles);
});

router.get('/compare', (req: AuthRequest, res: Response) => {
  const { roles, location = 'United States' } = req.query as { roles: string; location: string };
  const roleList = roles ? roles.split(',').map(r => r.trim()) : Object.keys(SALARY_DATA).slice(0, 6);

  const comparison = roleList.map(role => {
    const roleData = SALARY_DATA[role];
    if (!roleData) return null;
    const locKey = Object.keys(roleData).find(k => k.toLowerCase().includes(location.toLowerCase().split(',')[0])) || 'United States';
    const d = roleData[locKey] || roleData['United States'];
    return { role, median: d.median, p75: d.p75, location: locKey };
  }).filter(Boolean);

  res.json(comparison);
});

router.post('/assistant', async (req: AuthRequest, res: Response) => {
  const { message } = req.body as { message?: string };
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const SYSTEM_PROMPT = `You are an expert compensation advisor specializing in F1 visa students, OPT, and H1B workers in the US tech industry. You have deep knowledge of:
- Prevailing wage requirements for H1B (DOL wage levels I–IV)
- OPT/CPT salary norms and how to negotiate as an international student
- Total compensation: base salary, signing bonus, RSUs/equity vesting, annual bonus, PTO
- Cost-of-living adjustments across US cities
- Salary negotiation tactics appropriate for F1/OPT/H1B situations
- H1B transfer leverage, cap-exempt employers, and how visa status affects negotiation

Provide concise, accurate, actionable advice. Use markdown for structure. Keep responses under 250 words unless deeper analysis is requested. Always mention relevant visa implications when applicable.`;

  if (!hasAI || !aiClient) {
    // Fallback static answer
    const lowerMsg = message.toLowerCase();
    let fallback = '';

    if (lowerMsg.includes('negotiate') || lowerMsg.includes('negotiat')) {
      fallback = `**Salary Negotiation for F1/OPT Students:**

1. **Know your worth** — use Levels.fyi, H1B salary data (dol.gov), and Glassdoor for your role/location
2. **You CAN negotiate on OPT** — your visa status doesn't prevent negotiation; employers expect it
3. **Counter 10–15% above the offer** — cite market data, not personal need
4. **Total comp matters** — push on signing bonus and RSU grants if base has a "band ceiling"
5. **H1B prevailing wage is the floor** — ensure the offer meets DOL's Level II or III for your role/location

For H1B: your salary is public record via USCIS/DOL disclosures, so benchmark against those filings.`;
    } else if (lowerMsg.includes('prevailing wage') || lowerMsg.includes('h1b')) {
      fallback = `**H1B Prevailing Wage:**

DOL sets 4 wage levels for H1B:
- **Level I** (~25th %ile): entry-level, routine tasks
- **Level II** (~median): moderate complexity — most new grad H1Bs
- **Level III** (~75th %ile): complex duties, some supervision
- **Level IV** (~90th %ile): lead/expert roles

Your H1B offer must meet at least the prevailing wage for your SOC code + location. Check: **flag.dol.gov/wage** or **h1bdata.us** for filed salaries.

Tip: If offered Level I, negotiate to Level II — it's better for your H1B and reflects real market rates.`;
    } else {
      fallback = `**F1/OPT Salary Quick Reference:**

- New grad SWE (national median): ~$130–165k base
- NYC/SF/Seattle premium: +15–25% vs national median
- Total comp (base + RSUs + bonus) often 30–50% above base at top companies
- H1B prevailing wage: typically $90–130k for Level II SWE depending on location

Ask me about: negotiation tactics, prevailing wage for a specific role, total comp breakdown, or whether a specific salary is competitive.`;
    }

    return res.json({ reply: fallback.trim() });
  }

  try {
    const completion = await aiClient.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? 'Sorry, I could not generate a response.';
    return res.json({ reply });
  } catch (err) {
    console.error('Salary AI assistant error:', err);
    return res.status(500).json({ error: 'AI request failed' });
  }
});

function getNegotiationTips(role: string, location: string, premium: number): string[] {
  const tips = [
    'Research the prevailing wage for your role on the DOL wage database — this is the H1B floor salary',
    'Use Levels.fyi, Glassdoor, and LinkedIn Salary for real compensation data',
    'Negotiate the total package: base + signing bonus + RSUs + PTO, not just base',
    'It\'s normal to counter 10-20% above the initial offer',
    'For H1B positions, ensure the offered salary meets prevailing wage requirements',
  ];

  if (premium > 1.15) tips.unshift(`${Math.round((premium - 1) * 100)}% salary premium — this employer pays above market. Use that as leverage.`);
  if (location.includes('San Francisco') || location.includes('New York')) {
    tips.push('Cost-of-living in this market is high — factor in housing when evaluating total comp');
  }
  return tips;
}

export default router;
