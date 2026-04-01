/**
 * Supabase Connection & Schema Test
 *
 * Run: npx tsx scripts/test-supabase.ts
 *  or: node --loader tsx scripts/test-supabase.ts
 *
 * Connects to Supabase using .env credentials and queries each table
 * to verify connection, schema, and row counts.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLES = [
  'courses',
  'rounds',
  'seasons',
  'trips',
  'friendships',
  'trip_members',
  'season_members',
  'season_weeks',
  'season_scores',
  'messages',
  'profiles',
] as const;

type Result = { table: string; count: number | null; error: string | null };

async function testConnection(): Promise<boolean> {
  console.log(`\nTesting connection to: ${SUPABASE_URL}\n`);
  try {
    const { error } = await supabase.from('courses').select('id', { count: 'exact', head: true });
    if (error) {
      console.error('Connection failed:', error.message);
      return false;
    }
    console.log('Connection successful\n');
    return true;
  } catch (e: any) {
    console.error('Connection error:', e.message);
    return false;
  }
}

async function queryTable(table: string): Promise<Result> {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      return { table, count: null, error: error.message };
    }
    return { table, count: count ?? 0, error: null };
  } catch (e: any) {
    return { table, count: null, error: e.message };
  }
}

async function main() {
  console.log('==========================================');
  console.log('  DORMIE - Supabase Connection Test');
  console.log('==========================================');

  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }

  // Auth users via profiles proxy (anon key can't query auth.users)
  const profileResult = await queryTable('profiles');
  if (profileResult.count !== null) {
    console.log(`Auth users (via profiles): ${profileResult.count}`);
  } else {
    console.log('Auth users: unable to query (may need profiles table or RLS)');
  }

  console.log('\nTable Row Counts:\n');
  console.log('  Table               Count    Status');
  console.log('  ------------------- -------- ------');

  const results: Result[] = [];
  for (const table of TABLES) {
    const result = await queryTable(table);
    results.push(result);

    const countStr = result.count !== null ? String(result.count).padStart(6) : '     -';
    const status = result.error ? `FAIL: ${result.error}` : 'OK';
    console.log(`  ${table.padEnd(20)} ${countStr}   ${status}`);
  }

  // Summary
  const passed = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;
  const totalRows = results.reduce((sum, r) => sum + (r.count ?? 0), 0);

  console.log('\n==========================================');
  console.log(`  Tables queried: ${results.length}`);
  console.log(`  Passed: ${passed} | Failed: ${failed}`);
  console.log(`  Total rows across all tables: ${totalRows}`);
  console.log('==========================================\n');

  if (failed > 0) {
    console.log('Some tables had errors. This may be expected if tables');
    console.log('have not been created yet or RLS policies block anon access.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
