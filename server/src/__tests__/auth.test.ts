/**
 * Tests for auth utilities (bcryptjs + jsonwebtoken) and the /api/auth routes.
 * All HTTP tests use supertest against the Express app — fully offline.
 *
 * The store is in-memory so every test run starts clean as long as email
 * addresses are unique (we embed timestamps to guarantee uniqueness).
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const JWT_SECRET = process.env.JWT_SECRET!; // set by setup.ts

import app from '../app';

// ─── bcrypt helpers ────────────────────────────────────────────────────────────

describe('bcrypt hash + compare', () => {
  it('hashes a password into a different string', async () => {
    const hash = await bcrypt.hash('supersecret', 10);
    expect(hash).not.toBe('supersecret');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('compare returns true for the correct password', async () => {
    const hash = await bcrypt.hash('mypassword', 10);
    expect(await bcrypt.compare('mypassword', hash)).toBe(true);
  });

  it('compare returns false for the wrong password', async () => {
    const hash = await bcrypt.hash('mypassword', 10);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });

  it('two hashes of the same password differ (bcrypt salting)', async () => {
    const h1 = await bcrypt.hash('same', 10);
    const h2 = await bcrypt.hash('same', 10);
    expect(h1).not.toBe(h2);
    expect(await bcrypt.compare('same', h1)).toBe(true);
    expect(await bcrypt.compare('same', h2)).toBe(true);
  });
});

// ─── JWT sign + verify round-trip ─────────────────────────────────────────────

describe('JWT sign + verify', () => {
  it('signed token decodes back to the original payload', () => {
    const token = jwt.sign({ userId: 'u-123', email: 'test@f1.io' }, JWT_SECRET, { expiresIn: '1h' });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    expect(payload.userId).toBe('u-123');
    expect(payload.email).toBe('test@f1.io');
  });

  it('throws when verifying with a wrong secret', () => {
    const token = jwt.sign({ userId: 'u-123' }, JWT_SECRET);
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  it('throws for an expired token', () => {
    const token = jwt.sign({ userId: 'u-999' }, JWT_SECRET, { expiresIn: -1 });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(/expired/i);
  });

  it('token contains expected fields', () => {
    const token = jwt.sign({ userId: 'abc', email: 'x@y.com' }, JWT_SECRET);
    const decoded = jwt.decode(token) as any;
    expect(decoded.userId).toBe('abc');
    expect(decoded.iat).toBeDefined();
  });
});

// ─── POST /api/auth/register ───────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  // Unique email suffix per test suite run to avoid 409 on repeated runs.
  const suffix = Date.now();

  it('creates a user and returns a JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `newuser-${suffix}@test.io`, password: 'Passw0rd!', firstName: 'Alice', lastName: 'Smith' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
  });

  it('returns user object without password_hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `safe-${suffix}@test.io`, password: 'Passw0rd!', firstName: 'Bob', lastName: 'Jones' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(`safe-${suffix}@test.io`);
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects duplicate email with 409', async () => {
    const email = `dup-${suffix}@test.io`;
    const body = { email, password: 'Passw0rd!', firstName: 'C', lastName: 'D' };
    await request(app).post('/api/auth/register').send(body);
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('rejects short passwords with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `short-${suffix}@test.io`, password: '123', firstName: 'X', lastName: 'Y' });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `nopw-${suffix}@test.io` });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const suffix = Date.now() + 1;
  const creds = { email: `login-${suffix}@test.io`, password: 'Secure123!' };

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ ...creds, firstName: 'Eve', lastName: 'F' });
  });

  it('returns a token for correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send(creds);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: creds.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ghost@test.io', password: 'anything' });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me — protected route ───────────────────────────────────────

describe('GET /api/auth/me', () => {
  const suffix = Date.now() + 2;
  let token: string;
  let registeredEmail: string;

  beforeAll(async () => {
    registeredEmail = `me-${suffix}@test.io`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: registeredEmail, password: 'Passw0rd!', firstName: 'Me', lastName: 'Myself' });
    token = res.body.token;
  });

  it('returns the authenticated user for a valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(registeredEmail);
    expect(res.body.password_hash).toBeUndefined();
  });

  it('returns 401 when no token is supplied', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});
