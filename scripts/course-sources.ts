// ─── Course data scraping from public sources ─────────────────────────────────
// Sources tried in order:
// 1. GolfLink (searchable by state, has rating/slope/par/tees)
// 2. BlueGolf (detailed scorecards)
// 3. GolfPass (course ratings and reviews)
//
// Rate limit: 1 request per 2 seconds across all sources.

import * as https from 'https';
import * as http from 'http';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TeeBoxData = {
  name: string;
  color: string;
  rating: number;
  slope: number;
  yards: number;
};

export type ScrapedCourse = {
  name: string;
  club?: string;
  city: string;
  state: string;
  par: number;
  holes: number;
  teeBoxes: TeeBoxData[];
  access: 'public' | 'private' | 'resort' | 'unknown';
  latitude?: number;
  longitude?: number;
  sourceUrl: string;
  dataQuality: 'complete' | 'basic' | 'partial' | 'name_only';
};

type FetchResult = {
  status: number;
  body: string;
};

// ─── Rate limiter ────────────────────────────────────────────────────────────

let lastRequestTime = 0;
const RATE_LIMIT_MS = 2000; // 1 request per 2 seconds

async function rateLimitedFetch(url: string): Promise<FetchResult> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  lastRequestTime = Date.now();
  return fetchUrl(url);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchUrl(url: string): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        fetchUrl(redirectUrl).then(resolve).catch(reject);
        return;
      }

      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ─── HTML parsing helpers ────────────────────────────────────────────────────

function extractText(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

function extractNumber(html: string, regex: RegExp): number | null {
  const text = extractText(html, regex);
  if (!text) return null;
  const num = parseFloat(text);
  return isNaN(num) ? null : num;
}

function extractAllMatches(html: string, regex: RegExp): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  while ((match = re.exec(html)) !== null) {
    matches.push(match[1] ?? match[0]);
  }
  return matches;
}

/** Map common tee name keywords to colors. */
function inferTeeColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('black') || lower.includes('champion')) return '#000000';
  if (lower.includes('blue') || lower.includes('back')) return '#1B2A4A';
  if (lower.includes('gold') || lower.includes('senior')) return '#C9A227';
  if (lower.includes('white') || lower.includes('middle')) return '#FFFFFF';
  if (lower.includes('green')) return '#006747';
  if (lower.includes('red') || lower.includes('forward') || lower.includes('ladies')) return '#C41E3A';
  if (lower.includes('silver')) return '#C0C0C0';
  if (lower.includes('combo') || lower.includes('maroon')) return '#800000';
  return '#1B2A4A'; // default
}

/** Determine data quality based on what we have. */
function assessQuality(course: Partial<ScrapedCourse>): ScrapedCourse['dataQuality'] {
  if (course.teeBoxes && course.teeBoxes.length > 0) {
    const hasFullTees = course.teeBoxes.some((t) => t.rating > 0 && t.slope > 0 && t.yards > 0);
    if (hasFullTees && course.par && course.par > 0) return 'complete';
    return 'basic';
  }
  if (course.par && course.par > 0) return 'partial';
  return 'name_only';
}

// ─── Source 1: GolfLink ──────────────────────────────────────────────────────

