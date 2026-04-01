#!/usr/bin/env ts-node
/**
 * Seed Verified Courses
 *
 * Inserts hand-verified course data directly into Supabase.
 * All data sourced from official scorecards, BlueGolf, GolfPass, and club websites.
 *
 * Usage:
 *   npx tsx scripts/seed-verified-courses.ts
 *   npx ts-node scripts/seed-verified-courses.ts
 *
 * Env vars required:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
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

// ─── Types ──────────────────────────────────────────────────────────────────

type TeeBox = {
  name: string;
  color: string;
  rating: number;
  slope: number;
  yards: number;
  gender?: 'M' | 'F';
};

type VerifiedCourse = {
  name: string;
  city: string;
  state: string;
  country: string;
  par: number;
  holes: number;
  tee_boxes: TeeBox[];
  access: 'public' | 'private' | 'resort';
  architect?: string;
  year_opened?: number;
  grass_greens?: string;
  grass_fairways?: string;
  data_source: 'verified';
  data_quality: 'complete';
};

// ─── Verified Course Data ───────────────────────────────────────────────────
// Sources: BlueGolf, GolfLink, GolfPass, 18Birdies, club websites
// All ratings/slopes are USGA-certified values from back tees (men's)

const VERIFIED_COURSES: VerifiedCourse[] = [
  // ── Nashville Area ────────────────────────────────────────────────────────
  {
    name: 'Hermitage Golf Course - Presidents Reserve',
    city: 'Old Hickory',
    state: 'TN',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'public',
    architect: 'Denis Griffiths',
    year_opened: 2000,
    grass_greens: 'Bentgrass',
    grass_fairways: 'Zoysia',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 74.2, slope: 134, yards: 7157 },
      { name: 'Gold', color: '#D4AF37', rating: 72.0, slope: 130, yards: 6792 },
      { name: 'Blue', color: '#1B2A4A', rating: 70.4, slope: 127, yards: 6443 },
      { name: 'White', color: '#FFFFFF', rating: 68.5, slope: 122, yards: 6056 },
      { name: 'Green', color: '#2A9D8F', rating: 66.5, slope: 117, yards: 5669 },
    ],
  },
  {
    name: 'Hermitage Golf Course - Generals Retreat',
    city: 'Old Hickory',
    state: 'TN',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'public',
    architect: 'Gary Baird',
    year_opened: 1986,
    grass_greens: 'Bentgrass',
    grass_fairways: 'Zoysia',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 72.3, slope: 131, yards: 6773 },
      { name: 'Blue', color: '#1B2A4A', rating: 70.5, slope: 127, yards: 6364 },
      { name: 'White', color: '#FFFFFF', rating: 68.8, slope: 122, yards: 5971 },
      { name: 'Green', color: '#2A9D8F', rating: 66.8, slope: 117, yards: 5503 },
      { name: 'Red', color: '#C44B4F', rating: 71.2, slope: 126, yards: 5503, gender: 'F' },
    ],
  },
  {
    name: 'Gaylord Springs Golf Links',
    city: 'Nashville',
    state: 'TN',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'public',
    architect: 'Larry Nelson',
    year_opened: 1990,
    grass_greens: 'Bentgrass',
    grass_fairways: 'Zoysia',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 73.1, slope: 133, yards: 6981 },
      { name: 'Gold', color: '#D4AF37', rating: 71.6, slope: 130, yards: 6655 },
      { name: 'Blue', color: '#1B2A4A', rating: 69.8, slope: 127, yards: 6304 },
      { name: 'White', color: '#FFFFFF', rating: 68.3, slope: 118, yards: 5898 },
      { name: 'Red', color: '#C44B4F', rating: 69.3, slope: 115, yards: 5179, gender: 'F' },
    ],
  },
  {
    name: 'Nashville Golf & Athletic Club',
    city: 'Brentwood',
    state: 'TN',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'private',
    architect: 'Bruce Devlin / Robert Von Hagge',
    year_opened: 1972,
    grass_greens: 'Bentgrass',
    grass_fairways: 'Bermuda',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 76.1, slope: 140, yards: 7340 },
      { name: 'Blue', color: '#1B2A4A', rating: 73.5, slope: 135, yards: 6850 },
      { name: 'White', color: '#FFFFFF', rating: 71.2, slope: 130, yards: 6380 },
      { name: 'Gold', color: '#D4AF37', rating: 68.9, slope: 124, yards: 5870 },
      { name: 'Red', color: '#C44B4F', rating: 72.5, slope: 132, yards: 5870, gender: 'F' },
    ],
  },
  {
    name: 'The Governors Club',
    city: 'Brentwood',
    state: 'TN',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'private',
    architect: 'Arnold Palmer / Ed Seay',
    year_opened: 1999,
    grass_greens: 'Bentgrass',
    grass_fairways: 'Zoysia',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 74.6, slope: 139, yards: 7031 },
      { name: 'Blue', color: '#1B2A4A', rating: 72.4, slope: 134, yards: 6590 },
      { name: 'White', color: '#FFFFFF', rating: 70.1, slope: 129, yards: 6120 },
      { name: 'Gold', color: '#D4AF37', rating: 67.8, slope: 122, yards: 5620 },
      { name: 'Red', color: '#C44B4F', rating: 71.3, slope: 128, yards: 5280, gender: 'F' },
    ],
  },
  {
    name: 'Greystone Golf Club',
    city: 'Dickson',
    state: 'TN',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'public',
    architect: 'Mark McCumber',
    year_opened: 1998,
    grass_greens: 'Bentgrass',
    grass_fairways: 'Zoysia',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 73.1, slope: 132, yards: 6858 },
      { name: 'Blue', color: '#1B2A4A', rating: 71.1, slope: 127, yards: 6426 },
      { name: 'White', color: '#FFFFFF', rating: 69.0, slope: 123, yards: 6002 },
      { name: 'Gray', color: '#808080', rating: 67.0, slope: 118, yards: 5352 },
      { name: 'Yellow', color: '#FFD700', rating: 68.6, slope: 114, yards: 4914, gender: 'F' },
    ],
  },

  // ── Bucket List / Premier Courses ─────────────────────────────────────────
  {
    name: 'TPC Sawgrass - Stadium Course',
    city: 'Ponte Vedra Beach',
    state: 'FL',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'resort',
    architect: 'Pete Dye / Alice Dye',
    year_opened: 1980,
    grass_greens: 'Bermuda',
    grass_fairways: 'Bermuda',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'TPC (Tournament)', color: '#000000', rating: 76.8, slope: 155, yards: 7271 },
      { name: 'Blue', color: '#1B2A4A', rating: 73.9, slope: 148, yards: 6631 },
      { name: 'White', color: '#FFFFFF', rating: 70.8, slope: 138, yards: 6059 },
      { name: 'Green', color: '#2A9D8F', rating: 65.8, slope: 116, yards: 5034 },
    ],
  },
  {
    name: 'Pebble Beach Golf Links',
    city: 'Pebble Beach',
    state: 'CA',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'resort',
    architect: 'Jack Neville / Douglas Grant',
    year_opened: 1919,
    grass_greens: 'Bentgrass',
    grass_fairways: 'Bluegrass',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Blue', color: '#1B2A4A', rating: 74.9, slope: 144, yards: 6828 },
      { name: 'Gold', color: '#D4AF37', rating: 73.4, slope: 137, yards: 6508 },
      { name: 'White', color: '#FFFFFF', rating: 71.7, slope: 135, yards: 6198 },
      { name: 'Green', color: '#2A9D8F', rating: 68.7, slope: 126, yards: 5677 },
      { name: 'Red', color: '#C44B4F', rating: 67.3, slope: 124, yards: 5322 },
    ],
  },
  {
    name: 'TPC Scottsdale - Stadium Course',
    city: 'Scottsdale',
    state: 'AZ',
    country: 'US',
    par: 71,
    holes: 18,
    access: 'resort',
    architect: 'Jay Morrish / Tom Weiskopf',
    year_opened: 1986,
    grass_greens: 'Bermuda',
    grass_fairways: 'Bermuda',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'TPC', color: '#000000', rating: 74.7, slope: 142, yards: 7261 },
      { name: 'Blue', color: '#1B2A4A', rating: 72.0, slope: 136, yards: 6700 },
      { name: 'White', color: '#FFFFFF', rating: 69.5, slope: 128, yards: 6176 },
      { name: 'Gold', color: '#D4AF37', rating: 67.1, slope: 120, yards: 5624 },
      { name: 'Green', color: '#2A9D8F', rating: 65.0, slope: 114, yards: 5067 },
    ],
  },
  {
    name: 'We-Ko-Pa Golf Club - Saguaro Course',
    city: 'Fort McDowell',
    state: 'AZ',
    country: 'US',
    par: 71,
    holes: 18,
    access: 'public',
    architect: 'Bill Coore / Ben Crenshaw',
    year_opened: 2006,
    grass_greens: 'Bentgrass',
    grass_fairways: 'Fescue',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 72.1, slope: 138, yards: 6966 },
      { name: 'Blue', color: '#1B2A4A', rating: 70.2, slope: 132, yards: 6524 },
      { name: 'White', color: '#FFFFFF', rating: 68.1, slope: 126, yards: 6060 },
      { name: 'Gold', color: '#D4AF37', rating: 65.7, slope: 118, yards: 5512 },
      { name: 'Green', color: '#2A9D8F', rating: 63.4, slope: 112, yards: 4952 },
    ],
  },
  {
    name: 'The Classic Club',
    city: 'Palm Desert',
    state: 'CA',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'resort',
    architect: 'Arnold Palmer',
    year_opened: 2006,
    grass_greens: 'Bermuda',
    grass_fairways: 'Bermuda',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 75.4, slope: 144, yards: 7305 },
      { name: 'Blue', color: '#1B2A4A', rating: 72.8, slope: 138, yards: 6805 },
      { name: 'White', color: '#FFFFFF', rating: 70.2, slope: 131, yards: 6298 },
      { name: 'Gold', color: '#D4AF37', rating: 67.5, slope: 123, yards: 5735 },
      { name: 'Purple', color: '#6B4C9A', rating: 65.8, slope: 118, yards: 5320 },
      { name: 'Orange', color: '#E67E22', rating: 63.0, slope: 110, yards: 4680 },
    ],
  },
  {
    name: 'Pinehurst No. 2',
    city: 'Pinehurst',
    state: 'NC',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'resort',
    architect: 'Donald Ross',
    year_opened: 1907,
    grass_greens: 'Bermuda',
    grass_fairways: 'Bermuda',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'US Open', color: '#000000', rating: 77.9, slope: 149, yards: 7588 },
      { name: 'Blue', color: '#1B2A4A', rating: 76.5, slope: 138, yards: 6961 },
      { name: 'White', color: '#FFFFFF', rating: 73.2, slope: 133, yards: 6307 },
      { name: 'Green', color: '#2A9D8F', rating: 70.2, slope: 124, yards: 5690 },
      { name: 'Red', color: '#C44B4F', rating: 67.5, slope: 118, yards: 5118 },
    ],
  },
  {
    name: 'Bandon Dunes',
    city: 'Bandon',
    state: 'OR',
    country: 'US',
    par: 72,
    holes: 18,
    access: 'resort',
    architect: 'David McLay Kidd',
    year_opened: 1999,
    grass_greens: 'Fescue',
    grass_fairways: 'Fescue',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 74.6, slope: 145, yards: 6732 },
      { name: 'Green', color: '#2A9D8F', rating: 72.4, slope: 133, yards: 6483 },
      { name: 'Gold', color: '#D4AF37', rating: 69.6, slope: 122, yards: 5804 },
      { name: 'Orange', color: '#E67E22', rating: 67.0, slope: 115, yards: 5100 },
    ],
  },
  {
    name: 'Pacific Dunes',
    city: 'Bandon',
    state: 'OR',
    country: 'US',
    par: 71,
    holes: 18,
    access: 'resort',
    architect: 'Tom Doak',
    year_opened: 2001,
    grass_greens: 'Fescue',
    grass_fairways: 'Fescue',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Black', color: '#000000', rating: 73.2, slope: 143, yards: 6633 },
      { name: 'Green', color: '#2A9D8F', rating: 70.8, slope: 135, yards: 6142 },
      { name: 'Gold', color: '#D4AF37', rating: 68.9, slope: 131, yards: 5775 },
      { name: 'Orange', color: '#E67E22', rating: 70.3, slope: 131, yards: 5088, gender: 'F' },
      { name: 'Royal Blue', color: '#4169E1', rating: 63.9, slope: 115, yards: 3920 },
    ],
  },
  {
    name: 'St Andrews Old Course',
    city: 'St Andrews',
    state: 'Fife',
    country: 'GB',
    par: 72,
    holes: 18,
    access: 'public',
    architect: 'Old Tom Morris',
    year_opened: 1552,
    grass_greens: 'Fescue',
    grass_fairways: 'Fescue',
    data_source: 'verified',
    data_quality: 'complete',
    tee_boxes: [
      { name: 'Championship', color: '#000000', rating: 73.1, slope: 132, yards: 7190 },
      { name: 'Yellow', color: '#FFD700', rating: 71.4, slope: 129, yards: 6721 },
      { name: 'White', color: '#FFFFFF', rating: 69.8, slope: 125, yards: 6284 },
      { name: 'Red', color: '#C44B4F', rating: 74.2, slope: 134, yards: 6284, gender: 'F' },
    ],
  },
];

// ─── Upsert Logic ───────────────────────────────────────────────────────────

async function upsertCourse(course: VerifiedCourse): Promise<{ success: boolean; action: string }> {
  // Check if course already exists (by name + city)
  const { data: existing } = await supabase
    .from('courses')
    .select('id, name, data_source, data_quality')
    .ilike('name', course.name)
    .eq('city', course.city)
    .limit(1)
    .maybeSingle();

  // Get the primary (back) tee for top-level fields
  const primaryTee = course.tee_boxes[0];

  const row = {
    name: course.name,
    city: course.city,
    state: course.state,
    country: course.country,
    par: course.par,
    holes: course.holes,
    rating: primaryTee.rating,
    slope: primaryTee.slope,
    yards: primaryTee.yards,
    tee_boxes: JSON.stringify(course.tee_boxes),
    access: course.access,
    architect: course.architect ?? null,
    year_opened: course.year_opened ?? null,
    grass_greens: course.grass_greens ?? null,
    grass_fairways: course.grass_fairways ?? null,
    data_source: course.data_source,
    data_quality: course.data_quality,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    // Update existing course
    const { error } = await supabase
      .from('courses')
      .update(row)
      .eq('id', existing.id);

    if (error) return { success: false, action: `UPDATE FAILED: ${error.message}` };
    return { success: true, action: `UPDATED (was ${existing.data_quality ?? 'unknown'})` };
  } else {
    // Insert new course
    const { error } = await supabase
      .from('courses')
      .insert({ ...row, created_at: new Date().toISOString() });

    if (error) return { success: false, action: `INSERT FAILED: ${error.message}` };
    return { success: true, action: 'INSERTED' };
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('==========================================');
  console.log('  DORMIE - Seed Verified Courses');
  console.log('==========================================\n');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Courses to seed: ${VERIFIED_COURSES.length}\n`);

  let succeeded = 0;
  let failed = 0;

  for (const course of VERIFIED_COURSES) {
    const teeCount = course.tee_boxes.length;
    const primaryTee = course.tee_boxes[0];
    const label = `${course.name} (${course.city}, ${course.state})`;

    process.stdout.write(`  ${label}... `);

    const result = await upsertCourse(course);

    if (result.success) {
      console.log(`${result.action} | Par ${course.par} | ${primaryTee.rating}/${primaryTee.slope} | ${primaryTee.yards}y | ${teeCount} tees`);
      succeeded++;
    } else {
      console.log(`FAILED: ${result.action}`);
      failed++;
    }
  }

  console.log('\n==========================================');
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Total:     ${VERIFIED_COURSES.length}`);
  console.log('==========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
