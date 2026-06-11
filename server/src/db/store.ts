import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { H1B_COMPANIES } from './h1bSeed';
import { loadSnapshot, saveSnapshot } from './persistence';

export interface StoreData {
  users: Record<string, any>;
  job_applications: Record<string, any>;
  resume_optimizations: Record<string, any>;
  opt_compliance: Record<string, any>;
  h1b_companies: Record<string, any>;
  ai_conversations: Record<string, any>;
  ai_messages: Record<string, any>;
  referral_contacts: Record<string, any>;
  interview_sessions: Record<string, any>;
  interview_answers: Record<string, any>;
  networking_messages: Record<string, any>;
  notifications: Record<string, any>;
  news_cache: Record<string, any>;
  job_cache: Record<string, any>;
  cover_letters: Record<string, any>;
  piston_runtimes: Record<string, any>;
  leetcode_cache: Record<string, any>;
}

const EMPTY: StoreData = {
  users: {}, job_applications: {}, resume_optimizations: {},
  opt_compliance: {}, h1b_companies: {}, ai_conversations: {},
  ai_messages: {}, referral_contacts: {}, interview_sessions: {},
  interview_answers: {}, networking_messages: {}, notifications: {},
  news_cache: {}, job_cache: {}, cover_letters: {}, piston_runtimes: {}, leetcode_cache: {},
};

let data: StoreData = JSON.parse(JSON.stringify(EMPTY));

// ── debounced save ─────────────────────────────────────────────────────────────
// Mutations schedule a save ~1.5 s after the last write so the DB is not
// hammered when many records are inserted in quick succession (e.g. seeding).
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveSnapshot(data).catch((err) =>
      console.error('[store] saveSnapshot error:', err)
    );
  }, 1500);
}

/** Flush any pending save immediately (used on process exit). */
async function flushNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await saveSnapshot(data);
}

// Flush on clean exit and common signals so nothing is lost on shutdown.
process.on('beforeExit', () => { flushNow().catch(() => {}); });
process.on('SIGTERM',    () => { flushNow().catch(() => {}).finally(() => process.exit(0)); });
process.on('SIGINT',     () => { flushNow().catch(() => {}).finally(() => process.exit(0)); });

// ── init ───────────────────────────────────────────────────────────────────────

/**
 * Async initialiser — loads the snapshot from Postgres or the JSON file and
 * populates the in-memory store.  Must be awaited before seedIfEmpty().
 *
 * index.ts change required (do NOT call loadStore() any more):
 *
 *   async function start() {
 *     await initStore();
 *     seedIfEmpty();
 *     startScheduler();
 *     app.listen(config.port, () =>
 *       console.log(`Server running on port ${config.port} [${config.env}]`));
 *   }
 *   start();
 */
export async function initStore(): Promise<void> {
  try {
    const snapshot = await loadSnapshot();
    if (snapshot) {
      data = { ...JSON.parse(JSON.stringify(EMPTY)), ...(snapshot as Partial<StoreData>) };
      console.log('[store] Loaded from', process.env.DATABASE_URL ? 'Postgres' : 'file');
    }
  } catch (err) {
    console.warn('[store] Could not load snapshot, starting fresh:', err);
  }
}

/**
 * Synchronous shim kept for backwards-compatibility.
 * Prefer initStore() (async).  When DATABASE_URL is set this is a no-op
 * because we cannot do async I/O synchronously — call initStore() at boot.
 */
export function loadStore() {
  if (process.env.DATABASE_URL) {
    // Can't block synchronously on Postgres.  index.ts must call initStore().
    console.warn('[store] DATABASE_URL is set — loadStore() is a no-op. Call initStore() instead.');
    return;
  }
  // file mode: keep synchronous path working exactly as before
  loadSnapshot().then((snapshot) => {
    if (snapshot) {
      data = { ...JSON.parse(JSON.stringify(EMPTY)), ...(snapshot as Partial<StoreData>) };
      console.log('[store] Loaded from file (sync-compatible path)');
    }
  }).catch(() => {
    console.warn('[store] Could not load file, starting fresh');
  });
}

// ── query API (all synchronous) ────────────────────────────────────────────────

export function getTable<T = any>(table: keyof StoreData): T[] {
  return Object.values(data[table]) as T[];
}

export function getById<T = any>(table: keyof StoreData, id: string): T | null {
  return (data[table][id] as T) ?? null;
}

export function insert<T = any>(table: keyof StoreData, record: any): T {
  const id = uuidv4();
  const now = new Date().toISOString();
  const row = { id, created_at: now, updated_at: now, ...record } as unknown as T;
  (data[table] as any)[id] = row;
  scheduleSave();
  return row;
}

export function update<T = any>(table: keyof StoreData, id: string, fields: Partial<T>): T | null {
  if (!data[table][id]) return null;
  data[table][id] = { ...data[table][id], ...fields, updated_at: new Date().toISOString() };
  scheduleSave();
  return data[table][id] as T;
}

export function remove(table: keyof StoreData, id: string): boolean {
  if (!data[table][id]) return false;
  delete data[table][id];
  scheduleSave();
  return true;
}

export function findOne<T = any>(table: keyof StoreData, predicate: (row: T) => boolean): T | null {
  return (Object.values(data[table]) as T[]).find(predicate) ?? null;
}

export function findAll<T = any>(table: keyof StoreData, predicate?: (row: T) => boolean): T[] {
  const rows = Object.values(data[table]) as T[];
  return predicate ? rows.filter(predicate) : rows;
}

export function rawSet(table: keyof StoreData, id: string, value: any) {
  (data[table] as any)[id] = value;
  scheduleSave();
}

export function rawGet(table: keyof StoreData, id: string): any {
  return data[table][id];
}

/** Ensure the public demo account exists (for the landing "Explore demo" button). */
function seedDemoUser() {
  const exists = Object.values(data.users).some((u: any) => u.email === 'vignesh@gmu.edu');
  if (exists) return;
  const id = uuidv4();
  const now = new Date().toISOString();
  (data.users as any)[id] = {
    id,
    email: 'vignesh@gmu.edu',
    password_hash: bcrypt.hashSync('password123', 12),
    first_name: 'Vignesh',
    last_name: 'Reddy',
    university: 'George Mason University',
    major: 'Computer Science',
    visa_type: 'F1 OPT',
    graduation_date: '2026-05-15',
    target_roles: ['Software Engineer', 'Data Engineer', 'ML Engineer'],
    target_companies: ['Google', 'Amazon', 'Microsoft', 'Nvidia', 'Stripe'],
    tech_stack: ['Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'AWS', 'Docker'],
    location_preferences: ['Remote', 'New York, NY', 'San Francisco, CA'],
    onboarding_completed: true,
    created_at: now,
    updated_at: now,
  };
  scheduleSave();
  console.log('[store] Seeded demo user (vignesh@gmu.edu)');
}

export function seedIfEmpty() {
  seedDemoUser();
  if (Object.keys(data.h1b_companies).length >= H1B_COMPANIES.length) return;

  // Clear and re-seed to pick up new companies
  data.h1b_companies = {};
  for (const c of H1B_COMPANIES) {
    const id = uuidv4();
    const now = new Date().toISOString();
    (data.h1b_companies as any)[id] = {
      id,
      created_at: now,
      updated_at: now,
      normalized_name: c.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      last_updated: now,
      ...c,
    };
  }
  scheduleSave();
  console.log(`[store] Seeded ${H1B_COMPANIES.length} H1B companies`);
}
