/**
 * Tests for the /api/practice routes.
 *
 * Key scenario:  GET /api/practice/problems when the external LeetCode fetch
 * fails → server must fall back to the curated FALLBACK_PROBLEMS set.
 *
 * All external network calls (LeetCode API) are mocked with jest.spyOn so
 * the suite runs fully offline and deterministically.
 */

import request from 'supertest';
import app from '../app';

// ─── Helper: register a user and get a token ──────────────────────────────────

let authToken: string;
const suffix = Date.now();

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `practice-${suffix}@test.io`, password: 'Passw0rd!', firstName: 'Dev', lastName: 'Test' });
  authToken = res.body.token;
});

// ─── GET /api/practice/problems — offline fallback ────────────────────────────

describe('GET /api/practice/problems (LeetCode unreachable → fallback)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    // Make every fetch call reject to simulate being offline / LeetCode down
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('Network error — fetch mocked offline'));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns HTTP 200 even when LeetCode fetch fails', async () => {
    const res = await request(app)
      .get('/api/practice/problems')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('falls back to source="fallback" when offline', async () => {
    const res = await request(app)
      .get('/api/practice/problems')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.body.source).toBe('fallback');
  });

  it('includes the FALLBACK_PROBLEMS curated set', async () => {
    const res = await request(app)
      .get('/api/practice/problems')
      .set('Authorization', `Bearer ${authToken}`);
    expect(Array.isArray(res.body.problems)).toBe(true);
    expect(res.body.problems.length).toBeGreaterThanOrEqual(5);
  });

  it('each fallback problem has required fields', async () => {
    const res = await request(app)
      .get('/api/practice/problems')
      .set('Authorization', `Bearer ${authToken}`);
    for (const p of res.body.problems) {
      expect(p.slug).toBeDefined();
      expect(p.title).toBeDefined();
      expect(['Easy', 'Medium', 'Hard']).toContain(p.difficulty);
    }
  });

  it('known curated problem "two-sum" is present in fallback', async () => {
    const res = await request(app)
      .get('/api/practice/problems')
      .set('Authorization', `Bearer ${authToken}`);
    const slugs = res.body.problems.map((p: any) => p.slug);
    expect(slugs).toContain('two-sum');
  });

  it('response includes a languages array', async () => {
    const res = await request(app)
      .get('/api/practice/problems')
      .set('Authorization', `Bearer ${authToken}`);
    expect(Array.isArray(res.body.languages)).toBe(true);
    expect(res.body.languages.length).toBeGreaterThan(0);
  });

  it('requires authentication (401 without token)', async () => {
    const res = await request(app).get('/api/practice/problems');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/practice/topics — always static ─────────────────────────────────

describe('GET /api/practice/topics', () => {
  it('returns the canonical topic list', async () => {
    const res = await request(app)
      .get('/api/practice/topics')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.topics)).toBe(true);
    expect(res.body.topics.length).toBeGreaterThan(10);
    const first = res.body.topics[0];
    expect(first.slug).toBeDefined();
    expect(first.label).toBeDefined();
  });
});

// ─── GET /api/practice/problem/:slug — curated slug ───────────────────────────

describe('GET /api/practice/problem/:slug', () => {
  it('returns full detail for a curated featured problem', async () => {
    const res = await request(app)
      .get('/api/practice/problem/valid-parentheses')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Valid Parentheses');
    expect(res.body.featured).toBe(true);
    expect(res.body.starter).toBeDefined();
    expect(res.body.starter.javascript).toBeDefined();
  });

  it('returns hints and examples for "binary-search"', async () => {
    const res = await request(app)
      .get('/api/practice/problem/binary-search')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.hints)).toBe(true);
    expect(res.body.hints.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.examples)).toBe(true);
    expect(res.body.examples.length).toBeGreaterThan(0);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/practice/problem/two-sum');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/practice/run — validation ──────────────────────────────────────

describe('POST /api/practice/run', () => {
  it('returns 400 for an unsupported language', async () => {
    const res = await request(app)
      .post('/api/practice/run')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ language: 'cobol', source: 'STOP RUN', stdin: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported/i);
  });

  it('returns 400 when source is empty', async () => {
    const res = await request(app)
      .post('/api/practice/run')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ language: 'python', source: '', stdin: '' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/practice/run')
      .send({ language: 'python', source: 'print("hi")', stdin: '' });
    expect(res.status).toBe(401);
  });
});
