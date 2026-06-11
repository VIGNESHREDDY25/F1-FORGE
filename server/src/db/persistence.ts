/**
 * persistence.ts — dual-mode persistence layer for F1Forge store
 *
 * If DATABASE_URL is set → Postgres (pg Pool), single-row jsonb snapshot.
 * Otherwise             → local JSON file (same path store.ts has always used).
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// ── file-mode constants ────────────────────────────────────────────────────────
export const DATA_FILE = path.join(process.cwd(), 'f1forge-data.json');

// ── postgres pool (lazy) ───────────────────────────────────────────────────────
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const url = process.env.DATABASE_URL!;
  const isLocalhost =
    url.includes('localhost') || url.includes('127.0.0.1');

  pool = new Pool({
    connectionString: url,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  return pool;
}

// ── ensure schema ──────────────────────────────────────────────────────────────
async function ensureTable(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id          TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

// ── public API ─────────────────────────────────────────────────────────────────

/**
 * Load the full store snapshot.
 * Returns the parsed object, or null when no snapshot exists yet.
 */
export async function loadSnapshot(): Promise<object | null> {
  if (process.env.DATABASE_URL) {
    await ensureTable();
    const client = await getPool().connect();
    try {
      const res = await client.query(
        `SELECT data FROM app_state WHERE id = 'main'`
      );
      if (res.rows.length === 0) return null;
      return res.rows[0].data as object;
    } finally {
      client.release();
    }
  }

  // ── file mode ──
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as object;
    }
  } catch {
    console.warn('[persistence] Could not read JSON file, starting fresh');
  }
  return null;
}

/**
 * Persist the full store snapshot.
 * In Postgres mode: upserts the single 'main' row.
 * In file mode:     writes the JSON file synchronously.
 */
export async function saveSnapshot(storeData: object): Promise<void> {
  if (process.env.DATABASE_URL) {
    await ensureTable();
    const client = await getPool().connect();
    try {
      await client.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ('main', $1, NOW())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [storeData]
      );
    } finally {
      client.release();
    }
    return;
  }

  // ── file mode ──
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(storeData, null, 2));
  } catch (err) {
    console.warn('[persistence] Could not write JSON file:', err);
  }
}
