#!/usr/bin/env ts-node
// ─── Dormie Course Import CLI ─────────────────────────────────────────────────
//
// Usage:
//   npx ts-node scripts/import-courses.ts --state=TN
//   npx ts-node scripts/import-courses.ts --territory
//   npx ts-node scripts/import-courses.ts --national
//   npx ts-node scripts/import-courses.ts --all
//   npx ts-node scripts/import-courses.ts --resume
//   npx ts-node scripts/import-courses.ts --backup-only
//   npx ts-node scripts/import-courses.ts --stats
//
// Env vars required for Supabase write (not needed for --backup-only):
//   EXPO_PUBLIC_SUPABASE_URL
//   EXPO_PUBLIC_SUPABASE_ANON_KEY

import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ALL_STATES, getStateByCode, getTerritoryStates, type StateConfig } from './state-lists';
import { getAllNationalCourses, type NationalCourse } from './seed-national';
import { scrapeState, scrapeNamedCourse, type ScrapedCourse, type SourceName } from './course-sources';

// ─── Paths ───────────────────────────────────────────────────────────────────

const PROGRESS_FILE = path.join(__dirname, 'progress.json');
const BACKUP_FILE = path.join(__dirname, 'course-data-backup.json');

// ─── Progress tracker ────────────────────────────────────────────────────────

type ProgressData = {
  startedAt: string;
  lastUpdatedAt: string;
  completedStates: string[];
  completedNational: boolean;
  courses: ImportedCourse[];
  stats: {
    totalFound: number;
    totalImported: number;
    totalFailed: number;
    failedCourses: { name: string; reason: string }[];
    byQuality: Record<string, number>;
    byState: Record<string, number>;
    bySource: Record<string, number>;
  };
};

type ImportedCourse = {
  name: string;
  club?: string;
  city: string;
  state: string;
  par: number;
  holes: number;
  teeBoxes: {
    name: string;
    color: string;
    rating: number;
    slope: number;
    yards: number;
  }[];
  access: string;
  latitude?: number;
  longitude?: number;
  sourceUrl: string;
  dataQuality: string;
  dataSource: 'imported';
  nationalLists?: string[];
  importedAt: string;
};

function loadProgress(): ProgressData {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return {
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    completedStates: [],
    completedNational: false,
    courses: [],
    stats: {
      totalFound: 0,
      totalImported: 0,
      totalFailed: 0,
      failedCourses: [],
      byQuality: {},
      byState: {},
      bySource: {},
    },
  };
}