export async function scrapeGolfLinkState(stateCode: string, stateName: string, limit: number): Promise<ScrapedCourse[]> {
  const courses: ScrapedCourse[] = [];
  const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
  let page = 1;
  const maxPages = limit === 0 ? 100 : Math.ceil(limit / 20); // GolfLink shows ~20 per page

  console.log(`[GolfLink] Scraping ${stateName} (${stateCode}), target: ${limit === 0 ? 'ALL' : limit}...`);

  while (page <= maxPages && (limit === 0 || courses.length < limit)) {
    try {
      const url = `https://www.golflink.com/golf-courses/state/${stateSlug}/?page=${page}`;
      const result = await rateLimitedFetch(url);

      if (result.status !== 200) {
        console.log(`[GolfLink] ${stateCode} page ${page}: HTTP ${result.status}`);
        break;
      }

      // Extract course listing entries
      const courseBlocks = result.body.split(/class="course-listing-item"|class="course-card"/);
      if (courseBlocks.length <= 1) {
        // Try alternate HTML structure
        const altBlocks = result.body.split(/data-course-id/);
        if (altBlocks.length <= 1) break; // No more courses
      }

      let foundOnPage = 0;
      // Parse course links from listing page
      const linkRegex = /href="(\/golf-courses\/[^"]*?\.htm)"/g;
      const links: string[] = [];
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkRegex.exec(result.body)) !== null) {
        if (!links.includes(linkMatch[1])) {
          links.push(linkMatch[1]);
        }
      }

      // Also try to extract basic data from the listing page itself
      const nameRegex = /class="course-name[^"]*"[^>]*>([^<]+)</g;
      const locationRegex = /class="course-location[^"]*"[^>]*>([^<]+)</g;
      const names = extractAllMatches(result.body, nameRegex);
      const locations = extractAllMatches(result.body, locationRegex);

      // Visit each course detail page for full data
      for (const link of links) {
        if (limit > 0 && courses.length >= limit) break;

        try {
          const detailUrl = `https://www.golflink.com${link}`;
          const detail = await rateLimitedFetch(detailUrl);

          if (detail.status !== 200) continue;

          const course = parseGolfLinkDetail(detail.body, detailUrl, stateCode);
          if (course) {
            courses.push(course);
            foundOnPage++;
          }
        } catch (err) {
          console.log(`[GolfLink] Error fetching detail: ${(err as Error).message}`);
        }
      }

      // If no detail links found, try to parse from listing page directly
      if (foundOnPage === 0 && names.length > 0) {
        for (let i = 0; i < names.length && (limit === 0 || courses.length < limit); i++) {
          const loc = locations[i] ?? '';
          const [city] = loc.split(',').map((s) => s.trim());
          courses.push({
            name: names[i],
            city: city || stateName,
            state: stateCode,
            par: 72,
            holes: 18,
            teeBoxes: [],
            access: 'unknown',
            sourceUrl: `https://www.golflink.com/golf-courses/state/${stateSlug}/?page=${page}`,
            dataQuality: 'name_only',
          });
          foundOnPage++;
        }
      }

      if (foundOnPage === 0) break; // No more results
      console.log(`[GolfLink] ${stateCode} page ${page}: found ${foundOnPage} courses (total: ${courses.length})`);
      page++;
    } catch (err) {
      console.log(`[GolfLink] ${stateCode} page ${page} error: ${(err as Error).message}`);
      break;
    }
  }

  return courses;
}

