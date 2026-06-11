import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { findOne, rawGet, rawSet, findAll } from '../db/store';
import { config } from '../config';

const router = Router();
router.use(authenticate);

const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

export interface JobListing {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  locationType: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  description: string;
  postedAt: string;
  jobType: 'full-time' | 'part-time' | 'contract' | 'internship' | 'unknown';
  experienceLevel: 'entry' | 'mid' | 'senior' | 'director' | 'unknown';
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  applyUrl: string;
  source: string;
  sponsorsH1b: boolean;
  h1bApprovalRate?: number;
  h1bPetitions?: number;
  h1bAvgSalary?: number;
  tags: string[];
  resumeMatchScore?: number;
}

// ─── JSearch (RapidAPI) ──────────────────────────────────────────────────────
async function fetchJSearchJobs(query: string, location: string, page = 1, datePosted = 'month'): Promise<JobListing[]> {
  const apiKey = (config as any).rapidApiKey || process.env.RAPIDAPI_KEY;
  if (!apiKey || apiKey === 'your_rapidapi_key') throw new Error('No RapidAPI key');

  const params = new URLSearchParams({
    query: `${query} ${location}`,
    page: String(page),
    num_pages: '2',
    date_posted: datePosted,
    employment_types: 'FULLTIME,CONTRACTOR,INTERN',
  });

  const resp = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!resp.ok) throw new Error(`JSearch ${resp.status}`);
  const data = await resp.json() as { data?: any[] };
  return (data.data || []).map(mapJSearchJob);
}

function mapJSearchJob(j: any): JobListing {
  const salaryMin = j.job_min_salary ? Math.round(j.job_min_salary) : undefined;
  const salaryMax = j.job_max_salary ? Math.round(j.job_max_salary) : undefined;
  const salary = salaryMin && salaryMax
    ? `$${(salaryMin / 1000).toFixed(0)}k–$${(salaryMax / 1000).toFixed(0)}k`
    : salaryMin ? `$${(salaryMin / 1000).toFixed(0)}k+` : undefined;

  const empType = (j.job_employment_type || '').toLowerCase();
  const jobType: JobListing['jobType'] =
    empType.includes('full') ? 'full-time' :
    empType.includes('part') ? 'part-time' :
    empType.includes('contract') ? 'contract' :
    empType.includes('intern') ? 'internship' : 'unknown';

  const isRemote = j.job_is_remote || (j.job_city || '').toLowerCase().includes('remote');
  const locationType: JobListing['locationType'] = isRemote ? 'remote' :
    (j.job_description || '').toLowerCase().includes('hybrid') ? 'hybrid' : 'onsite';

  const title = j.job_title || '';
  const titleLow = title.toLowerCase();
  const expLevel: JobListing['experienceLevel'] =
    titleLow.includes('director') || titleLow.includes('vp') || titleLow.includes('head of') ? 'director' :
    titleLow.includes('senior') || titleLow.includes('sr.') || titleLow.includes('staff') || titleLow.includes('principal') || titleLow.includes('lead') ? 'senior' :
    titleLow.includes('junior') || titleLow.includes('jr.') || titleLow.includes('intern') || titleLow.includes('associate') || titleLow.includes('entry') ? 'entry' : 'mid';

  // JSearch sometimes reports the aggregator ("Jobs via Dice") as the employer —
  // strip that so recruiter/alumni searches target the real company.
  const company = (j.employer_name || 'Unknown').replace(/^jobs?\s+via\s+/i, '').trim() || 'Unknown';

  return {
    id: j.job_id || `jsearch-${Math.random()}`,
    title,
    company,
    companyLogo: j.employer_logo || undefined,
    location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || 'United States',
    locationType,
    description: (j.job_description || '').slice(0, 600),
    postedAt: j.job_posted_at_datetime_utc || new Date().toISOString(),
    jobType,
    experienceLevel: expLevel,
    salary,
    salaryMin,
    salaryMax,
    applyUrl: j.job_apply_link || j.job_google_link || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}`,
    source: j.job_publisher || 'LinkedIn',
    sponsorsH1b: false,
    tags: extractTags(title, j.job_description || ''),
  };
}

// ─── LinkedIn jobs (primary source — real postings, logos, server-side filters) ──
export interface JobFilters {
  datePosted?: string;   // '1h' | '5h' | '24h' | '3days' | '5days' | 'week' | 'month' | ''
  remote?: boolean;
  jobType?: string;      // 'full-time' | 'part-time' | 'contract' | 'internship'
  expLevel?: string;     // 'internship' | 'entry' | 'associate' | 'mid' | 'senior' | 'director' | 'executive'
  pages?: number;        // how many 25-result pages to pull
}

// LinkedIn f_TPR codes (seconds since posting)
const LI_TPR: Record<string, string> = {
  '1h':    'r3600',
  '5h':    'r18000',
  '24h':   'r86400',
  '3days': 'r259200',
  '5days': 'r432000',
  'week':  'r604800',
  'month': 'r2592000',
};
const LI_JT: Record<string, string> = { 'full-time': 'F', 'part-time': 'P', contract: 'C', internship: 'I', temporary: 'T' };
// LinkedIn experience codes: 1=intern, 2=entry, 3=associate, 4=mid-senior, 5=director, 6=executive
const LI_EXP: Record<string, string> = {
  internship: '1',
  entry:      '2',
  associate:  '3',
  mid:        '4',
  senior:     '4',
  director:   '5',
  executive:  '6',
};

function buildLinkedInUrl(query: string, location: string, filters: JobFilters, start: number): string {
  const p = new URLSearchParams({ keywords: query, location: location || 'United States', start: String(start) });
  if (filters.datePosted && LI_TPR[filters.datePosted]) p.set('f_TPR', LI_TPR[filters.datePosted]);
  if (filters.remote) p.set('f_WT', '2');
  if (filters.jobType && LI_JT[filters.jobType]) p.set('f_JT', LI_JT[filters.jobType]);
  if (filters.expLevel && LI_EXP[filters.expLevel]) p.set('f_E', LI_EXP[filters.expLevel]);
  return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${p}`;
}

async function fetchLinkedInPage(url: string): Promise<JobListing[]> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.linkedin.com/jobs/',
      'X-Requested-With': 'XMLHttpRequest',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!resp.ok) throw new Error(`LinkedIn ${resp.status}`);
  return parseLinkedInHTML(await resp.text());
}