function saveProgress(progress: ProgressData): void {
  progress.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/** Save progress after every N courses. */
const SAVE_INTERVAL = 50;
let coursesSinceLastSave = 0;

function maybeSaveProgress(progress: ProgressData): void {
  coursesSinceLastSave++;
  if (coursesSinceLastSave >= SAVE_INTERVAL) {
    saveProgress(progress);
    coursesSinceLastSave = 0;
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function normalizeKey(name: string, city: string, state: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${city.toLowerCase().replace(/[^a-z0-9]/g, '')}|${state.toLowerCase()}`;
}

function isDuplicate(progress: ProgressData, name: string, city: string, state: string): boolean {
  const key = normalizeKey(name, city, state);
  return progress.courses.some((c) => normalizeKey(c.name, c.city, c.state) === key);
}

// ─── Scraped → Imported conversion ──────────────────────────────────────────

function toImportedCourse(scraped: ScrapedCourse, nationalLists?: string[]): ImportedCourse {
  return {
    name: scraped.name,
    club: scraped.club,
    city: scraped.city,
    state: scraped.state,
    par: scraped.par,
    holes: scraped.holes,
    teeBoxes: scraped.teeBoxes,
    access: scraped.access,
    latitude: scraped.latitude,
    longitude: scraped.longitude,
    sourceUrl: scraped.sourceUrl,
    dataQuality: scraped.dataQuality,
    dataSource: 'imported',
    nationalLists,
    importedAt: new Date().toISOString(),
  };
}

// ─── Supabase writer ─────────────────────────────────────────────────────────

function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log('[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
    return null;
  }
  return createClient(url, key);
}

async function writeToSupabase(client: SupabaseClient, course: ImportedCourse): Promise<boolean> {
  try {
    const location = [course.city, course.state].filter(Boolean).join(', ');

    // Check if course already exists
    const { data: existing } = await client
      .from('courses')
      .select('id')
      .eq('name', course.name)
      .ilike('location', `%${course.city || location}%`)
      .maybeSingle();

    if (existing) {
      // Update with better data if we have it
      const update: Record<string, unknown> = {
        data_source: 'imported',
        data_quality: course.dataQuality,
      };
      if (course.par) update.par = course.par;
      if (course.teeBoxes.length > 0) {
        const defaultTee = course.teeBoxes.find((t) =>
          t.name.toLowerCase().includes('white') || t.name.toLowerCase().includes('middle')
        ) ?? course.teeBoxes[0];
        if (defaultTee.slope) update.slope = defaultTee.slope;
        if (defaultTee.rating) update.rating = defaultTee.rating;
        if (defaultTee.yards) update.yards = defaultTee.yards;
      }

      await client.from('courses').update(update).eq('id', existing.id);
      return true;
    }

    // Insert new course
    const defaultTee = course.teeBoxes.find((t) =>
      t.name.toLowerCase().includes('white') || t.name.toLowerCase().includes('middle')
    ) ?? course.teeBoxes[0];

    const insert: Record<string, unknown> = {
      name: course.name,
      location,
      city: course.city || null,
      state: course.state || null,
      par: course.par || 72,
      slope: defaultTee?.slope ?? null,
      rating: defaultTee?.rating ?? null,
      yards: defaultTee?.yards ?? null,
      data_source: 'imported',
      data_quality: course.dataQuality,
    };

    const { error } = await client.from('courses').insert(insert);
    if (error) {
      console.log(`[Supabase] Insert error for "${course.name}": ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.log(`[Supabase] Write error for "${course.name}": ${(err as Error).message}`);
    return false;
  }
}

// ─── Import functions ────────────────────────────────────────────────────────

async function importState(
  stateConfig: StateConfig,
  progress: ProgressData,
  backupOnly: boolean,
  supabase: SupabaseClient | null,
): Promise<void> {
  if (progress.completedStates.includes(stateConfig.code)) {
    console.log(`[Import] Skipping ${stateConfig.name} (${stateConfig.code}) — already completed`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Import] Starting ${stateConfig.name} (${stateConfig.code}) — tier: ${stateConfig.tier}, target: ${stateConfig.targetCount === 0 ? 'ALL' : stateConfig.targetCount}`);
  console.log(`${'='.repeat(60)}`);

  const scraped = await scrapeState(
    stateConfig.code,
    stateConfig.name,
    stateConfig.targetCount,
    (count, source) => {
      console.log(`[Import] ${stateConfig.code}: ${count} courses so far (latest from ${source})`);
    },
  );

  let imported = 0;
  let failed = 0;

  for (const course of scraped) {
    if (isDuplicate(progress, course.name, course.city, course.state)) {
      continue; // skip duplicates
    }

    const importedCourse = toImportedCourse(course);
    progress.courses.push(importedCourse);
    progress.stats.totalFound++;

    // Update quality stats
    progress.stats.byQuality[course.dataQuality] = (progress.stats.byQuality[course.dataQuality] ?? 0) + 1;
    progress.stats.byState[stateConfig.code] = (progress.stats.byState[stateConfig.code] ?? 0) + 1;

    // Write to Supabase if not backup-only
    if (!backupOnly && supabase) {
      const success = await writeToSupabase(supabase, importedCourse);
      if (success) {
        progress.stats.totalImported++;
        imported++;
      } else {
        progress.stats.totalFailed++;
        progress.stats.failedCourses.push({ name: course.name, reason: 'supabase_write_error' });
        failed++;
      }
    } else {
      progress.stats.totalImported++;
      imported++;
    }

    maybeSaveProgress(progress);
  }

  progress.completedStates.push(stateConfig.code);
  saveProgress(progress);

  console.log(`[Import] ${stateConfig.name} complete: ${imported} imported, ${failed} failed, ${scraped.length} total scraped`);
}

async function importNational(
  progress: ProgressData,
  backupOnly: boolean,
  supabase: SupabaseClient | null,
): Promise<void> {
  if (progress.completedNational) {
    console.log('[Import] Skipping national lists — already completed');
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('[Import] Starting national course lists');
  console.log(`${'='.repeat(60)}`);

  const nationalCourses = getAllNationalCourses();
  console.log(`[Import] ${nationalCourses.length} national courses to process`);

  let imported = 0;
  let failed = 0;
  let skipped = 0;

  for (const nc of nationalCourses) {
    if (isDuplicate(progress, nc.name, nc.city, nc.state)) {
      skipped++;
      continue;
    }

    // Try to scrape detailed data for this course
    console.log(`[Import] Looking up: ${nc.name} (${nc.city}, ${nc.state})...`);
    let scraped: ScrapedCourse | null = null;

    try {
      scraped = await scrapeNamedCourse(nc.name, nc.city, nc.state);
    } catch (err) {
      console.log(`[Import] Scrape failed for "${nc.name}": ${(err as Error).message}`);
    }

    const importedCourse: ImportedCourse = scraped
      ? { ...toImportedCourse(scraped, nc.list), access: nc.access }
      : {
          name: nc.name,
          club: nc.club,
          city: nc.city,
          state: nc.state,
          par: 72,
          holes: 18,
          teeBoxes: [],
          access: nc.access,
          sourceUrl: '',
          dataQuality: 'name_only',
          dataSource: 'imported',
          nationalLists: nc.list,
          importedAt: new Date().toISOString(),
        };

    progress.courses.push(importedCourse);
    progress.stats.totalFound++;
    progress.stats.byQuality[importedCourse.dataQuality] = (progress.stats.byQuality[importedCourse.dataQuality] ?? 0) + 1;
    progress.stats.bySource['national'] = (progress.stats.bySource['national'] ?? 0) + 1;

    if (!backupOnly && supabase) {
      const success = await writeToSupabase(supabase, importedCourse);
      if (success) {
        progress.stats.totalImported++;
        imported++;
      } else {
        progress.stats.totalFailed++;
        progress.stats.failedCourses.push({ name: nc.name, reason: 'supabase_write_error' });
        failed++;
      }
    } else {
      progress.stats.totalImported++;
      imported++;
    }

    maybeSaveProgress(progress);
  }

  progress.completedNational = true;
  saveProgress(progress);

  console.log(`[Import] National lists complete: ${imported} imported, ${failed} failed, ${skipped} skipped (dupes)`);
}

// ─── Backup ──────────────────────────────────────────────────────────────────

function saveBackup(progress: ProgressData): void {
  console.log(`\n[Backup] Writing ${progress.courses.length} courses to ${BACKUP_FILE}...`);
  fs.writeFileSync(BACKUP_FILE, JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalCourses: progress.courses.length,
    stats: progress.stats,
    courses: progress.courses,
  }, null, 2));
  console.log(`[Backup] Done. File size: ${(fs.statSync(BACKUP_FILE).size / 1024 / 1024).toFixed(1)} MB`);
}

// ─── Stats display ───────────────────────────────────────────────────────────

function showStats(progress: ProgressData): void {
  console.log('\n' + '='.repeat(60));
  console.log('  DORMIE COURSE IMPORT — STATUS');
  console.log('='.repeat(60));
  console.log(`  Started:           ${progress.startedAt}`);
  console.log(`  Last updated:      ${progress.lastUpdatedAt}`);
  console.log(`  Total courses:     ${progress.courses.length}`);
  console.log(`  Total found:       ${progress.stats.totalFound}`);
  console.log(`  Total imported:    ${progress.stats.totalImported}`);
  console.log(`  Total failed:      ${progress.stats.totalFailed}`);
  console.log('');

  console.log('  Data Quality Breakdown:');
  for (const [quality, count] of Object.entries(progress.stats.byQuality)) {
    console.log(`    ${quality.padEnd(15)} ${count}`);
  }
  console.log('');

  console.log('  States Completed:');
  if (progress.completedStates.length === 0) {
    console.log('    (none)');
  } else {
    const chunks = [];
    for (let i = 0; i < progress.completedStates.length; i += 10) {
      chunks.push(progress.completedStates.slice(i, i + 10).join(', '));
    }
    for (const chunk of chunks) {
      console.log(`    ${chunk}`);
    }
  }

  const pendingStates = ALL_STATES.filter((s) => !progress.completedStates.includes(s.code));
  console.log(`  States Pending:    ${pendingStates.length}`);
  console.log(`  National Lists:    ${progress.completedNational ? 'DONE' : 'PENDING'}`);
  console.log('');

  console.log('  Courses by State (top 10):');
  const stateCounts = Object.entries(progress.stats.byState)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  for (const [state, count] of stateCounts) {
    console.log(`    ${state.padEnd(5)} ${count}`);
  }

  if (progress.stats.failedCourses.length > 0) {
    console.log('');
    console.log(`  Recent Failures (last 10):`);
    const recent = progress.stats.failedCourses.slice(-10);
    for (const f of recent) {
      console.log(`    ${f.name.slice(0, 40).padEnd(42)} ${f.reason}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const stateArg = args.find((a) => a.startsWith('--state='))?.split('=')[1]?.toUpperCase();
  const isTerritory = args.includes('--territory');
  const isNational = args.includes('--national');
  const isAll = args.includes('--all');
  const isResume = args.includes('--resume');
  const isBackupOnly = args.includes('--backup-only');
  const isStats = args.includes('--stats');

  // Load existing progress (for resume or stats)
  const progress = loadProgress();

  // --stats: just show progress and exit
  if (isStats) {
    showStats(progress);
    return;
  }

  // Validate we have at least one mode
  if (!stateArg && !isTerritory && !isNational && !isAll && !isResume && !isBackupOnly) {
    console.log(`
Dormie Course Import CLI
========================

Usage:
  npx ts-node scripts/import-courses.ts --state=TN        Single state (all courses)
  npx ts-node scripts/import-courses.ts --territory        All 7 territory states
  npx ts-node scripts/import-courses.ts --national         Top 500 public + private + tour venues
  npx ts-node scripts/import-courses.ts --all              Full 10,000+ course import
  npx ts-node scripts/import-courses.ts --resume           Continue from where it left off
  npx ts-node scripts/import-courses.ts --backup-only      Save to local JSON without Supabase write
  npx ts-node scripts/import-courses.ts --stats            Show import progress and counts

Flags can be combined:
  npx ts-node scripts/import-courses.ts --state=TN --backup-only
  npx ts-node scripts/import-courses.ts --all --backup-only

Environment variables (for Supabase write):
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
`);
    return;
  }

  // Setup Supabase (unless backup-only)
  let supabase: SupabaseClient | null = null;
  if (!isBackupOnly) {
    supabase = createSupabaseClient();
    if (!supabase) {
      console.log('[Import] No Supabase credentials. Use --backup-only to save locally only.');
      console.log('[Import] Proceeding in backup-only mode...');
    }
  }
  const backupOnly = isBackupOnly || !supabase;

  if (backupOnly) {
    console.log('[Import] Running in BACKUP-ONLY mode (no Supabase writes)');
  }

  const startTime = Date.now();

  try {
    // --state=XX: single state
    if (stateArg) {
      const state = getStateByCode(stateArg);
      if (!state) {
        console.error(`Unknown state code: ${stateArg}`);
        process.exit(1);
      }
      // Override target to 0 (all) when explicitly requested
      await importState({ ...state, targetCount: 0 }, progress, backupOnly, supabase);
    }

    // --territory: all 7 territory states
    if (isTerritory) {
      const states = getTerritoryStates();
      for (const state of states) {
        await importState(state, progress, backupOnly, supabase);
      }
    }

    // --national: top public + private + tour venues + majors
    if (isNational || isAll) {
      await importNational(progress, backupOnly, supabase);
    }

    // --all: every state + national
    if (isAll) {
      for (const state of ALL_STATES) {
        await importState(state, progress, backupOnly, supabase);
      }
    }

    // --resume: pick up where we left off (same as --all but skips completed)
    if (isResume) {
      if (!progress.completedNational) {
        await importNational(progress, backupOnly, supabase);
      }
      for (const state of ALL_STATES) {
        await importState(state, progress, backupOnly, supabase);
      }
    }
  } catch (err) {
    console.error(`\n[Import] Fatal error: ${(err as Error).message}`);
    console.log('[Import] Progress saved. Use --resume to continue.');
  }

  // Final save
  saveProgress(progress);
  saveBackup(progress);
  showStats(progress);

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n[Import] Finished in ${elapsed} minutes.`);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