function parseGolfLinkDetail(html: string, url: string, stateCode: string): ScrapedCourse | null {
  // Course name
  const name = extractText(html, /<h1[^>]*class="[^"]*course-name[^"]*"[^>]*>(.*?)<\/h1>/s)
    ?? extractText(html, /<h1[^>]*>(.*?)<\/h1>/s);
  if (!name) return null;

  // Location
  const city = extractText(html, /class="[^"]*city[^"]*"[^>]*>([^<]+)/)
    ?? extractText(html, /City:\s*<[^>]+>([^<]+)/)
    ?? '';

  // Par, Rating, Slope from scorecard section
  const par = extractNumber(html, /Par[:\s]*<[^>]+>(\d+)/)
    ?? extractNumber(html, /par[:\s]*(\d+)/i)
    ?? 72;

  // Tee boxes
  const teeBoxes = parseGolfLinkTees(html);

  // Access type
  let access: ScrapedCourse['access'] = 'unknown';
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes('public course') || lowerHtml.includes('type: public') || lowerHtml.includes('>public<')) access = 'public';
  else if (lowerHtml.includes('private course') || lowerHtml.includes('type: private') || lowerHtml.includes('>private<')) access = 'private';
  else if (lowerHtml.includes('resort')) access = 'resort';

  // Lat/long
  const lat = extractNumber(html, /latitude["\s:]+(-?\d+\.\d+)/);
  const lng = extractNumber(html, /longitude["\s:]+(-?\d+\.\d+)/);

  // Holes
  const holesNum = extractNumber(html, /(\d+)\s*holes/i) ?? (par > 40 ? 18 : 9);

  const course: ScrapedCourse = {
    name: cleanCourseName(name),
    city,
    state: stateCode,
    par,
    holes: holesNum,
    teeBoxes,
    access,
    sourceUrl: url,
    dataQuality: 'name_only', // will be reassessed
  };

  if (lat && lng) {
    course.latitude = lat;
    course.longitude = lng;
  }

  course.dataQuality = assessQuality(course);
  return course;
}

function parseGolfLinkTees(html: string): TeeBoxData[] {
  const tees: TeeBoxData[] = [];

  // Look for tee box table rows
  // Common pattern: <tr> with tee name, rating, slope, yardage
  const teeRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = teeRowRegex.exec(html)) !== null) {
    const row = rowMatch[1];
    const cells = extractAllMatches(row, /<td[^>]*>([\s\S]*?)<\/td>/);
    if (cells.length < 3) continue;

    // Try to identify tee rows: first cell is name, then rating, slope, yards
    const teeName = cells[0]?.replace(/<[^>]+>/g, '').trim() ?? '';
    if (!teeName || teeName.toLowerCase() === 'tee' || teeName.toLowerCase() === 'tees') continue;

    // Check if this looks like a tee name (common tee names)
    const teeKeywords = ['black', 'blue', 'white', 'red', 'gold', 'green', 'silver', 'champion', 'back', 'middle', 'forward', 'ladies', 'senior', 'tips', 'men', 'women'];
    const lowerName = teeName.toLowerCase();
    const isTeeRow = teeKeywords.some((k) => lowerName.includes(k)) || /^\w+\s*tees?$/i.test(teeName);

    if (!isTeeRow && cells.length < 4) continue;

    const nums = cells.slice(1).map((c) => {
      const n = parseFloat(c.replace(/<[^>]+>/g, '').replace(/,/g, '').trim());
      return isNaN(n) ? 0 : n;
    });

    // Heuristic: rating is 55-80, slope is 55-155, yards is 3000-8500
    let rating = 0, slope = 0, yards = 0;
    for (const n of nums) {
      if (n >= 3000 && n <= 8500 && yards === 0) yards = n;
      else if (n >= 55 && n <= 80 && rating === 0) rating = n;
      else if (n >= 55 && n <= 160 && slope === 0) slope = n;
    }

    if (rating > 0 || slope > 0 || yards > 0) {
      tees.push({
        name: teeName,
        color: inferTeeColor(teeName),
        rating,
        slope,
        yards,
      });
    }
  }

  return tees;
}

// ─── Source 2: BlueGolf ──────────────────────────────────────────────────────

export async function scrapeBlueGolfState(stateCode: string, stateName: string, limit: number): Promise<ScrapedCourse[]> {
  const courses: ScrapedCourse[] = [];
  console.log(`[BlueGolf] Scraping ${stateName} (${stateCode}), target: ${limit === 0 ? 'ALL' : limit}...`);

  try {
    // BlueGolf has a course directory searchable by state
    const url = `https://course.bluegolf.com/bluegolf/course/directory.htm?state=${stateCode}`;
    const result = await rateLimitedFetch(url);

    if (result.status !== 200) {
      console.log(`[BlueGolf] ${stateCode}: HTTP ${result.status}`);
      return courses;
    }

    // Extract course links
    const courseLinks: string[] = [];
    const linkRegex = /href="(\/bluegolf\/course\/[^"]*?\.htm)"/g;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(result.body)) !== null) {
      if (!courseLinks.includes(linkMatch[1]) && !linkMatch[1].includes('directory')) {
        courseLinks.push(linkMatch[1]);
      }
    }

    console.log(`[BlueGolf] ${stateCode}: found ${courseLinks.length} course links`);

    for (const link of courseLinks) {
      if (limit > 0 && courses.length >= limit) break;

      try {
        const detailUrl = `https://course.bluegolf.com${link}`;
        const detail = await rateLimitedFetch(detailUrl);
        if (detail.status !== 200) continue;

        const course = parseBlueGolfDetail(detail.body, detailUrl, stateCode);
        if (course) {
          courses.push(course);
        }
      } catch (err) {
        console.log(`[BlueGolf] Error fetching detail: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    console.log(`[BlueGolf] ${stateCode} error: ${(err as Error).message}`);
  }

  return courses;
}

function parseBlueGolfDetail(html: string, url: string, stateCode: string): ScrapedCourse | null {
  const name = extractText(html, /<h1[^>]*>(.*?)<\/h1>/s)
    ?? extractText(html, /class="course-name[^"]*"[^>]*>([^<]+)/);
  if (!name) return null;

  const city = extractText(html, /class="[^"]*city[^"]*"[^>]*>([^<]+)/)
    ?? extractText(html, /class="[^"]*location[^"]*"[^>]*>([^<,]+)/);

  const par = extractNumber(html, /Par[:\s]*(\d+)/i) ?? 72;
  const teeBoxes = parseBlueGolfTees(html);

  const lat = extractNumber(html, /lat[itude]*["\s:=]+(-?\d+\.\d+)/);
  const lng = extractNumber(html, /lng|lon[gitude]*["\s:=]+(-?\d+\.\d+)/);

  const course: ScrapedCourse = {
    name: cleanCourseName(name),
    city: city ?? '',
    state: stateCode,
    par,
    holes: par > 40 ? 18 : 9,
    teeBoxes,
    access: 'unknown',
    sourceUrl: url,
    dataQuality: 'name_only',
  };

  if (lat && lng) {
    course.latitude = lat;
    course.longitude = lng;
  }

  course.dataQuality = assessQuality(course);
  return course;
}

function parseBlueGolfTees(html: string): TeeBoxData[] {
  const tees: TeeBoxData[] = [];

  // BlueGolf scorecard tables typically have tee data in a structured format
  // Look for scorecard section
  const scorecardSection = html.match(/class="[^"]*scorecard[^"]*"([\s\S]*?)(?=class="[^"]*(?:footer|sidebar)|$)/i);
  const section = scorecardSection ? scorecardSection[1] : html;

  // Parse tee rows similar to GolfLink
  const teeRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = teeRowRegex.exec(section)) !== null) {
    const row = rowMatch[1];
    const cells = extractAllMatches(row, /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/);
    if (cells.length < 3) continue;

    const teeName = cells[0]?.replace(/<[^>]+>/g, '').trim() ?? '';
    if (!teeName) continue;

    const teeKeywords = ['black', 'blue', 'white', 'red', 'gold', 'green', 'silver', 'champion', 'back', 'middle', 'forward'];
    const lowerName = teeName.toLowerCase();
    const isTeeRow = teeKeywords.some((k) => lowerName.includes(k));
    if (!isTeeRow) continue;

    const nums = cells.slice(1).map((c) => {
      const n = parseFloat(c.replace(/<[^>]+>/g, '').replace(/,/g, '').trim());
      return isNaN(n) ? 0 : n;
    });

    let rating = 0, slope = 0, yards = 0;
    for (const n of nums) {
      if (n >= 3000 && n <= 8500 && yards === 0) yards = n;
      else if (n >= 55 && n <= 80 && rating === 0) rating = n;
      else if (n >= 55 && n <= 160 && slope === 0) slope = n;
    }

    if (rating > 0 || slope > 0 || yards > 0) {
      tees.push({ name: teeName, color: inferTeeColor(teeName), rating, slope, yards });
    }
  }

  return tees;
}

// ─── Source 3: GolfPass ──────────────────────────────────────────────────────

export async function scrapeGolfPassState(stateCode: string, stateName: string, limit: number): Promise<ScrapedCourse[]> {
  const courses: ScrapedCourse[] = [];
  const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
  let page = 1;
  const maxPages = limit === 0 ? 50 : Math.ceil(limit / 25);

  console.log(`[GolfPass] Scraping ${stateName} (${stateCode}), target: ${limit === 0 ? 'ALL' : limit}...`);

  while (page <= maxPages && (limit === 0 || courses.length < limit)) {
    try {
      const url = `https://www.golfpass.com/travel-advisor/course-directory/${stateSlug}?page=${page}`;
      const result = await rateLimitedFetch(url);

      if (result.status !== 200) {
        console.log(`[GolfPass] ${stateCode} page ${page}: HTTP ${result.status}`);
        break;
      }

      // Extract course cards
      const nameRegex = /class="[^"]*course-name[^"]*"[^>]*>([^<]+)/g;
      const names = extractAllMatches(result.body, nameRegex);

      // Also try JSON-LD or data attributes
      const jsonLdMatch = result.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
          if (Array.isArray(ld)) {
            for (const item of ld) {
              if (item['@type'] === 'GolfCourse' && (limit === 0 || courses.length < limit)) {
                courses.push({
                  name: cleanCourseName(item.name ?? ''),
                  city: item.address?.addressLocality ?? '',
                  state: stateCode,
                  par: 72,
                  holes: 18,
                  teeBoxes: [],
                  access: 'unknown',
                  sourceUrl: url,
                  dataQuality: 'name_only',
                  latitude: item.geo?.latitude,
                  longitude: item.geo?.longitude,
                });
              }
            }
          }
        } catch { /* ignore JSON parse errors */ }
      }

      // Extract from course listing links
      const courseLinks: string[] = [];
      const courseLinkRegex = /href="(\/travel-advisor\/course\/[^"]+)"/g;
      let clMatch: RegExpExecArray | null;
      while ((clMatch = courseLinkRegex.exec(result.body)) !== null) {
        if (!courseLinks.includes(clMatch[1])) courseLinks.push(clMatch[1]);
      }

      let foundOnPage = 0;
      for (const link of courseLinks) {
        if (limit > 0 && courses.length >= limit) break;

        try {
          const detailUrl = `https://www.golfpass.com${link}`;
          const detail = await rateLimitedFetch(detailUrl);
          if (detail.status !== 200) continue;

          const course = parseGolfPassDetail(detail.body, detailUrl, stateCode);
          if (course) {
            courses.push(course);
            foundOnPage++;
          }
        } catch (err) {
          console.log(`[GolfPass] Error fetching detail: ${(err as Error).message}`);
        }
      }

      if (foundOnPage === 0 && names.length === 0) break;
      console.log(`[GolfPass] ${stateCode} page ${page}: found ${foundOnPage} courses (total: ${courses.length})`);
      page++;
    } catch (err) {
      console.log(`[GolfPass] ${stateCode} page ${page} error: ${(err as Error).message}`);
      break;
    }
  }

  return courses;
}

