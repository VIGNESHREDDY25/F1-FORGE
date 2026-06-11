/**
 * Unit tests for the in-memory JSON store (server/src/db/store.ts).
 *
 * The store uses a single global in-memory `data` object shared across all
 * tests in the same Jest worker.  Tests must therefore:
 *   - use unique tags/field values so they can identify their own records, OR
 *   - rely only on the specific records they inserted in that test.
 *
 * We do NOT try to reset the module between tests to avoid brittle hacks;
 * instead every test predicates on its own inserted records.
 */

import {
  insert,
  findOne,
  findAll,
  update,
  remove,
  rawGet,
  rawSet,
  getTable,
  getById,
} from '../db/store';

// ─── insert ───────────────────────────────────────────────────────────────────

describe('store: insert', () => {
  it('returns a record with a uuid id', () => {
    const rec = insert<any>('interview_sessions', { _tag: 'uuid-test' });
    expect(rec.id).toBeDefined();
    expect(typeof rec.id).toBe('string');
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stamps created_at and updated_at as ISO strings', () => {
    const rec = insert<any>('interview_sessions', { _tag: 'timestamp-test' });
    expect(rec.created_at).toBeDefined();
    expect(rec.updated_at).toBeDefined();
    expect(() => new Date(rec.created_at)).not.toThrow();
    expect(new Date(rec.created_at).toISOString()).toBe(rec.created_at);
  });

  it('preserves arbitrary payload fields', () => {
    const rec = insert<any>('interview_sessions', { _tag: 'payload-test', message: 'Hello', level: 42 });
    expect(rec.message).toBe('Hello');
    expect(rec.level).toBe(42);
  });

  it('successive inserts produce unique ids', () => {
    const a = insert<any>('interview_answers', { _tag: 'unique-id-a' });
    const b = insert<any>('interview_answers', { _tag: 'unique-id-b' });
    expect(a.id).not.toBe(b.id);
  });

  it('id field in the returned record is a valid uuid', () => {
    const rec = insert<any>('networking_messages', { _tag: 'own-id-test' });
    // The store generates a uuid and prepends it; it is always a valid uuid.
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(rec._tag).toBe('own-id-test');
  });
});

// ─── findOne ─────────────────────────────────────────────────────────────────

describe('store: findOne', () => {
  it('returns the matching record', () => {
    const tag = `findOne-email-${Date.now()}`;
    insert<any>('users', { email: `${tag}-a@test.com`, _tag: tag });
    insert<any>('users', { email: `${tag}-b@test.com`, _tag: tag });
    const found = findOne<any>('users', u => u.email === `${tag}-b@test.com`);
    expect(found).not.toBeNull();
    expect(found!.email).toBe(`${tag}-b@test.com`);
  });

  it('returns null when no record matches', () => {
    const found = findOne<any>('users', u => u.email === 'absolutely-no-such-email-xyz@test.com');
    expect(found).toBeNull();
  });

  it('returns null on an empty table', () => {
    // resume_optimizations is typically empty in a fresh test run
    // Use a distinctive predicate that can never match
    const found = findOne<any>('resume_optimizations', r => r._totally_fake_field_xyz === true);
    expect(found).toBeNull();
  });
});

// ─── findAll ─────────────────────────────────────────────────────────────────

