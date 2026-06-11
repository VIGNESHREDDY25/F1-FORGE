// Re-export store utilities for backward compat — routes now import from store directly
export { loadStore, seedIfEmpty } from './store';

// pg pool — only used by the standalone migrate/seed scripts
import { Pool } from 'pg';
import { config } from '../config';
export const pool = new Pool({ connectionString: config.db.url });