function parseGolfPassDetail(html: string, url: string, stateCode: string): ScrapedCourse | null {
  const name = extractText(html, /<h1[^>]*>(.*?)<\/h1>/s);
  if (!name) return null;

  const city = extractText(html, /class="[^"]*city[^"]*"[^>]*>([^<]+)/)
    ?? extractText(html, /class="[^"]*location[^"]*"[^>]*>([^<,]+)/);

  const par = extractNumber(html, /Par[:\s]*(\d+)/i) ?? 72;
  const rating = extractNumber(html, /Rating[:\s]*(\d+\.?\d*)/i);
  const slope = extractNumber(html, /Slope[:\s]*(\d+)/i);
  const yards = extractNumber(html, /Yards?[:\s]*([\d,]+)/i);

  const teeBoxes: TeeBoxData[] = [];
  // If we got top-level rating/slope/yards, create a default tee
  if (rating || slope || yards) {
    teeBoxes.push({
      name: 'Default',
      color: '#1B2A4A',
      rating: rating ?? 72.0,
      slope: slope ?? 113,
      yards: yards ?? 6500,
    });
  }

  // Try to find tee box table
  const tableTees = parseGolfPassTees(html);
  if (tableTees.length > 0) {
    teeBoxes.length = 0;
    teeBoxes.push(...tableTees);
  }

  let access: ScrapedCourse['access'] = 'unknown';
  const lower = html.toLowerCase();
  if (lower.includes('>public<') || lower.includes('public course')) access = 'public';
  else if (lower.includes('>private<') || lower.includes('private course')) access = 'private';
  else if (lower.includes('>resort<') || lower.includes('resort course')) access = 'resort';

  const lat = extractNumber(html, /latitude["\s:=]+(-?\d+\.\d+)/);
  const lng = extractNumber(html, /longitude["\s:=]+(-?\d+\.\d+)/);

  const course: ScrapedCourse = {
    name: cleanCourseName(name),
    city: city ?? '',
    state: stateCode,
    par,
    holes: par > 40 ? 18 : 9,
    teeBoxes,
    access,
    sourceUrl: url,
    dataQuality: 'name_only',
  };

  if (lat && lng) {
    course.latitude = lat;
    course.longitude = lng;
  }

  course.dataQuality = assessQuality(course);
  return course;
}

function parseGolfPassTees(html: string): TeeBoxData[] {
  const tees: TeeBoxData[] = [];
  const teeRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = teeRowRegex.exec(html)) !== null) {
    const row = rowMatch[1];
    const cells = extractAllMatches(row, /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/);
    if (cells.length < 3) continue;

    const teeName = cells[0]?.replace(/<[^>]+>/g, '').trim() ?? '';
    if (!teeName) continue;

    const teeKeywords = ['black', 'blue', 'white', 'red', 'gold', 'green', 'silver', 'champion', 'back', 'middle', 'forward'];
    const lowerName = teeName.toLowerCase();
    if (!teeKeywords.some((k) => lowerName.includes(k))) continue;

    const nums = cells.slice(1).map((c) => {
      const n = parseFloat(c.replace(/<[^>]+>/g, '').replace(/,/g, '').trim());
      return isNaN(n) ? 0 : n;
    });

    let rating = 0, slope = 0, yards = 0;
    for (const n of nums) {
      if (n >= 3000 && n <= 8500 && yards === 0) yards = n;
      else if (n >= 55 && n <= 80 && rating === 0) rating = n;
      else if (n >= 55 && n <= 160 && slope === 0) slope = n;
    }

    if (rating > 0 || slope > 0 || yards > 0) {
      tees.push({ name: teeName, color: inferTeeColor(teeName), rating, slope, yards });
    }
  }
  return tees;
}

// ─── Source 4: RapidAPI Golf Course Finder ──────────────────────────────────
// https://rapidapi.com/golfambit-golfambit-default/api/golf-course-finder
// Free tier: 500 requests/month. Has 30,000+ courses with scorecard data.
// Requires EXPO_PUBLIC_RAPIDAPI_KEY env var (sign up at rapidapi.com).

export async function scrapeRapidAPIState(stateCode: string, stateName: string, limit: number): Promise<ScrapedCourse[]> {
  const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
  if (!apiKey) {
    console.log('[RapidAPI] Skipped — EXPO_PUBLIC_RAPIDAPI_KEY not set. Sign up at https://rapidapi.com/golfambit-golfambit-default/api/golf-course-finder');
    return [];
  }

  const courses: ScrapedCourse[] = [];
  console.log(`[RapidAPI] Fetching ${stateName} (${stateCode}), target: ${limit === 0 ? 'ALL' : limit}...`);

  let page = 1;
  const perPage = 50;
  const maxPages = limit === 0 ? 20 : Math.ceil(limit / perPage);

  while (page <= maxPages && (limit === 0 || courses.length < limit)) {
    try {
      const url = `https://golf-course-finder.p.rapidapi.com/courses?state=${encodeURIComponent(stateName)}&page=${page}&per_page=${perPage}`;
      const res = await fetchWithRapidAPI(url, apiKey);

      if (!res || res.status !== 200) {
        console.log(`[RapidAPI] ${stateCode} page ${page}: HTTP ${res?.status ?? 'timeout'}`);
        break;
      }

      let data: any;
      try {
        data = JSON.parse(res.body);
      } catch {
        console.log(`[RapidAPI] ${stateCode} page ${page}: invalid JSON`);
        break;
      }

      const items = Array.isArray(data) ? data : data?.courses ?? data?.results ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        if (limit > 0 && courses.length >= limit) break;
        const course = parseRapidAPICourse(item, stateCode);
        if (course) courses.push(course);
      }

      console.log(`[RapidAPI] ${stateCode} page ${page}: found ${items.length} (total: ${courses.length})`);
      page++;

      // Respect rate limit
      await sleep(1000);
    } catch (err) {
      console.log(`[RapidAPI] ${stateCode} page ${page} error: ${(err as Error).message}`);
      break;
    }
  }

  return courses;
}

/**
 * Search for a specific course by name via RapidAPI.
 */
export async function searchRapidAPICourse(name: string, state: string): Promise<ScrapedCourse | null> {
  const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://golf-course-finder.p.rapidapi.com/courses?name=${encodeURIComponent(name)}&state=${encodeURIComponent(state)}&per_page=5`;
    const res = await fetchWithRapidAPI(url, apiKey);
    if (!res || res.status !== 200) return null;

    const data = JSON.parse(res.body);
    const items = Array.isArray(data) ? data : data?.courses ?? data?.results ?? [];
    if (items.length === 0) return null;

    // Find best name match
    const normalTarget = normalizeName(name);
    const best = items.find((item: any) =>
      normalizeName(item.name ?? item.club_name ?? '').includes(normalTarget.slice(0, 10))
    ) ?? items[0];

    return parseRapidAPICourse(best, state);
  } catch {
    return null;
  }
}

