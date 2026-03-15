import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';
const CACHE_PREFIX = 'gplace_';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

type CachedPlace = {
  photoUrl: string;
  placeId: string;
  fetchedAt: number;
};

// ─── Deterministic gradient from course name ─────────────────────────
const GRADIENT_PALETTE: [string, string][] = [
  ['#1E4D2B', '#2D6A3F'],
  ['#2A4A6B', '#5B7FA5'],
  ['#5A3D7A', '#8B6DAF'],
  ['#8B6B3A', '#C4994A'],
  ['#3A5A3A', '#6B8F6B'],
  ['#2D3A2D', '#4A5C4A'],
  ['#4A6B5A', '#7A9B8A'],
  ['#1A3A5C', '#2E6B8A'],
  ['#6B3A1A', '#A06A3A'],
  ['#3A6B6B', '#5A9B9B'],
  ['#5A4A3A', '#8B7A6A'],
  ['#2A5A4A', '#4A8B7A'],
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
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_KEY}`;
}

// ─── Google Places Text Search ───────────────────────────────────────
async function searchPlace(query: string): Promise<{ placeId: string; photoUrl: string } | null> {
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
    };
  } catch {
    return null;
  }
}

// ─── Main fetch: course image by query ───────────────────────────────
export async function searchCourseImage(query: string): Promise<string | null> {
  if (!GOOGLE_KEY) return null;

  const cacheKey = query.toLowerCase().replace(/\s+/g, '_');
  const cached = await getCached(cacheKey);
  if (cached) return cached.photoUrl;

  const result = await searchPlace(query);
  if (!result) return null;

  await setCache(cacheKey, result);
  return result.photoUrl;
}

// ─── Convenience: fetch course image by name + location ──────────────
export async function fetchCourseImage(
  courseName: string,
  location?: string,
): Promise<string | null> {
  const query = location
    ? `${courseName} ${location} golf course`
    : `${courseName} golf course`;
  return searchCourseImage(query);
}

// ─── Curated dream destination queries ───────────────────────────────
// Signature courses at each destination for real Google Places photos.
const DREAM_QUERIES: Record<string, string> = {
  scottsdale: 'TPC Scottsdale Stadium Course Arizona',
  'myrtle beach': 'Caledonia Golf Fish Club South Carolina',
  bandon: 'Pacific Dunes Bandon Oregon',
  pinehurst: 'Pinehurst No 2 North Carolina',
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
  return DREAM_QUERIES[name.toLowerCase()] ?? null;
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