async function fetchLinkedInJobs(query: string, location: string, filters: JobFilters = {}): Promise<JobListing[]> {
  const pages = Math.min(filters.pages ?? 6, 10); // up to ~250 jobs (10 pages × 25)
  const urls = Array.from({ length: pages }, (_, i) => buildLinkedInUrl(query, location, filters, i * 25));
  const settled = await Promise.allSettled(urls.map(fetchLinkedInPage));

  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();
  const out: JobListing[] = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const job of r.value) {
      const urlKey = job.applyUrl.split('?')[0];
      if (seenUrls.has(urlKey) || seenIds.has(job.id)) continue;
      seenUrls.add(urlKey);
      seenIds.add(job.id);
      out.push(job);
    }
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseLinkedInHTML(html: string): JobListing[] {
  const jobs: JobListing[] = [];
  // Each result is a <li> ... </li> card; split on list items.
  const cards = html.split(/<li[ >]/).slice(1);

  for (const card of cards) {
    const titleM = card.match(/base-search-card__title[^>]*>\s*([\s\S]*?)\s*</);
    // Company sits in a nested <a> (or <span> when the company has no LinkedIn page).
    const companyM =
      card.match(/base-search-card__subtitle[\s\S]*?<(?:a|span)[^>]*>\s*([\s\S]*?)\s*<\/(?:a|span)>/) ||
      card.match(/hidden-nested-link[^>]*>\s*([^<]+?)\s*</);
    const locationM = card.match(/job-search-card__location[^>]*>\s*([\s\S]*?)\s*</);
    const linkM = card.match(/href="(https:\/\/[a-z.]*linkedin\.com\/jobs\/view\/[^"?]+)/);
    const timeM = card.match(/datetime="([^"]+)"/);
    // logo: any LinkedIn media image referenced in the card
    const logoM = card.match(/(?:data-delayed-url|src)="(https:\/\/media\.licdn\.com\/[^"]+)"/);

    if (!titleM || !linkM) continue;
    const title = decodeEntities(titleM[1]);
    if (!title) continue;
    const company = companyM ? decodeEntities(companyM[1]) : 'Unknown';
    const location = locationM ? decodeEntities(locationM[1]) : 'United States';
    const low = `${title} ${location}`.toLowerCase();
    const isRemote = low.includes('remote');

    jobs.push({
      id: `li-${linkM[1].match(/(\d+)(?:\/|$)/)?.[1] || jobs.length}`,
      title,
      company,
      companyLogo: logoM?.[1]?.replace(/&amp;/g, '&'),
      location,
      locationType: isRemote ? 'remote' : location.toLowerCase().includes('hybrid') ? 'hybrid' : 'onsite',
      description: `${title} at ${company}. View the full description and apply on LinkedIn.`,
      postedAt: timeM?.[1] ? new Date(timeM[1]).toISOString() : new Date().toISOString(),
      jobType: title.toLowerCase().includes('intern') ? 'internship' : 'full-time',
      experienceLevel: inferExpLevel(title),
      applyUrl: linkM[1],
      source: 'LinkedIn',
      sponsorsH1b: false,
      tags: extractTags(title, ''),
    });
  }
  return jobs;
}

function inferExpLevel(title: string): JobListing['experienceLevel'] {
  const t = title.toLowerCase();
  if (t.includes('director') || t.includes('vp') || t.includes('head of')) return 'director';
  if (t.includes('senior') || t.includes('sr.') || t.includes('staff') || t.includes('principal') || t.includes('lead')) return 'senior';
  if (t.includes('intern')) return 'entry';
  if (t.includes('junior') || t.includes('jr.') || t.includes('entry')) return 'entry';
  if (t.includes('associate')) return 'mid';
  return 'mid';
}

// ─── Tags extraction ─────────────────────────────────────────────────────────
function extractTags(title: string, description: string): string[] {
  const text = (title + ' ' + description).toLowerCase();
  const tags: string[] = [];

  const SKILL_TAGS: [string[], string][] = [
    [['react', 'reactjs', 'react.js'], 'React'],
    [['node', 'nodejs', 'node.js'], 'Node.js'],
    [['python'], 'Python'],
    [['typescript', 'ts'], 'TypeScript'],
    [['java '], 'Java'],
    [['golang', 'go '], 'Go'],
    [['rust'], 'Rust'],
    [['kubernetes', 'k8s'], 'Kubernetes'],
    [['docker'], 'Docker'],
    [['aws', 'amazon web services'], 'AWS'],
    [['gcp', 'google cloud'], 'GCP'],
    [['azure'], 'Azure'],
    [['sql', 'postgresql', 'mysql'], 'SQL'],
    [['spark', 'databricks'], 'Spark'],
    [['tensorflow', 'pytorch', 'deep learning'], 'ML/DL'],
    [['llm', 'gpt', 'openai', 'langchain'], 'LLM/AI'],
    [['graphql'], 'GraphQL'],
    [['machine learning', 'ml engineer'], 'ML'],
    [['distributed systems'], 'Distributed'],
  ];

  for (const [keywords, tag] of SKILL_TAGS) {
    if (keywords.some(k => text.includes(k))) tags.push(tag);
  }

  return tags.slice(0, 5);
}

// ─── H1B enrichment ──────────────────────────────────────────────────────────
function enrichWithH1B(jobs: JobListing[]): JobListing[] {
  const companies = findAll<any>('h1b_companies');
  return jobs.map(job => {
    const compWords = job.company.toLowerCase().split(/\s+/);
    const h1bCo = companies.find((c: any) => {
      const h1bWords = c.name.toLowerCase().split(/\s+/);
      return compWords.some(w => w.length > 3 && h1bWords.includes(w)) ||
             h1bWords.some((w: string) => w.length > 3 && compWords.includes(w));
    });
    return {
      ...job,
      sponsorsH1b: !!h1bCo,
      h1bApprovalRate: h1bCo?.approval_rate,
      h1bPetitions: h1bCo?.total_petitions,
      h1bAvgSalary: h1bCo?.avg_salary,
    };
  });
}

// ─── AI resume match scoring ─────────────────────────────────────────────────
function scoreResumeMatch(jobs: JobListing[], userProfile: any): JobListing[] {
  if (!userProfile) return jobs;

  const profileText = [
    userProfile.major,
    ...(userProfile.tech_stack || []),
    ...(userProfile.target_roles || []),
  ].join(' ').toLowerCase();

  return jobs.map(job => {
    const jobText = (job.title + ' ' + job.tags.join(' ') + ' ' + job.description).toLowerCase();
    let score = 50; // base

    // Title match
    const titleWords = job.title.toLowerCase().split(/\s+/);
    const targetRoles = (userProfile.target_roles || []).map((r: string) => r.toLowerCase());
    if (targetRoles.some((r: string) => job.title.toLowerCase().includes(r) || r.includes(titleWords[0]))) score += 20;

    // Skills overlap
    const profileSkills = (userProfile.tech_stack || []).map((s: string) => s.toLowerCase());
    const matchedSkills = profileSkills.filter((s: string) => jobText.includes(s));
    score += Math.min(matchedSkills.length * 5, 25);

    // H1B bonus
    if (job.sponsorsH1b) score += 5;

    return { ...job, resumeMatchScore: Math.min(score, 100) };
  });
}