function parseRapidAPICourse(item: any, stateCode: string): ScrapedCourse | null {
  const name = item.name ?? item.club_name ?? item.course_name;
  if (!name) return null;

  const city = item.city ?? item.location?.city ?? '';

  // Parse tee boxes from various possible API shapes
  const teeBoxes: TeeBoxData[] = [];
  const tees = item.tees ?? item.tee_boxes ?? item.scorecard?.tees ?? [];

  if (Array.isArray(tees)) {
    for (const tee of tees) {
      const teeName = tee.name ?? tee.tee_name ?? tee.color ?? 'Default';
      const rating = parseFloat(tee.rating ?? tee.course_rating ?? 0);
      const slope = parseInt(tee.slope ?? tee.slope_rating ?? 0, 10);
      const yards = parseInt(tee.yards ?? tee.yardage ?? tee.total_yards ?? 0, 10);

      if (rating > 0 || slope > 0 || yards > 0) {
        teeBoxes.push({
          name: teeName,
          color: inferTeeColor(teeName),
          rating: isNaN(rating) ? 0 : rating,
          slope: isNaN(slope) ? 0 : slope,
          yards: isNaN(yards) ? 0 : yards,
        });
      }
    }
  }

  // Top-level fallback for rating/slope/yards
  if (teeBoxes.length === 0) {
    const rating = parseFloat(item.rating ?? item.course_rating ?? 0);
    const slope = parseInt(item.slope ?? item.slope_rating ?? 0, 10);
    const yards = parseInt(item.yards ?? item.yardage ?? 0, 10);

    if (rating > 0 || slope > 0 || yards > 0) {
      teeBoxes.push({
        name: 'Default',
        color: '#1B2A4A',
        rating: isNaN(rating) ? 0 : rating,
        slope: isNaN(slope) ? 0 : slope,
        yards: isNaN(yards) ? 0 : yards,
      });
    }
  }

  const par = parseInt(item.par ?? item.total_par ?? 72, 10);
  const holes = parseInt(item.holes ?? item.number_of_holes ?? (par > 40 ? 18 : 9), 10);

  let access: ScrapedCourse['access'] = 'unknown';
  const type = (item.type ?? item.access ?? item.course_type ?? '').toLowerCase();
  if (type.includes('public') || type.includes('daily')) access = 'public';
  else if (type.includes('private')) access = 'private';
  else if (type.includes('resort')) access = 'resort';

  const course: ScrapedCourse = {
    name: cleanCourseName(name),
    city,
    state: stateCode,
    par: isNaN(par) ? 72 : par,
    holes: isNaN(holes) ? 18 : holes,
    teeBoxes,
    access,
    sourceUrl: `rapidapi:golf-course-finder:${item.id ?? name}`,
    dataQuality: 'name_only',
  };

  if (item.latitude || item.lat) course.latitude = parseFloat(item.latitude ?? item.lat);
  if (item.longitude || item.lng || item.lon) course.longitude = parseFloat(item.longitude ?? item.lng ?? item.lon);

  course.dataQuality = assessQuality(course);
  return course;
}

