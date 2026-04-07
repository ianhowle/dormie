import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';
const CACHE_PREFIX = 'gplace_';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

type CachedPlace = {
  photoUrl: string;
  placeId: string;
  photoReference?: string;
  fetchedAt: number;
};

// ─── Deterministic gradient from course name ─────────────────────────
const GRADIENT_PALETTE: [string, string][] = [
  ['#1E4D2B', '#0D2818'],
  ['#2D3A2D', '#4A5C4A'],
  ['#3A5A3A', '#6B8F6B'],
  ['#4A6B5A', '#7A9B8A'],
  ['#2A5A4A', '#4A8B7A'],
  ['#8B6B3A', '#C4994A'],
  ['#6B3A1A', '#A06A3A'],
  ['#5A4A3A', '#8B7A6A'],
  ['#3A6B6B', '#5A9B9B'],
  ['#1E4D2B', '#2D6A3F'],
  ['#2D3A2D', '#1E4D2B'],
  ['#4A6B5A', '#2A5A4A'],
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getGradientForCourse(courseName: string): [string, string] {
  return GRADIENT_PALETTE[hashString(courseName) % GRADIENT_PALETTE.length];
}

// ─── AsyncStorage cache helpers ──────────────────────────────────────
async function getCached(key: string): Promise<CachedPlace | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const cached: CachedPlace = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL) {
      AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

async function setCache(key: string, data: Omit<CachedPlace, 'fetchedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ ...data, fetchedAt: Date.now() }),
    );
  } catch {}
}