// ─── Curated fallback (50 jobs across roles) ─────────────────────────────────
function getCuratedJobs(query: string): JobListing[] {
  const q = query.toLowerCase();
  const isData = q.includes('data') || q.includes('analyst') || q.includes('scientist');
  const isPM = q.includes('product') || q.includes('pm ') || q.includes('manager');
  const isML = q.includes('machine') || q.includes(' ml') || q.includes('ai ') || q.includes('deep learning');
  const isDevOps = q.includes('devops') || q.includes('sre') || q.includes('cloud') || q.includes('platform');
  const isSecurity = q.includes('security') || q.includes('cyber');

  const ALL_JOBS = [
    // SWE
    { company: 'Google LLC', title: 'Software Engineer III', location: 'Mountain View, CA', salary: '$182k–$271k', type: 'swe', level: 'mid' as const, tags: ['Python', 'Go', 'Distributed'], desc: 'Build scalable backend systems powering billions of users. Collaborate with world-class engineers on infrastructure, APIs, and developer tools.' },
    { company: 'Meta Platforms Inc', title: 'Software Engineer, Backend', location: 'Menlo Park, CA', salary: '$177k–$246k', type: 'swe', level: 'mid' as const, tags: ['Python', 'React', 'GraphQL'], desc: 'Develop high-scale backend services for Meta products. Work with distributed systems, real-time data pipelines, and ML infrastructure.' },
    { company: 'Microsoft Corporation', title: 'Software Engineer II', location: 'Redmond, WA', salary: '$158k–$220k', type: 'swe', level: 'mid' as const, tags: ['TypeScript', 'Azure', 'C#'], desc: 'Shape the future of Microsoft products. Build features used by hundreds of millions. Strong H1B sponsorship track record.' },
    { company: 'Amazon.com Inc', title: 'Software Development Engineer II', location: 'Seattle, WA', salary: '$155k–$215k', type: 'swe', level: 'mid' as const, tags: ['Java', 'AWS', 'Distributed'], desc: 'Own the design and implementation of critical systems at massive scale. Work on distributed services that power Amazon commerce and AWS.' },
    { company: 'Apple Inc', title: 'Software Engineer, iOS Frameworks', location: 'Cupertino, CA', salary: '$165k–$235k', type: 'swe', level: 'mid' as const, tags: ['Swift', 'Objective-C', 'iOS'], desc: 'Build the frameworks that power every iPhone app. Work with the team that created UIKit, SwiftUI, and Core frameworks.' },
    { company: 'Stripe Inc', title: 'Backend Engineer, Payments', location: 'San Francisco, CA', salary: '$180k–$250k', type: 'swe', level: 'mid' as const, tags: ['Ruby', 'Go', 'SQL'], desc: 'Build the financial infrastructure of the internet. Engineer payment systems processing billions of dollars daily.' },
    { company: 'Databricks Inc', title: 'Software Engineer, Platform', location: 'San Francisco, CA', salary: '$175k–$245k', type: 'swe', level: 'mid' as const, tags: ['Scala', 'Spark', 'Kubernetes'], desc: 'Build the Databricks Lakehouse Platform used by thousands of data teams. Work on Spark, Delta Lake, and cloud infrastructure.' },
    { company: 'Cloudflare Inc', title: 'Software Engineer, Edge Network', location: 'San Francisco, CA (Remote OK)', salary: '$168k–$232k', type: 'swe', level: 'mid' as const, tags: ['Rust', 'Go', 'Distributed'], desc: 'Build the global edge network serving 30% of internet traffic. Work on cutting-edge CDN, security, and networking systems.' },
    { company: 'Netflix Inc', title: 'Senior Software Engineer, Streaming', location: 'Los Gatos, CA', salary: '$220k–$320k', type: 'swe', level: 'senior' as const, tags: ['Java', 'Python', 'AWS'], desc: 'Scale the world\'s leading streaming service. Work on video encoding, CDN, recommendation systems, and core API platform.' },
    { company: 'Airbnb Inc', title: 'Software Engineer, Full Stack', location: 'San Francisco, CA', salary: '$175k–$240k', type: 'swe', level: 'mid' as const, tags: ['React', 'Node.js', 'GraphQL'], desc: 'Build the platform that powers global travel for millions. End-to-end ownership from React frontend to distributed backend services.' },
    { company: 'LinkedIn Corp', title: 'Software Engineer, Feed', location: 'Sunnyvale, CA', salary: '$162k–$228k', type: 'swe', level: 'mid' as const, tags: ['Java', 'Kafka', 'Distributed'], desc: 'Build LinkedIn\'s professional news feed serving 900M members. Work on real-time ML ranking, personalization, and scalable data pipelines.' },
    { company: 'Salesforce Inc', title: 'Software Engineer, Einstein AI', location: 'San Francisco, CA', salary: '$160k–$225k', type: 'swe', level: 'mid' as const, tags: ['Java', 'Python', 'AWS'], desc: 'Build AI-powered CRM features for Fortune 500 companies. Work on LLM integrations, natural language processing, and enterprise APIs.' },
    { company: 'Uber Technologies Inc', title: 'Software Engineer, Maps', location: 'San Francisco, CA', salary: '$165k–$235k', type: 'swe', level: 'mid' as const, tags: ['Go', 'Python', 'Distributed'], desc: 'Power real-time mapping and routing for millions of Uber trips daily. Build low-latency geospatial systems and route optimization algorithms.' },
    { company: 'Lyft Inc', title: 'Backend Engineer, Marketplace', location: 'San Francisco, CA (Hybrid)', salary: '$158k–$228k', type: 'swe', level: 'mid' as const, tags: ['Python', 'Kubernetes', 'AWS'], desc: 'Build the marketplace algorithms that match millions of riders and drivers. Work on pricing, dispatch, and incentive systems.' },
    { company: 'DoorDash Inc', title: 'Software Engineer, Logistics', location: 'San Francisco, CA', salary: '$155k–$220k', type: 'swe', level: 'mid' as const, tags: ['Kotlin', 'Kafka', 'AWS'], desc: 'Scale food delivery logistics powering millions of orders. Build routing, batching, and real-time tracking systems.' },
    { company: 'Snap Inc', title: 'Software Engineer, AR Platform', location: 'Los Angeles, CA', salary: '$162k–$232k', type: 'swe', level: 'mid' as const, tags: ['C++', 'Python', 'ML/DL'], desc: 'Build the AR platform used by 400M Snapchat users. Develop camera processing, real-time effects, and computer vision systems.' },
    { company: 'Twitter Inc', title: 'Senior Software Engineer, Core', location: 'San Francisco, CA (Remote OK)', salary: '$195k–$280k', type: 'swe', level: 'senior' as const, tags: ['Scala', 'Java', 'Distributed'], desc: 'Build Twitter\'s core infrastructure serving 250M daily users. Work on real-time data processing, storage, and distributed systems.' },
    { company: 'Figma Inc', title: 'Software Engineer, Editor', location: 'San Francisco, CA', salary: '$170k–$245k', type: 'swe', level: 'mid' as const, tags: ['TypeScript', 'Rust', 'WebAssembly'], desc: 'Build the design tool used by millions of designers. Work on the multiplayer editor engine, rendering pipeline, and developer platform.' },
    { company: 'Notion Labs Inc', title: 'Software Engineer, Platform', location: 'San Francisco, CA', salary: '$165k–$240k', type: 'swe', level: 'mid' as const, tags: ['TypeScript', 'Node.js', 'React'], desc: 'Build the all-in-one workspace used by millions of teams. Work on the collaborative editor, API platform, and mobile apps.' },
    { company: 'Vercel Inc', title: 'Software Engineer, Infrastructure', location: 'Remote', salary: '$160k–$230k', type: 'swe', level: 'mid' as const, tags: ['TypeScript', 'Rust', 'Kubernetes'], desc: 'Build the platform that deploys millions of web applications. Work on edge functions, build systems, and global CDN infrastructure.' },
    // Data
    { company: 'Google LLC', title: 'Data Scientist, Product Analytics', location: 'Mountain View, CA', salary: '$175k–$255k', type: 'data', level: 'mid' as const, tags: ['Python', 'SQL', 'ML'], desc: 'Drive product decisions for Google\'s core products using data. Build experiments, causal models, and metrics frameworks.' },
    { company: 'Meta Platforms Inc', title: 'Data Scientist, Core Analytics', location: 'Menlo Park, CA', salary: '$168k–$238k', type: 'data', level: 'mid' as const, tags: ['Python', 'SQL', 'Spark'], desc: 'Measure and improve Facebook and Instagram products for 3B users. Own A/B testing, causal inference, and metric design.' },
    { company: 'Amazon.com Inc', title: 'Data Scientist II, Supply Chain', location: 'Seattle, WA', salary: '$148k–$208k', type: 'data', level: 'mid' as const, tags: ['Python', 'SQL', 'ML'], desc: 'Optimize Amazon\'s global supply chain with machine learning and statistics. Build forecasting and optimization models at scale.' },
    { company: 'Databricks Inc', title: 'Senior Data Engineer', location: 'San Francisco, CA', salary: '$178k–$248k', type: 'data', level: 'senior' as const, tags: ['Spark', 'Python', 'SQL'], desc: 'Build the data lakehouse infrastructure used by leading data teams. Work on Delta Lake, Apache Spark, and real-time streaming.' },
    { company: 'Snowflake Inc', title: 'Data Engineer', location: 'San Mateo, CA', salary: '$162k–$228k', type: 'data', level: 'mid' as const, tags: ['SQL', 'Python', 'AWS'], desc: 'Help customers build scalable data platforms on Snowflake. Work on data modeling, ETL pipelines, and cloud data architecture.' },
    { company: 'Palantir Technologies', title: 'Data Engineer, Forward Deployed', location: 'New York, NY', salary: '$155k–$220k', type: 'data', level: 'mid' as const, tags: ['Python', 'Spark', 'SQL'], desc: 'Solve complex data challenges for the world\'s most important organizations. Embedded data engineering with Fortune 100 clients.' },
    { company: 'Tableau Software LLC', title: 'Senior Data Analyst, Product', location: 'Seattle, WA', salary: '$140k–$200k', type: 'data', level: 'senior' as const, tags: ['SQL', 'Python', 'Tableau'], desc: 'Drive data-informed product decisions for Tableau\'s analytics platform. Own executive dashboards, cohort analysis, and growth metrics.' },
    // ML/AI
    { company: 'OpenAI', title: 'Machine Learning Engineer', location: 'San Francisco, CA', salary: '$200k–$300k', type: 'ml', level: 'mid' as const, tags: ['Python', 'PyTorch', 'LLM/AI'], desc: 'Train and deploy the world\'s most capable AI systems. Work on GPT-5, DALL-E, and next-generation foundation models.' },
    { company: 'Google LLC', title: 'Research Scientist, DeepMind', location: 'Mountain View, CA', salary: '$198k–$298k', type: 'ml', level: 'senior' as const, tags: ['Python', 'JAX', 'ML/DL'], desc: 'Advance the state of AI research. Work on reinforcement learning, language models, and scientific AI applications.' },
    { company: 'NVIDIA Corporation', title: 'Deep Learning Engineer', location: 'Santa Clara, CA', salary: '$192k–$285k', type: 'ml', level: 'mid' as const, tags: ['Python', 'CUDA', 'ML/DL'], desc: 'Build ML frameworks and optimizations that power AI at global scale. Work on GPU kernels, inference optimization, and LLM deployment.' },
    { company: 'Anthropic PBC', title: 'Research Engineer, Safety', location: 'San Francisco, CA', salary: '$210k–$310k', type: 'ml', level: 'mid' as const, tags: ['Python', 'PyTorch', 'LLM/AI'], desc: 'Build safe, beneficial AI systems. Work on Constitutional AI, RLHF, and interpretability research.' },
    { company: 'Scale AI Inc', title: 'ML Engineer, Foundation Models', location: 'San Francisco, CA', salary: '$180k–$260k', type: 'ml', level: 'mid' as const, tags: ['Python', 'PyTorch', 'LLM/AI'], desc: 'Accelerate AI development for leading frontier labs. Build data pipelines and training infrastructure for large language models.' },
    { company: 'Hugging Face Inc', title: 'Machine Learning Engineer', location: 'Remote (US)', salary: '$170k–$250k', type: 'ml', level: 'mid' as const, tags: ['Python', 'PyTorch', 'LLM/AI'], desc: 'Build the GitHub of ML. Develop open-source tools, model hosting, and Transformers library features for 1M+ researchers.' },
    // PM
    { company: 'Google LLC', title: 'Product Manager, Search', location: 'Mountain View, CA', salary: '$165k–$245k', type: 'pm', level: 'mid' as const, tags: ['ML', 'SQL'], desc: 'Define the future of Google Search for billions of users. Lead cross-functional teams to ship AI-powered search experiences.' },
    { company: 'Meta Platforms Inc', title: 'Product Manager, Instagram Growth', location: 'Menlo Park, CA', salary: '$172k–$242k', type: 'pm', level: 'mid' as const, tags: ['SQL', 'ML'], desc: 'Drive user acquisition and engagement for Instagram\'s 2B users. Own the full product lifecycle from discovery to launch.' },
    { company: 'Amazon.com Inc', title: 'Senior Product Manager, AWS', location: 'Seattle, WA', salary: '$158k–$218k', type: 'pm', level: 'senior' as const, tags: ['AWS', 'SQL'], desc: 'Define and launch AWS services used by millions of developers. Own product vision, roadmap, and GTM for cloud infrastructure products.' },
    { company: 'Stripe Inc', title: 'Product Manager, Developer Platform', location: 'San Francisco, CA', salary: '$170k–$240k', type: 'pm', level: 'mid' as const, tags: ['SQL', 'GraphQL'], desc: 'Build the platform that powers Stripe\'s developer ecosystem. Own APIs, SDKs, and developer experience for 500k+ businesses.' },
    // DevOps/Cloud
    { company: 'Google LLC', title: 'Site Reliability Engineer', location: 'Sunnyvale, CA', salary: '$178k–$265k', type: 'devops', level: 'mid' as const, tags: ['Go', 'Kubernetes', 'GCP'], desc: 'Ensure reliability of Google services at global scale. Build automation, monitor SLOs, and respond to incidents for 99.999% uptime.' },
    { company: 'Amazon.com Inc', title: 'Cloud Support Engineer, AWS', location: 'Seattle, WA', salary: '$140k–$200k', type: 'devops', level: 'entry' as const, tags: ['AWS', 'Kubernetes', 'Docker'], desc: 'Help enterprise customers architect solutions on AWS. Debug complex cloud infrastructure issues and build automation tooling.' },
    { company: 'Datadog Inc', title: 'Software Engineer, Infrastructure', location: 'New York, NY (Remote OK)', salary: '$160k–$230k', type: 'devops', level: 'mid' as const, tags: ['Go', 'Kubernetes', 'AWS'], desc: 'Build the monitoring platform used by 27k+ companies. Work on distributed tracing, metrics collection, and cloud-native infrastructure.' },
    { company: 'HashiCorp Inc', title: 'Senior Software Engineer, Terraform', location: 'Remote (US)', salary: '$168k–$240k', type: 'devops', level: 'senior' as const, tags: ['Go', 'Kubernetes', 'AWS'], desc: 'Build Terraform, the world\'s most widely-used infrastructure-as-code tool. Work on providers, state management, and cloud integrations.' },
    // Security
    { company: 'CrowdStrike Inc', title: 'Software Engineer, Detection', location: 'Sunnyvale, CA', salary: '$158k–$225k', type: 'security', level: 'mid' as const, tags: ['Go', 'Python', 'Distributed'], desc: 'Build AI-powered threat detection for the world\'s leading cybersecurity platform. Protect 20k+ organizations from advanced threats.' },
    { company: 'Palo Alto Networks', title: 'Software Engineer, Cloud Security', location: 'Santa Clara, CA', salary: '$165k–$235k', type: 'security', level: 'mid' as const, tags: ['Python', 'Kubernetes', 'AWS'], desc: 'Build next-gen cloud security products used by Fortune 100. Work on CSPM, CWPP, and AI-driven threat intelligence.' },
    // Internships
    { company: 'Google LLC', title: 'Software Engineering Intern, Summer 2025', location: 'Mountain View, CA', salary: '$8k–$10k/mo', type: 'intern', level: 'entry' as const, tags: ['Python', 'Go', 'Distributed'], desc: 'Join Google for a 12-week engineering internship. Work on real products alongside full-time engineers with mentorship and return offer opportunity.' },
    { company: 'Meta Platforms Inc', title: 'Software Engineering Intern', location: 'Menlo Park, CA', salary: '$8k–$9k/mo', type: 'intern', level: 'entry' as const, tags: ['Python', 'React', 'SQL'], desc: 'Build real products impacting billions of people. Get mentorship, competitive pay, and housing stipend. OPT/CPT friendly.' },
    { company: 'Microsoft Corporation', title: 'Software Engineering Intern', location: 'Redmond, WA (Hybrid)', salary: '$7k–$8.5k/mo', type: 'intern', level: 'entry' as const, tags: ['TypeScript', 'Azure', 'C#'], desc: 'Intern on real Microsoft products with full-time mentorship. Strong CPT/OPT history with many international interns each year.' },
    { company: 'Amazon.com Inc', title: 'SDE Intern, Summer 2025', location: 'Seattle, WA', salary: '$7.5k–$9k/mo', type: 'intern', level: 'entry' as const, tags: ['Java', 'AWS', 'SQL'], desc: 'Own a complete project end-to-end. Work with AWS services, write production code, and present to senior leadership.' },
    { company: 'Apple Inc', title: 'Software Engineering Intern', location: 'Cupertino, CA', salary: '$7k–$9k/mo', type: 'intern', level: 'entry' as const, tags: ['Swift', 'Python', 'iOS'], desc: 'Work on products used by a billion people. Apple actively sponsors CPT for qualifying internships. Relocation and housing provided.' },
    // Additional SWE
    { company: 'Palantir Technologies', title: 'Software Engineer, Backend', location: 'New York, NY', salary: '$170k–$240k', type: 'swe', level: 'mid' as const, tags: ['Go', 'Python', 'Distributed'], desc: 'Build Palantir Foundry and AIP — the data platforms powering defense, finance, and healthcare. Strong H1B sponsorship track record with dedicated immigration support.' },
    { company: 'Coinbase Inc', title: 'Software Engineer, Backend', location: 'Remote (US)', salary: '$175k–$245k', type: 'swe', level: 'mid' as const, tags: ['Go', 'Python', 'AWS'], desc: 'Build the financial infrastructure of the crypto economy. Work on custody, trading, and blockchain systems serving 100M+ customers. Actively sponsors H1B and OPT.' },
    { company: 'Block Inc', title: 'Software Engineer, Payments', location: 'San Francisco, CA', salary: '$165k–$235k', type: 'swe', level: 'mid' as const, tags: ['Kotlin', 'Java', 'Go'], desc: 'Build the financial tools that power small businesses and peer-to-peer payments at Cash App and Square. Known for sponsoring international engineers.' },
    { company: 'Reddit Inc', title: 'Software Engineer, Core Platform', location: 'San Francisco, CA (Remote OK)', salary: '$162k–$228k', type: 'swe', level: 'mid' as const, tags: ['Python', 'Go', 'AWS'], desc: 'Scale the platform serving 1.5B monthly users. Work on real-time feeds, content recommendation, and distributed infrastructure. International-friendly hiring.' },
    { company: 'Pinterest Inc', title: 'Software Engineer, Recommendation', location: 'San Francisco, CA', salary: '$158k–$225k', type: 'swe', level: 'mid' as const, tags: ['Python', 'React', 'AWS'], desc: 'Build the personalization and discovery systems for 450M monthly Pinners. Work on ML-driven recommendations, visual search, and ad ranking algorithms.' },
    { company: 'Robinhood', title: 'Software Engineer, Trading Systems', location: 'Menlo Park, CA (Hybrid)', salary: '$160k–$230k', type: 'swe', level: 'mid' as const, tags: ['Python', 'Go', 'Distributed'], desc: 'Build the real-time trading infrastructure for 20M+ users. Work on order execution, market data, and risk systems. F1/OPT applicants welcome.' },
    { company: 'Twilio Inc', title: 'Software Engineer, Platform', location: 'San Francisco, CA (Remote)', salary: '$158k–$222k', type: 'swe', level: 'mid' as const, tags: ['Java', 'AWS', 'Node.js'], desc: 'Build the communications API platform used by 280k+ businesses. Work on SMS, voice, video, and email infrastructure at massive scale.' },
    // Additional Data
    { company: 'Airbnb Inc', title: 'Data Scientist, Trust & Safety', location: 'San Francisco, CA', salary: '$172k–$242k', type: 'data', level: 'mid' as const, tags: ['Python', 'SQL', 'ML'], desc: 'Use ML and causal inference to protect 400M Airbnb guests and hosts from fraud, scams, and bad actors. Build models that make the platform safer.' },
    { company: 'Lyft Inc', title: 'Senior Data Scientist, Marketplace', location: 'San Francisco, CA (Hybrid)', salary: '$175k–$248k', type: 'data', level: 'senior' as const, tags: ['Python', 'SQL', 'Spark'], desc: 'Own pricing, dispatch, and incentive analytics for Lyft\'s marketplace. Drive business decisions with causal modeling, A/B testing, and ML forecasting.' },
    { company: 'Instacart', title: 'Data Scientist, Growth', location: 'San Francisco, CA', salary: '$158k–$225k', type: 'data', level: 'mid' as const, tags: ['Python', 'SQL', 'ML'], desc: 'Drive user acquisition and retention analytics for the leading grocery delivery platform. Build experiments and ML models that impact millions of shoppers.' },
    // Additional ML
    { company: 'Cohere Inc', title: 'ML Engineer, Foundation Models', location: 'Remote (US)', salary: '$185k–$265k', type: 'ml', level: 'mid' as const, tags: ['Python', 'PyTorch', 'LLM/AI'], desc: 'Build enterprise LLMs that power the next generation of AI applications. Work on training, fine-tuning, and deployment of large language models at global scale.' },
    { company: 'Mistral AI', title: 'Research Engineer', location: 'San Francisco, CA', salary: '$190k–$280k', type: 'ml', level: 'mid' as const, tags: ['Python', 'PyTorch', 'LLM/AI'], desc: 'Build open-source frontier models that are the most capable in the world. Join a world-class research team pushing the boundaries of language model efficiency.' },
    { company: 'Together AI', title: 'ML Engineer, Inference', location: 'San Francisco, CA', salary: '$175k–$250k', type: 'ml', level: 'mid' as const, tags: ['Python', 'CUDA', 'ML/DL'], desc: 'Build the fastest inference infrastructure for open-source LLMs. Work on GPU kernels, quantization, and distributed serving systems for billion-parameter models.' },
    // Additional DevOps
    { company: 'GitLab Inc', title: 'Site Reliability Engineer', location: 'Remote (US)', salary: '$152k–$215k', type: 'devops', level: 'mid' as const, tags: ['Go', 'Kubernetes', 'GCP'], desc: 'Keep GitLab.com running for 30M+ users as a remote-first, fully distributed company. Work on Kubernetes, observability, and incident response at scale.' },
    { company: 'Cloudflare Inc', title: 'Production Engineer, Edge', location: 'Austin, TX', salary: '$158k–$225k', type: 'devops', level: 'mid' as const, tags: ['Go', 'Rust', 'Distributed'], desc: 'Keep Cloudflare\'s global network running across 300+ cities. Work on edge infrastructure, traffic engineering, and automated operations systems.' },
    // Additional Internships
    { company: 'OpenAI', title: 'Research Engineer Intern', location: 'San Francisco, CA', salary: '$9k–$12k/mo', type: 'intern', level: 'entry' as const, tags: ['Python', 'PyTorch', 'LLM/AI'], desc: 'Work on GPT-5, DALL-E, and next-generation AI systems alongside world-class researchers. OPT/CPT eligible. One of the most sought-after AI internships globally.' },
    { company: 'NVIDIA Corporation', title: 'Deep Learning Engineer Intern', location: 'Santa Clara, CA', salary: '$8k–$10k/mo', type: 'intern', level: 'entry' as const, tags: ['Python', 'CUDA', 'ML/DL'], desc: 'Work on GPU kernels, deep learning frameworks, and AI inference optimization. NVIDIA has a long history of sponsoring F1/OPT students and H1B workers.' },
    { company: 'Stripe Inc', title: 'Software Engineering Intern', location: 'San Francisco, CA', salary: '$8k–$9.5k/mo', type: 'intern', level: 'entry' as const, tags: ['Ruby', 'Go', 'SQL'], desc: 'Build real payment infrastructure used by millions of businesses during your internship. Stripe has an excellent OPT/CPT program and strong return offer rate.' },
    { company: 'Databricks Inc', title: 'Software Engineering Intern', location: 'San Francisco, CA', salary: '$8.5k–$11k/mo', type: 'intern', level: 'entry' as const, tags: ['Scala', 'Python', 'Spark'], desc: 'Work on Spark, Delta Lake, and the Databricks Lakehouse platform alongside the creators of Apache Spark. One of the highest-paying ML/data internships available.' },
    { company: 'Salesforce Inc', title: 'Software Engineer Intern', location: 'San Francisco, CA (Hybrid)', salary: '$7k–$9k/mo', type: 'intern', level: 'entry' as const, tags: ['Java', 'Python', 'AWS'], desc: 'Build Einstein AI and CRM features used by Fortune 500 companies. Salesforce has a well-established CPT/OPT program and sponsors thousands of H1B petitions annually.' },
  ];

  const rankJob = (j: typeof ALL_JOBS[0]): number => {
    let score = 0;
    if (isML && j.type === 'ml') score += 100;
    else if (isData && j.type === 'data') score += 100;
    else if (isPM && j.type === 'pm') score += 100;
    else if (isDevOps && j.type === 'devops') score += 100;
    else if (isSecurity && j.type === 'security') score += 100;
    else if (!isML && !isData && !isPM && !isDevOps && !isSecurity && j.type === 'swe') score += 100;

    const qWords = q.split(/\s+/).filter(w => w.length > 3);
    for (const word of qWords) {
      if (j.title.toLowerCase().includes(word)) score += 20;
      if (j.tags.some(t => t.toLowerCase().includes(word))) score += 10;
    }
    return score;
  };

  const companies = findAll<any>('h1b_companies');
  return ALL_JOBS
    .sort((a, b) => rankJob(b) - rankJob(a))
    .map((j, idx) => {
      const h1bCo = companies.find((c: any) => c.name === j.company);
      const daysAgo = idx * 0.3;
      return {
        id: `curated-${idx}`,
        title: j.title,
        company: j.company,
        location: j.location,
        locationType: j.location.toLowerCase().includes('remote') ? 'remote' as const : 'onsite' as const,
        description: j.desc,
        postedAt: new Date(Date.now() - daysAgo * 24 * 3600000).toISOString(),
        jobType: j.type === 'intern' ? 'internship' as const : 'full-time' as const,
        experienceLevel: j.level,
        salary: j.salary,
        applyUrl: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(j.title + ' ' + j.company)}`,
        source: 'LinkedIn',
        sponsorsH1b: !!h1bCo,
        h1bApprovalRate: h1bCo?.approval_rate,
        h1bPetitions: h1bCo?.total_petitions,
        h1bAvgSalary: h1bCo?.avg_salary,
        tags: j.tags,
      } satisfies JobListing;
    });
}

// ─── Routes ──────────────────────────────────────────────────────────────────
// ─── Shared job-gathering pipeline (LinkedIn-only → curated fallback, cached) ──
async function gatherJobs(
  q: string,
  location: string,
  filters: JobFilters = {}
): Promise<{ jobs: JobListing[]; source: string }> {
  const cacheKey = `${q}|${location}|${filters.datePosted || ''}|${filters.remote ? 'r' : ''}|${filters.jobType || ''}|${filters.expLevel || ''}`.toLowerCase();
  const cached = rawGet('job_cache', cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { jobs: cached.jobs as JobListing[], source: cached.source };
  }

  let jobs: JobListing[] = [];
  let source = 'curated';

  // Primary — LinkedIn guest jobs (real postings, multi-page, server-side filters).
  // Works great from residential IPs; cloud/datacenter IPs are often blocked.
  try {
    const liJobs = await fetchLinkedInJobs(q, location, filters);
    if (liJobs.length >= 3) {
      jobs = enrichWithH1B(liJobs);
      source = 'linkedin';
    }
  } catch { /* blocked or rate-limited */ }

  // Fallback #1 — JSearch (RapidAPI). Real, fresh postings that work from the
  // cloud, so the DEPLOYED app always shows real jobs even when LinkedIn blocks
  // the datacenter IP. Many results are LinkedIn-sourced; aggregator prefixes
  // ("Jobs via …") are stripped in mapJSearchJob.
  if (!jobs.length) {
    const jsDate =
      filters.datePosted === '1h' || filters.datePosted === '5h' || filters.datePosted === '24h' ? 'today' :
      filters.datePosted === '3days' || filters.datePosted === '5days' ? '3days' :
      filters.datePosted === 'week' ? 'week' :
      filters.datePosted === 'month' ? 'month' : 'all';
    try {
      const jsJobs = await fetchJSearchJobs(q, location, 1, jsDate);
      if (jsJobs.length >= 3) {
        jobs = enrichWithH1B(jsJobs);
        source = 'jsearch';
      }
    } catch { /* no RapidAPI key or quota exhausted */ }
  }

  // Fallback #2 — curated set so the app always renders something
  if (!jobs.length) {
    jobs = getCuratedJobs(q);
    source = 'curated';
  }

  rawSet('job_cache', cacheKey, { jobs, fetchedAt: Date.now(), source });
  return { jobs, source };
}

function parseFilters(qs: Record<string, string>): JobFilters {
  return {
    datePosted: qs.datePosted || qs.postedWithin || '',
    remote: qs.remote === 'true',
    jobType: qs.jobType || '',
    expLevel: qs.expLevel || '',
  };
}

router.get('/search', async (req: AuthRequest, res: Response) => {
  const qs = req.query as Record<string, string>;
  const { q = 'software engineer', location = 'United States', h1bOnly, salaryMin } = qs;
  const filters = parseFilters(qs);

  let { jobs, source } = await gatherJobs(q, location, filters);

  // Score against user profile
  const userProfile = findOne<any>('users', (u: any) => u.id === req.user!.id);
  jobs = scoreResumeMatch(jobs, userProfile);

  // Filters LinkedIn can't do server-side
  if (h1bOnly === 'true') jobs = jobs.filter(j => j.sponsorsH1b);
  if (salaryMin) {
    const minSal = parseInt(salaryMin);
    jobs = jobs.filter(j => !j.salaryMin || j.salaryMin >= minSal);
  }
  // If LinkedIn returned curated fallback, apply remote/type/exp client-side
  if (source === 'curated') {
    if (filters.remote) jobs = jobs.filter(j => j.locationType === 'remote');
    if (filters.jobType) jobs = jobs.filter(j => j.jobType === filters.jobType);
    if (filters.expLevel) {
      // Map expanded LinkedIn-style levels to the JobListing experienceLevel values
      const expMap: Record<string, JobListing['experienceLevel'][]> = {
        internship: ['entry'],
        entry:      ['entry'],
        associate:  ['entry', 'mid'],
        mid:        ['mid'],
        senior:     ['senior'],
        director:   ['director'],
        executive:  ['director'],
      };
      const allowed = expMap[filters.expLevel] ?? [filters.expLevel as JobListing['experienceLevel']];
      jobs = jobs.filter(j => allowed.includes(j.experienceLevel));
    }
  }

  res.json({ jobs, total: jobs.length, source });
});

router.get('/trending', (_req: AuthRequest, res: Response) => {
  res.json([
    { role: 'AI/ML Engineer', count: 28420, growth: '+52%', avgSalary: 198000 },
    { role: 'Software Engineer', count: 42380, growth: '+12%', avgSalary: 178000 },
    { role: 'Data Scientist', count: 18940, growth: '+18%', avgSalary: 162000 },
    { role: 'DevOps/SRE', count: 15820, growth: '+28%', avgSalary: 172000 },
    { role: 'Product Manager', count: 12480, growth: '+8%', avgSalary: 165000 },
    { role: 'Data Engineer', count: 10820, growth: '+30%', avgSalary: 168000 },
    { role: 'Security Engineer', count: 9840, growth: '+22%', avgSalary: 175000 },
    { role: 'Cloud Architect', count: 8920, growth: '+20%', avgSalary: 185000 },
  ]);
});

// ─── Outreach automation: recruiter + alumni deep-links & CSV export ─────────

/** LinkedIn people-search deep link that lands on recruiters at a company. */
function recruiterSearchUrl(company: string): string {
  const kw = `${company} recruiter OR "talent acquisition" OR "technical recruiter"`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}&origin=GLOBAL_SEARCH_HEADER`;
}

/** LinkedIn people-search deep link that lands on alumni from the user's school at a company. */
function alumniSearchUrl(company: string, university: string): string {
  const kw = university ? `${company} ${university}` : company;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(kw)}&origin=GLOBAL_SEARCH_HEADER`;
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function buildOutreachCsv(jobs: JobListing[], university: string): string {
  const headers = [
    '#', 'Posted', 'Company', 'Role', 'Location', 'Work Type', 'Salary',
    'H1B Sponsor', 'H1B Approval %', 'Match %', 'Apply Link',
    'Recruiter Search (LinkedIn)', `Alumni Search${university ? ` — ${university}` : ''} (LinkedIn)`,
    'Status', 'Notes',
  ];
  const rows = jobs.map((j, i) => [
    i + 1,
    new Date(j.postedAt).toISOString().slice(0, 16).replace('T', ' '),
    j.company,
    j.title,
    j.location,
    j.locationType,
    j.salary || '',
    j.sponsorsH1b ? 'Yes' : 'Unknown',
    j.h1bApprovalRate != null ? `${j.h1bApprovalRate}%` : '',
    j.resumeMatchScore != null ? `${j.resumeMatchScore}%` : '',
    j.applyUrl,
    recruiterSearchUrl(j.company),
    alumniSearchUrl(j.company, university),
    'To Apply',
    '',
  ]);
  return [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
}

/** Generates a short, friendly recruiter outreach message for a job. */
function buildOutreachMessage(job: JobListing, university: string): string {
  const uniLine = university ? ` I'm currently studying at ${university}` : '';
  return [
    `Hi,`,
    ``,
    `I came across the ${job.title} role at ${job.company} and I'm really excited about the opportunity. My background aligns well with the position${job.tags.length ? ` — I have hands-on experience with ${job.tags.slice(0, 3).join(', ')}` : ''}.${uniLine} and I'm on an F1 visa with OPT authorization, so I'm eligible to work full-time now and would be grateful for sponsorship support down the road.`,
    ``,
    `I'd love to connect and learn more about the team. Would you be open to a quick 15-minute chat?`,
    ``,
    `Thanks so much for your time!`,
  ].join('\n');
}

/**
 * GET /api/job-discovery/export
 * Builds a ready-to-action outreach sheet: the freshest matching roles plus a
 * clickable LinkedIn recruiter search and alumni search for every company, so
 * you open the CSV, click through, apply, and track — all in one place.
 *
 * Query: q, location, postedWithin (1h|today|3days|week|month), limit,
 *        h1bOnly, remote, jobType, expLevel, salaryMin, format (csv|json)
 */
router.get('/export', async (req: AuthRequest, res: Response) => {
  const {
    q = 'software engineer',
    location = 'United States',
    postedWithin = 'today',
    limit = '25',
    h1bOnly, remote, jobType, expLevel, salaryMin,
    format = 'csv',
  } = req.query as Record<string, string>;

  const datePosted =
    postedWithin === '1h'    ? '1h' :
    postedWithin === '5h'    ? '5h' :
    postedWithin === 'today' ? '24h' :
    postedWithin === '3days' ? '3days' :
    postedWithin === '5days' ? '5days' :
    postedWithin === 'week'  ? 'week' : 'month';

  const filters: JobFilters = {
    datePosted,
    remote: remote === 'true',
    jobType: jobType || '',
    expLevel: expLevel || '',
  };
  let { jobs, source } = await gatherJobs(q, location, filters);

  const userProfile = findOne<any>('users', (u: any) => u.id === req.user!.id);
  jobs = scoreResumeMatch(jobs, userProfile);

  if (h1bOnly === 'true') jobs = jobs.filter(j => j.sponsorsH1b);
  if (salaryMin) {
    const minSal = parseInt(salaryMin);
    jobs = jobs.filter(j => !j.salaryMin || j.salaryMin >= minSal);
  }

  // Freshest first; narrow to exact window if a short-range filter is active.
  jobs = jobs.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
  const shortWindowMs: Record<string, number> = { '1h': 3600000, '5h': 18000000 };
  if (postedWithin in shortWindowMs) {
    const cutoff = Date.now() - shortWindowMs[postedWithin];
    const fresh = jobs.filter(j => new Date(j.postedAt).getTime() >= cutoff);
    if (fresh.length) jobs = fresh;
  }
  jobs = jobs.slice(0, Math.min(parseInt(limit) || 25, 50));

  const university = userProfile?.university || '';

  if (format === 'json') {
    return res.json({
      total: jobs.length,
      source,
      university,
      rows: jobs.map(j => ({
        ...j,
        recruiterSearchUrl: recruiterSearchUrl(j.company),
        alumniSearchUrl: alumniSearchUrl(j.company, university),
        outreachMessage: buildOutreachMessage(j, university),
      })),
    });
  }

  const csv = '﻿' + buildOutreachCsv(jobs, university); // BOM for Excel
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="f1forge-outreach-${stamp}.csv"`);
  res.send(csv);
});

export default router;