function fetchWithRapidAPI(url: string, apiKey: string): Promise<FetchResult | null> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'golf-course-finder.p.rapidapi.com',
        'Accept': 'application/json',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ─── Unified multi-source scraper ────────────────────────────────────────────

export type SourceName = 'rapidapi' | 'golflink' | 'bluegolf' | 'golfpass';

const SOURCE_SCRAPERS: Record<SourceName, (state: string, name: string, limit: number) => Promise<ScrapedCourse[]>> = {
  rapidapi: scrapeRapidAPIState,
  golflink: scrapeGolfLinkState,
  bluegolf: scrapeBlueGolfState,
  golfpass: scrapeGolfPassState,
};

// RapidAPI first — it has structured JSON data (no scraping), then fall back to web scrapers
const SOURCE_ORDER: SourceName[] = ['rapidapi', 'golflink', 'bluegolf', 'golfpass'];

/**
 * Scrape courses for a state from all sources, merging and deduplicating.
 * Tries sources in order: GolfLink → BlueGolf → GolfPass.
 * Stops early if we hit the target count from any source.
 */
export async function scrapeState(
  stateCode: string,
  stateName: string,
  targetCount: number,
  onProgress?: (count: number, source: SourceName) => void,
): Promise<ScrapedCourse[]> {
  const allCourses = new Map<string, ScrapedCourse>();

  for (const source of SOURCE_ORDER) {
    const remaining = targetCount === 0 ? 0 : targetCount - allCourses.size;
    if (targetCount > 0 && remaining <= 0) break;

    try {
      console.log(`\n[Import] Trying ${source} for ${stateName}...`);
      const scraped = await SOURCE_SCRAPERS[source](stateCode, stateName, remaining);
      console.log(`[Import] ${source} returned ${scraped.length} courses for ${stateName}`);

      for (const course of scraped) {
        const key = normalizeName(course.name);
        const existing = allCourses.get(key);
        if (!existing || qualityRank(course.dataQuality) > qualityRank(existing.dataQuality)) {
          allCourses.set(key, course);
        }
      }

      onProgress?.(allCourses.size, source);
    } catch (err) {
      console.log(`[Import] ${source} failed for ${stateName}: ${(err as Error).message}`);
    }
  }

  return Array.from(allCourses.values());
}