// ─── Google Places photo URL builder ─────────────────────────────────
function getPhotoUrl(photoReference: string, maxWidth: number = 800): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_KEY}`;
}

// ─── Google Places Find Place (for photo_reference lookup) ───────────
async function findPlacePhotoReference(
  courseName: string,
  city?: string,
): Promise<{ photoReference: string; placeId: string } | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const input = city ? `${courseName} ${city}` : courseName;
    const query = encodeURIComponent(input);
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=photos,place_id&key=${GOOGLE_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.candidates?.[0]?.photos?.[0]?.photo_reference) {
      const candidate = data.candidates[0];
      const photoRef = candidate.photos[0].photo_reference;
      return { photoReference: photoRef, placeId: candidate.place_id };
    }

    if (data.status !== 'OK') {
      console.error('[PHOTO] Find Place API error status:', data.status);
    }
    return null;
  } catch (error: any) {
    console.error('[PHOTO] Find Place API fetch error:', error?.message);
    return null;
  }
}

// ─── Google Places Text Search ───────────────────────────────────────
async function searchPlace(query: string): Promise<{ placeId: string; photoUrl: string; photoReference?: string } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const place = data.results?.[0];
    if (!place?.place_id) return null;

    const photoRef = place.photos?.[0]?.photo_reference;
    if (!photoRef) return null;

    return {
      placeId: place.place_id,
      photoUrl: getPhotoUrl(photoRef),
      photoReference: photoRef,
    };
  } catch {
    return null;
  }
}

// ─── Cache photo_reference to Supabase course record ─────────────────
async function cachePhotoReferenceToSupabase(
  courseName: string,
  location: string | undefined,
  photoReference: string,
): Promise<void> {
  try {
    // Find course in Supabase by name
    let query = supabase
      .from('courses')
      .select('id, photo_reference')
      .ilike('name', `%${courseName}%`);

    const { data: courses } = await query;
    if (!courses || courses.length === 0) return;

    // Update the first matching course that doesn't already have a photo_reference
    for (const course of courses) {
      if (!(course as any).photo_reference) {
        await supabase
          .from('courses')
          .update({ photo_reference: photoReference })
          .eq('id', course.id);
        break;
      }
    }
  } catch {
    // Silently fail — caching is best-effort
  }
}

// ─── Fetch photo_reference from Supabase course record ───────────────
async function getPhotoReferenceFromSupabase(
  courseName: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('courses')
      .select('photo_reference')
      .ilike('name', `%${courseName}%`)
      .not('photo_reference', 'is', null)
      .limit(1)
      .maybeSingle();
    return (data as any)?.photo_reference ?? null;
  } catch {
    return null;
  }
}

// ─── Main fetch: course image by query ───────────────────────────────
export async function searchCourseImage(query: string, maxWidth: number = 800): Promise<string | null> {
  if (!GOOGLE_KEY) return null;

  const cacheKey = query.toLowerCase().replace(/\s+/g, '_');
  const cached = await getCached(cacheKey);
  if (cached) {
    // If cached has photoReference and caller wants different maxWidth, rebuild URL
    if (cached.photoReference && maxWidth !== 800) {
      return getPhotoUrl(cached.photoReference, maxWidth);
    }
    return cached.photoUrl;
  }

  const result = await searchPlace(query);
  if (!result) return null;

  await setCache(cacheKey, result);
  return maxWidth !== 800 && result.photoReference
    ? getPhotoUrl(result.photoReference, maxWidth)
    : result.photoUrl;
}

// ─── Convenience: fetch course image by name + location ──────────────
// 1. Check Supabase for cached photo_reference
// 2. If not found, hit Google Places Find Place API
// 3. Cache photo_reference to Supabase for future instant loads
export async function fetchCourseImage(
  courseName: string,
  location?: string,
  maxWidth: number = 800,
): Promise<string | null> {
  // 1. Check Supabase for already-cached photo_reference
  const cachedRef = await getPhotoReferenceFromSupabase(courseName);
  if (cachedRef) {
    return getPhotoUrl(cachedRef, maxWidth);
  }

  if (!GOOGLE_KEY) return null;

  // 2. Check AsyncStorage cache
  const query = location
    ? `${courseName} ${location} golf course`
    : `${courseName} golf course`;
  const cacheKey = query.toLowerCase().replace(/\s+/g, '_');
  const cached = await getCached(cacheKey);
  if (cached) {
    // If we have a photoReference in local cache, also persist to Supabase
    if (cached.photoReference) {
      cachePhotoReferenceToSupabase(courseName, location, cached.photoReference).catch(() => {});
    }
    if (cached.photoReference && maxWidth !== 800) {
      return getPhotoUrl(cached.photoReference, maxWidth);
    }
    return cached.photoUrl;
  }

  // 3. Try Google Places Find Place API first (more targeted)
  const city = location?.split(',')[0]?.trim();
  const findResult = await findPlacePhotoReference(courseName, city);
  if (findResult) {
    const photoUrl = getPhotoUrl(findResult.photoReference, maxWidth);
    await setCache(cacheKey, {
      photoUrl: getPhotoUrl(findResult.photoReference), // default 800 for cache
      placeId: findResult.placeId,
      photoReference: findResult.photoReference,
    });
    // Cache to Supabase for future instant loads
    cachePhotoReferenceToSupabase(courseName, location, findResult.photoReference).catch(() => {});
    return photoUrl;
  }

  // 4. Fall back to Text Search
  const result = await searchPlace(query);
  if (!result) return null;

  await setCache(cacheKey, result);
  // Cache photo_reference to Supabase
  if (result.photoReference) {
    cachePhotoReferenceToSupabase(courseName, location, result.photoReference).catch(() => {});
  }
  return maxWidth !== 800 && result.photoReference
    ? getPhotoUrl(result.photoReference, maxWidth)
    : result.photoUrl;
}

// ─── Curated dream destination queries ───────────────────────────────
// Signature courses at each destination for real Google Places photos.
const DREAM_QUERIES: Record<string, string> = {
  scottsdale: 'TPC Scottsdale Stadium Course Arizona',
  'myrtle beach': 'Caledonia Golf Fish Club South Carolina',
  bandon: 'Pacific Dunes Bandon Oregon',
  'bandon dunes': 'Pacific Dunes Bandon Oregon',
  pinehurst: 'Pinehurst No 2 North Carolina',
  'pinehurst no. 2': 'Pinehurst No 2 North Carolina',
  ireland: 'Royal County Down Northern Ireland',
  scotland: 'St Andrews Old Course Scotland',
  monterey: 'Pebble Beach Golf Links California',
  'pebble beach': 'Pebble Beach Golf Links California',
  'las vegas': 'Shadow Creek Golf Course Las Vegas',
  'hilton head': 'Harbour Town Golf Links South Carolina',
  'palm springs': 'PGA West Stadium Course California',
  austin: 'Austin Country Club Texas',
  'old hickory': 'Hermitage Golf Course Nashville Tennessee',
  nashville: 'Hermitage Golf Course Nashville Tennessee',
};

export function getDreamQuery(name: string): string | null {
  const key = name.toLowerCase();
  if (DREAM_QUERIES[key]) return DREAM_QUERIES[key];
  // Fuzzy: check if any key starts with the query or vice versa
  for (const [k, v] of Object.entries(DREAM_QUERIES)) {
    if (key.startsWith(k) || k.startsWith(key)) return v;
  }
  return null;
}

export async function fetchDreamImage(name: string): Promise<string | null> {
  const query = getDreamQuery(name);
  if (!query) return null;
  return searchCourseImage(query);
}

// Sync stub — returns null so DestinationImage handles async fetching internally
export function getDreamImage(_name: string): string | null {
  return null;
}

// ─── Check if Google Places is configured ────────────────────────────
export function isGooglePlacesConfigured(): boolean {
  return GOOGLE_KEY.length > 0;
}

// Backward compat alias
export const isUnsplashConfigured = isGooglePlacesConfigured;
