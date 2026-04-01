/**
 * USGA Course Rating Lookup Service
 *
 * Searches the USGA Course Rating Database (ncrdb.usga.org) for official
 * tee box data including rating, slope, and bogey rating.
 *
 * Flow:
 *   1. Check Supabase hole_data for cached tee_boxes
 *   2. If missing, scrape ncrdb.usga.org for tee data
 *   3. Save results back to Supabase hole_data
 *   4. Return tee boxes for selection
 */

import { supabase } from '../lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export type USGATeeBox = {
  name: string;
  gender: 'M' | 'F';
  rating: number;
  bogeyRating: number;
  slope: number;
  frontRating?: number;
  frontSlope?: number;
  backRating?: number;
  backSlope?: number;
  color: string;
  yards?: number;
};

export type USGASearchResult = {
  courseId: string;
  courseName: string;
  city: string;
  state: string;
  teeBoxes: USGATeeBox[];
  lastUpdated: string;
};

type CachedTeeData = {
  tee_boxes?: USGATeeBox[];
  usga_lookup_at?: string;
  [key: string]: unknown;
};

// ─── Color mapping for tee names ────────────────────────────────────────────

const TEE_COLORS: Record<string, string> = {
  black: '#000000',
  championship: '#000000',
  tournament: '#000000',
  tips: '#000000',
  blue: '#1B2A4A',
  white: '#FFFFFF',
  gold: '#D4AF37',
  yellow: '#FFD700',
  green: '#2A9D8F',
  red: '#C44B4F',
  silver: '#C0C0C0',
  gray: '#808080',
  grey: '#808080',
  purple: '#6B4C9A',
  orange: '#E67E22',
  combo: '#4A90D9',
};

function getTeeColor(teeName: string): string {
  const lower = teeName.toLowerCase();
  for (const [key, color] of Object.entries(TEE_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#1B2A4A'; // default blue
}

// ─── USGA NCRDB Scraper ─────────────────────────────────────────────────────

/**
 * Search the USGA Course Rating Database for a course by name.
 * The NCRDB site at ncrdb.usga.org provides search and detail pages.
 *
 * Returns parsed tee box data or null if not found / scraping fails.
 */
async function searchUSGA(courseName: string, state?: string): Promise<USGASearchResult | null> {
  try {
    // Build search URL — NCRDB uses query params for search
    const searchQuery = encodeURIComponent(courseName);
    const stateParam = state ? `&State=${encodeURIComponent(state)}` : '';
    const searchUrl = `https://ncrdb.usga.org/courseTeeInfo?CourseID=&CourseName=${searchQuery}${stateParam}`;

    console.log(`[USGA] Searching: ${courseName}${state ? ` (${state})` : ''}`);

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DormieApp/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!searchResponse.ok) {
      console.log(`[USGA] Search failed: ${searchResponse.status}`);
      return null;
    }

    const html = await searchResponse.text();

    // Parse course results from HTML table
    // The NCRDB returns a table with course names and links to detail pages
    const courseLinks = parseSearchResults(html, courseName);

    if (courseLinks.length === 0) {
      console.log('[USGA] No courses found');
      return null;
    }

    // Get the best match (first result)
    const best = courseLinks[0];
    console.log(`[USGA] Found: ${best.name} (${best.city}, ${best.state})`);

    // Fetch the detail page for tee data
    if (best.detailUrl) {
      const teeData = await fetchTeeDetails(best.detailUrl);
      if (teeData && teeData.length > 0) {
        return {
          courseId: best.id,
          courseName: best.name,
          city: best.city,
          state: best.state,
          teeBoxes: teeData,
          lastUpdated: new Date().toISOString(),
        };
      }
    }

    return null;
  } catch (err) {
    console.log('[USGA] Search error:', err);
    return null;
  }
}

type ParsedCourseLink = {
  id: string;
  name: string;
  city: string;
  state: string;
  detailUrl: string;
};

/**
 * Parse NCRDB search results HTML to extract course links.
 * Looks for table rows containing course name, city, state, and detail link.
 */
function parseSearchResults(html: string, searchName: string): ParsedCourseLink[] {
  const results: ParsedCourseLink[] = [];

  // Match table rows with course data — NCRDB uses <a href="/courseTeeInfo?CourseID=XXX">
  const linkPattern = /href="\/courseTeeInfo\?CourseID=(\d+)[^"]*"[^>]*>([^<]+)/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const id = match[1];
    const name = match[2].trim();

    // Try to extract city/state from surrounding table cells
    const rowStart = html.lastIndexOf('<tr', match.index);
    const rowEnd = html.indexOf('</tr>', match.index);
    const rowHtml = rowStart >= 0 && rowEnd >= 0 ? html.slice(rowStart, rowEnd) : '';

    // Extract td contents
    const tdPattern = /<td[^>]*>([^<]*)</g;
    const cells: string[] = [];
    let tdMatch;
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1].trim());
    }

    // Typically: [CourseName, City, State, ...]
    const city = cells[1] || '';
    const state = cells[2] || '';

    results.push({
      id,
      name,
      city,
      state,
      detailUrl: `https://ncrdb.usga.org/courseTeeInfo?CourseID=${id}`,
    });
  }

  // Sort by relevance (exact match first, then contains)
  const searchLower = searchName.toLowerCase();
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === searchLower ? 0 : 1;
    const bExact = b.name.toLowerCase() === searchLower ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    const aContains = a.name.toLowerCase().includes(searchLower) ? 0 : 1;
    const bContains = b.name.toLowerCase().includes(searchLower) ? 0 : 1;
    return aContains - bContains;
  });

  return results;
}

/**
 * Fetch tee box details from a NCRDB course detail page.
 * Parses the tee information table for rating, slope, and bogey rating.
 */