/**
 * Attempt to scrape detailed data for a single named course.
 * Used for national list courses where we know the name but need tee data.
 */
export async function scrapeNamedCourse(
  name: string,
  city: string,
  state: string,
): Promise<ScrapedCourse | null> {
  // Try searching each source for this specific course
  for (const source of SOURCE_ORDER) {
    try {
      const searchQuery = encodeURIComponent(`${name} ${city} ${state}`);

      // Try RapidAPI first (structured data, no scraping)
      if (source === 'rapidapi') {
        const result = await searchRapidAPICourse(name, state);
        if (result && result.dataQuality !== 'name_only') return result;
      }

      if (source === 'golflink') {
        const url = `https://www.golflink.com/golf-courses/search/?q=${searchQuery}`;
        const result = await rateLimitedFetch(url);
        if (result.status === 200) {
          const firstLink = result.body.match(/href="(\/golf-courses\/[^"]*?\.htm)"/);
          if (firstLink) {
            const detail = await rateLimitedFetch(`https://www.golflink.com${firstLink[1]}`);
            if (detail.status === 200) {
              const course = parseGolfLinkDetail(detail.body, `https://www.golflink.com${firstLink[1]}`, state);
              if (course && normalizeName(course.name).includes(normalizeName(name).slice(0, 10))) {
                return course;
              }
            }
          }
        }
      }

      if (source === 'golfpass') {
        const url = `https://www.golfpass.com/travel-advisor/course-directory/search?q=${searchQuery}`;
        const result = await rateLimitedFetch(url);
        if (result.status === 200) {
          const firstLink = result.body.match(/href="(\/travel-advisor\/course\/[^"]+)"/);
          if (firstLink) {
            const detail = await rateLimitedFetch(`https://www.golfpass.com${firstLink[1]}`);
            if (detail.status === 200) {
              const course = parseGolfPassDetail(detail.body, `https://www.golfpass.com${firstLink[1]}`, state);
              if (course) return course;
            }
          }
        }
      }
    } catch (err) {
      console.log(`[Import] ${source} search failed for "${name}": ${(err as Error).message}`);
    }
  }

  return null;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function cleanCourseName(name: string): string {
  return name
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/golf|course|club|country|links|resort/g, '');
}

function qualityRank(q: ScrapedCourse['dataQuality']): number {
  switch (q) {
    case 'complete': return 4;
    case 'basic': return 3;
    case 'partial': return 2;
    case 'name_only': return 1;
  }
}
