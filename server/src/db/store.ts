import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { H1B_COMPANIES } from './h1bSeed';

const DATA_FILE = path.join(process.cwd(), 'f1forge-data.json');

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

export function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const stored = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      data = { ...JSON.parse(JSON.stringify(EMPTY)), ...stored };
      console.log('Store loaded from', DATA_FILE);
    }
  } catch {
    console.warn('Could not load store, starting fresh');
  }
}

function persist() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch {}
}

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
  persist();
  return row;
}

export function update<T = any>(table: keyof StoreData, id: string, fields: Partial<T>): T | null {
  if (!data[table][id]) return null;
  data[table][id] = { ...data[table][id], ...fields, updated_at: new Date().toISOString() };
  persist();
  return data[table][id] as T;
}

export function remove(table: keyof StoreData, id: string): boolean {
  if (!data[table][id]) return false;
  delete data[table][id];
  persist();
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
  persist();
}

export function rawGet(table: keyof StoreData, id: string): any {
  return data[table][id];
}

export function seedIfEmpty() {
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
  persist();
  console.log(`Seeded ${H1B_COMPANIES.length} H1B companies`);
}
