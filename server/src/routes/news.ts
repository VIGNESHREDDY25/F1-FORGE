import { Router, Response } from 'express';
import Parser from 'rss-parser';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rawGet, rawSet } from '../db/store';

const router = Router();
router.use(authenticate);

const rss = new Parser({ timeout: 6000, headers: { 'User-Agent': 'F1Forge/1.0 (+https://f1forge.app)' } });

const FEEDS = [
  // Immigration-specific (highest priority for F1 students)
  { url: 'https://www.uscis.gov/feeds/allnews.rss', category: 'Immigration', source: 'USCIS' },
  { url: 'https://immigrationforum.org/feed/', category: 'Immigration', source: 'Immigration Forum' },
  { url: 'https://boundless.com/blog/feed/', category: 'Immigration', source: 'Boundless' },
  { url: 'http://www.ilw.com/immigrationdaily/headlines/rss.xml', category: 'Immigration', source: 'ILW Daily' },
  { url: 'https://www.uscis.gov/feeds/news.rss', category: 'Immigration', source: 'USCIS News' },
  { url: 'https://www.murthy.com/feed/', category: 'Immigration', source: 'Murthy Law' },
  { url: 'https://www.visaverge.com/feed/', category: 'Immigration', source: 'VisaVerge' },
  { url: 'https://immigrationimpact.com/feed/', category: 'Immigration', source: 'Immigration Impact' },
  { url: 'https://www.aila.org/feeds/news', category: 'Immigration', source: 'AILA' },
  // Tech career / hiring news
  { url: 'https://techcrunch.com/feed/', category: 'Tech', source: 'TechCrunch' },
  { url: 'https://techcrunch.com/category/jobs/feed/', category: 'Tech Jobs', source: 'TC Jobs' },
  { url: 'https://venturebeat.com/feed/', category: 'AI/Tech', source: 'VentureBeat' },
  { url: 'https://www.infoq.com/feed/', category: 'Tech Jobs', source: 'InfoQ' },
  { url: 'https://dev.to/feed', category: 'Tech Jobs', source: 'DEV' },
  { url: 'https://hnrss.org/frontpage', category: 'Tech Jobs', source: 'Hacker News' },
  { url: 'https://github.blog/feed/', category: 'Tech Jobs', source: 'GitHub' },
  // AI / Tech
  { url: 'https://www.theverge.com/rss/index.xml', category: 'AI/Tech', source: 'The Verge' },
  { url: 'https://www.wired.com/feed/rss', category: 'AI/Tech', source: 'Wired' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'AI/Tech', source: 'BBC Tech' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', category: 'AI/Tech', source: 'NYT Tech' },
  { url: 'https://www.artificialintelligence-news.com/feed/', category: 'AI/Tech', source: 'AI News' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'AI/Tech', source: 'Ars Technica' },
  { url: 'https://www.technologyreview.com/feed/', category: 'AI/Tech', source: 'MIT Tech Review' },
  // Security (was missing entirely)
  { url: 'https://feeds.feedburner.com/TheHackersNews', category: 'Security', source: 'The Hacker News' },
  { url: 'https://www.bleepingcomputer.com/feed/', category: 'Security', source: 'BleepingComputer' },
  { url: 'https://krebsonsecurity.com/feed/', category: 'Security', source: 'Krebs on Security' },
  { url: 'https://www.darkreading.com/rss.xml', category: 'Security', source: 'Dark Reading' },
  { url: 'https://www.csoonline.com/feed/', category: 'Security', source: 'CSO Online' },
  // Career & business
  { url: 'http://feeds.hbr.org/harvardbusiness', category: 'Career', source: 'HBR' },
  { url: 'https://www.fastcompany.com/section/careers/rss', category: 'Career', source: 'Fast Company' },
  { url: 'https://www.themuse.com/rss/advice', category: 'Career', source: 'The Muse' },
  { url: 'https://hbr.org/topic/careers/rss', category: 'Career', source: 'HBR Careers' },
  { url: 'https://feeds.feedburner.com/Glassdoor', category: 'Career', source: 'Glassdoor' },
];

const SOURCE_ICONS: Record<string, string> = {
  'USCIS': 'https://www.uscis.gov/favicon.ico',
  'Immigration Forum': 'https://immigrationforum.org/favicon.ico',
  'Boundless': 'https://boundless.com/favicon.ico',
  'ILW Daily': 'https://www.ilw.com/favicon.ico',
  'TechCrunch': 'https://techcrunch.com/favicon.ico',
  'TC Jobs': 'https://techcrunch.com/favicon.ico',
  'VentureBeat': 'https://venturebeat.com/favicon.ico',
  'InfoQ': 'https://www.infoq.com/favicon.ico',
  'HBR': 'https://hbr.org/favicon.ico',
  'The Verge': 'https://www.theverge.com/favicon.ico',
  'Wired': 'https://www.wired.com/favicon.ico',
  'BBC Tech': 'https://www.bbc.com/favicon.ico',
  'WSJ Tech': 'https://www.wsj.com/favicon.ico',
  'NYT Tech': 'https://www.nytimes.com/favicon.ico',
};

// High relevance (score 3) — core immigration terms
const HIGH_F1_KEYWORDS = [
  'h1b', 'h-1b', 'h1-b', 'f1 visa', 'f-1 visa', 'opt ', 'stem opt', 'cpt ',
  'uscis', 'green card', 'work authorization', 'work visa', 'sponsorship',
  'international student', 'foreign worker', 'skilled worker visa',
  'employment authorization', 'i-20', 'sevis', 'dso',
];

// Medium relevance (score 2) — immigration adjacent
const MED_F1_KEYWORDS = [
  'immigration', 'visa', 'visa policy', 'immigration reform', 'dol prevailing wage',
  'prevailing wage', 'workforce visa', 'talent visa', 'stem talent',
  'tech talent', 'foreign national', 'work permit',
];

// Low relevance (score 1) — career news useful to F1 students
const LOW_F1_KEYWORDS = [
  'layoff', 'hiring freeze', 'tech hiring', 'job market', 'salary negotiation',
  'offer letter', 'recruiting', 'tech jobs', 'software engineer job',
  'data scientist job', 'engineering job', 'remote job',
];

function getRelevanceScore(title: string, summary: string): 0 | 1 | 2 | 3 {
  const text = (title + ' ' + summary).toLowerCase();
  if (HIGH_F1_KEYWORDS.some(k => text.includes(k))) return 3;
  if (MED_F1_KEYWORDS.some(k => text.includes(k))) return 2;
  if (LOW_F1_KEYWORDS.some(k => text.includes(k))) return 1;
  return 0;
}

function resolveCategory(feedCategory: string, title: string, summary: string): string {
  const text = (title + ' ' + summary).toLowerCase();
  const isImmigration = [...HIGH_F1_KEYWORDS, ...MED_F1_KEYWORDS].some(k => text.includes(k));
  if (isImmigration) return 'Immigration';
  const isJobsNews = LOW_F1_KEYWORDS.some(k => text.includes(k));
  if (isJobsNews && feedCategory !== 'Immigration') return 'Tech Jobs';
  return feedCategory;
}

function extractImage(item: any): string | undefined {
  if (item['media:content']?.$.url) return item['media:content'].$.url;
  if (item['media:thumbnail']?.$.url) return item['media:thumbnail'].$.url;
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image')) return item.enclosure.url;
  const content = item['content:encoded'] || item.content || item.summary || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  return undefined;
}

function deduplicateByTitle(articles: any[]): any[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    const key = a.title.toLowerCase().slice(0, 60).trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchFeed(feed: typeof FEEDS[0]) {
  try {
    const parsed = await rss.parseURL(feed.url);
    return (parsed.items || []).slice(0, 22).map(item => {
      const title = item.title || 'Untitled';
      const summary = item.contentSnippet || item.summary || '';
      const relevanceScore = getRelevanceScore(title, summary);
      return {
        id: item.guid || item.link || `${feed.source}-${Math.random()}`,
        title,
        summary,
        url: item.link || '',
        image: extractImage(item),
        source: feed.source,
        sourceIcon: SOURCE_ICONS[feed.source],
        category: resolveCategory(feed.category, title, summary),
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        isF1Relevant: relevanceScore > 0,
        relevanceScore,
      };
    });
  } catch {
    return [];
  }
}

router.get('/', async (_req: AuthRequest, res: Response) => {
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  const cached = rawGet('news_cache', 'latest');

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return res.json(cached.articles);
  }

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const raw = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Quality filter: drop untitled/placeholder posts and anything older than ~1 year
  const now = Date.now();
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
  const cleaned = raw.filter(a => {
    const title = (a.title || '').trim();
    if (!title || /^untitled$/i.test(title) || /^protected:/i.test(title)) return false;
    const t = new Date(a.publishedAt).getTime();
    if (!Number.isNaN(t) && now - t > ONE_YEAR) return false;
    return true;
  });

  // Deduplicate, then sort: highest relevance first, then newest within each score bucket
  const articles = deduplicateByTitle(cleaned)
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, 100);

  rawSet('news_cache', 'latest', { articles, fetchedAt: Date.now() });
  res.json(articles);
});

export default router;
