import AsyncStorage from '@react-native-async-storage/async-storage';

const UNSPLASH_KEY = process.env.EXPO_PUBLIC_UNSPLASH_KEY ?? '';
const CACHE_PREFIX = 'course_img_';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

type CachedImage = {
  url: string;
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
async function getCachedImage(key: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const cached: CachedImage = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL) {
      AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return cached.url;
  } catch {
    return null;
  }
}

async function setCachedImage(key: string, url: string): Promise<void> {
  try {
    const data: CachedImage = { url, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {}
}

// ─── Unsplash search ─────────────────────────────────────────────────
export async function searchCourseImage(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;

  const cacheKey = query.toLowerCase().replace(/\s+/g, '_');
  const cached = await getCachedImage(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const imageUrl: string | undefined = data.results?.[0]?.urls?.regular;
    if (!imageUrl) return null;

    await setCachedImage(cacheKey, imageUrl);
    return imageUrl;
  } catch {
    return null;
  }
}

// ─── Convenience: fetch course image by name + location ──────────────
export async function fetchCourseImage(
  courseName: string,
  location?: string,
): Promise<string | null> {
  const query = location
    ? `golf course ${location}`
    : `golf course ${courseName}`;
  return searchCourseImage(query);
}

// ─── Curated dream destination queries ───────────────────────────────
// These produce the best Unsplash results for each destination.
const DREAM_QUERIES: Record<string, string> = {
  scottsdale: 'desert golf course Arizona',
  'myrtle beach': 'coastal golf course South Carolina',
  bandon: 'links golf course Oregon coast',
  pinehurst: 'pine tree golf course North Carolina',
  ireland: 'links golf course Ireland cliffs',
  scotland: 'St Andrews golf links Scotland',
  monterey: 'Pebble Beach ocean golf course',
  'las vegas': 'desert golf course mountains Nevada',
  'pebble beach': 'Pebble Beach ocean golf course',
  'hilton head': 'lowcountry golf course South Carolina',
  'palm springs': 'desert golf course Palm Springs California',
  austin: 'hill country golf course Texas',
  'old hickory': 'golf course Nashville Tennessee',
  nashville: 'golf course Nashville Tennessee',
};

export function getDreamQuery(name: string): string | null {
  return DREAM_QUERIES[name.toLowerCase()] ?? null;
}

// Fetch a dream destination image using the curated query
export async function fetchDreamImage(name: string): Promise<string | null> {
  const query = getDreamQuery(name);
  if (!query) return null;
  return searchCourseImage(query);
}

// ─── Check if Unsplash is configured ─────────────────────────────────
export function isUnsplashConfigured(): boolean {
  return UNSPLASH_KEY.length > 0;
}