describe('store: findAll', () => {
  it('filters by predicate and returns only matching records', () => {
    const tag = `findAll-tag-${Date.now()}`;
    insert<any>('referral_contacts', { _tag: tag, status: 'alpha' });
    insert<any>('referral_contacts', { _tag: tag, status: 'beta' });
    insert<any>('referral_contacts', { _tag: tag, status: 'alpha' });
    const alphas = findAll<any>('referral_contacts', r => r._tag === tag && r.status === 'alpha');
    expect(alphas).toHaveLength(2);
    alphas.forEach(r => expect(r.status).toBe('alpha'));
  });

  it('returns ALL tagged records when no predicate is given (then filters externally)', () => {
    const tag = `findAll-all-${Date.now()}`;
    insert<any>('ai_conversations', { _tag: tag, n: 1 });
    insert<any>('ai_conversations', { _tag: tag, n: 2 });
    const all = findAll<any>('ai_conversations');
    // Filter to our own inserts to avoid counting other tests' records
    const ours = all.filter((r: any) => r._tag === tag);
    expect(ours).toHaveLength(2);
  });

  it('returns empty array when no record matches the predicate', () => {
    const matches = findAll<any>('cover_letters', r => (r as any)._no_such_sentinel === 'xyz');
    expect(matches).toEqual([]);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('store: update', () => {
  it('mutates only the specified fields', () => {
    const rec = insert<any>('job_applications', { company: 'Google', status: 'applied', _tag: 'update-test' });
    const updated = update<any>('job_applications', rec.id, { status: 'offer' });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('offer');
    expect(updated!.company).toBe('Google'); // unchanged field preserved
    expect(updated!._tag).toBe('update-test');
  });

  it('updates updated_at timestamp', async () => {
    const rec = insert<any>('job_applications', { company: 'Alphabet', _tag: 'ts-update' });
    const before = rec.updated_at;
    // Small delay so timestamps differ
    await new Promise(r => setTimeout(r, 5));
    const updated = update<any>('job_applications', rec.id, { company: 'Alphabet Inc' });
    expect(updated!.updated_at >= before).toBe(true);
  });

  it('returns null when id does not exist', () => {
    const result = update('job_applications', 'non-existent-id-xyz', { status: 'x' });
    expect(result).toBeNull();
  });

  it('reflection: findOne returns the updated value', () => {
    const tag = `update-reflect-${Date.now()}`;
    const rec = insert<any>('users', { email: `${tag}@x.com`, first_name: 'Old', _tag: tag });
    update('users', rec.id, { first_name: 'New' });
    const refetched = findOne<any>('users', u => u._tag === tag);
    expect(refetched!.first_name).toBe('New');
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('store: remove', () => {
  it('deletes a record and returns true', () => {
    const rec = insert<any>('notifications', { _tag: 'remove-true', text: 'bye' });
    const result = remove('notifications', rec.id);
    expect(result).toBe(true);
    expect(findOne<any>('notifications', r => r.id === rec.id)).toBeNull();
  });

  it('returns false for a non-existent id', () => {
    expect(remove('notifications', 'ghost-id-xyz-000')).toBe(false);
  });

  it('only removes the targeted record, not others', () => {
    const tag = `remove-isolation-${Date.now()}`;
    const a = insert<any>('ai_messages', { _tag: tag, which: 'A' });
    const b = insert<any>('ai_messages', { _tag: tag, which: 'B' });
    remove('ai_messages', a.id);
    // Only 'b' should survive in OUR tagged set
    const surviving = findAll<any>('ai_messages', r => r._tag === tag);
    expect(surviving).toHaveLength(1);
    expect(surviving[0].which).toBe('B');
    expect(surviving[0].id).toBe(b.id);
  });
});

// ─── rawGet / rawSet ──────────────────────────────────────────────────────────

describe('store: rawGet / rawSet', () => {
  it('rawSet stores arbitrary values and rawGet retrieves them', () => {
    rawSet('news_cache', 'test-top-stories', { items: [1, 2, 3], fetchedAt: 0 });
    const val = rawGet('news_cache', 'test-top-stories');
    expect(val).toEqual({ items: [1, 2, 3], fetchedAt: 0 });
  });

  it('rawGet returns undefined for missing keys', () => {
    expect(rawGet('news_cache', 'missing-key-xyz-never-set')).toBeUndefined();
  });

  it('rawSet overwrites previous values', () => {
    rawSet('job_cache', 'test-swe-count', { count: 5 });
    rawSet('job_cache', 'test-swe-count', { count: 99 });
    expect(rawGet('job_cache', 'test-swe-count')).toEqual({ count: 99 });
  });
});

// ─── getTable / getById ───────────────────────────────────────────────────────

describe('store: getTable / getById', () => {
  it('getById returns the record when it exists', () => {
    const rec = insert<any>('notifications', { _tag: 'getbyid-test', text: 'hello' });
    const fetched = getById('notifications', rec.id);
    expect(fetched).not.toBeNull();
    expect((fetched as any).text).toBe('hello');
  });

  it('getById returns null for unknown id', () => {
    expect(getById('notifications', 'no-such-id-xyz-000')).toBeNull();
  });

  it('getTable returns an array (may include records from other tests)', () => {
    const tag = `gettable-${Date.now()}`;
    insert<any>('cover_letters', { _tag: tag, body: 'A' });
    insert<any>('cover_letters', { _tag: tag, body: 'B' });
    const all = getTable('cover_letters');
    expect(Array.isArray(all)).toBe(true);
    const ours = all.filter((r: any) => r._tag === tag);
    expect(ours).toHaveLength(2);
  });
});