async function fetchTeeDetails(detailUrl: string): Promise<USGATeeBox[]> {
  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DormieApp/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    return parseTeeTable(html);
  } catch (err) {
    console.log('[USGA] Detail fetch error:', err);
    return [];
  }
}

/**
 * Parse tee box data from the NCRDB detail page HTML.
 * The table typically has columns: Tee Name, Gender, Par, Rating, Bogey Rating, Slope,
 * Front Rating, Front Slope, Back Rating, Back Slope, Effective Date
 */
function parseTeeTable(html: string): USGATeeBox[] {
  const tees: USGATeeBox[] = [];

  // Find the tee data table — look for rows with rating/slope patterns
  // NCRDB format: each tee row has name, gender (M/F), par, rating, bogey rating, slope
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;

    while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
      // Strip HTML tags and whitespace
      cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
    }

    // Need at least 6 columns for a valid tee row: name, gender, par, rating, bogey, slope
    if (cells.length < 6) continue;

    // Check if this looks like a tee data row (has a valid rating number like 68.5)
    const ratingCell = cells[3];
    const slopeCell = cells[5];
    const rating = parseFloat(ratingCell);
    const slope = parseInt(slopeCell, 10);

    if (isNaN(rating) || isNaN(slope) || rating < 50 || rating > 85 || slope < 55 || slope > 160) {
      continue; // Not a valid tee data row
    }

    const teeName = cells[0];
    const gender = cells[1]?.toUpperCase() === 'F' ? 'F' : 'M';
    const bogeyRating = parseFloat(cells[4]) || rating + 10;

    // Optional front/back nine data
    const frontRating = cells.length > 6 ? parseFloat(cells[6]) || undefined : undefined;
    const frontSlope = cells.length > 7 ? parseInt(cells[7], 10) || undefined : undefined;
    const backRating = cells.length > 8 ? parseFloat(cells[8]) || undefined : undefined;
    const backSlope = cells.length > 9 ? parseInt(cells[9], 10) || undefined : undefined;

    tees.push({
      name: teeName,
      gender: gender as 'M' | 'F',
      rating,
      bogeyRating,
      slope,
      frontRating,
      frontSlope,
      backRating,
      backSlope,
      color: getTeeColor(teeName),
    });
  }

  console.log(`[USGA] Parsed ${tees.length} tee boxes`);
  return tees;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const usgaService = {
  /**
   * Look up tee box data for a course. Checks Supabase cache first,
   * then falls back to USGA NCRDB scraping.
   *
   * @param courseId - Supabase course ID
   * @param courseName - Course name for USGA search
   * @param state - Optional state abbreviation to narrow search
   * @returns Array of tee boxes, or empty array if not found
   */
  async getTeeBoxes(courseId: string, courseName: string, state?: string): Promise<USGATeeBox[]> {
    // 1. Check Supabase hole_data for cached tee_boxes
    try {
      const { data: course } = await supabase
        .from('courses')
        .select('hole_data')
        .eq('id', courseId)
        .single();

      const holeData = course?.hole_data as CachedTeeData | null;
      if (holeData?.tee_boxes && holeData.tee_boxes.length > 0) {
        console.log(`[USGA] Cache hit: ${courseName} (${holeData.tee_boxes.length} tees)`);
        return holeData.tee_boxes;
      }
    } catch {
      // No cached data, continue to USGA lookup
    }

    // 2. Search USGA NCRDB
    const result = await searchUSGA(courseName, state);
    if (!result || result.teeBoxes.length === 0) {
      console.log(`[USGA] No tee data found for ${courseName}`);
      return [];
    }

    // 3. Save results to Supabase hole_data
    try {
      const { data: existing } = await supabase
        .from('courses')
        .select('hole_data')
        .eq('id', courseId)
        .single();

      const existingData = (existing?.hole_data as CachedTeeData) ?? {};
      const updatedHoleData = {
        ...existingData,
        tee_boxes: result.teeBoxes,
        usga_lookup_at: result.lastUpdated,
        usga_course_id: result.courseId,
      };

      await supabase
        .from('courses')
        .update({ hole_data: updatedHoleData })
        .eq('id', courseId);

      console.log(`[USGA] Saved ${result.teeBoxes.length} tee boxes to Supabase`);
    } catch (err) {
      console.log('[USGA] Failed to cache results:', err);
    }

    return result.teeBoxes;
  },

  /**
   * Quick check if a course already has tee box data cached.
   */
  async hasCachedTees(courseId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('courses')
        .select('hole_data')
        .eq('id', courseId)
        .single();

      const holeData = data?.hole_data as CachedTeeData | null;
      return !!(holeData?.tee_boxes && holeData.tee_boxes.length > 0);
    } catch {
      return false;
    }
  },

  /**
   * Convert USGA tee boxes to the format used by courses.service.ts TeeBox type.
   */
  toScorecardTeeBoxes(usgaTees: USGATeeBox[]): Array<{ name: string; color: string; rating: number; slope: number; yards: number }> {
    return usgaTees.map((t) => ({
      name: `${t.name}${t.gender === 'F' ? ' (W)' : ''}`,
      color: t.color,
      rating: t.rating,
      slope: t.slope,
      yards: t.yards ?? 0,
    }));
  },

  /**
   * Extract state from a location string like "Nashville, TN" or "Ponte Vedra Beach, FL".
   */
  parseState(location?: string): string | undefined {
    if (!location) return undefined;
    const parts = location.split(',').map((s) => s.trim());
    const last = parts[parts.length - 1];
    // Check if it's a 2-letter state code
    if (last && /^[A-Z]{2}$/.test(last)) return last;
    return undefined;
  },
};
