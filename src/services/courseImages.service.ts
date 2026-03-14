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

// ─── Unsplash fetch with caching ─────────────────────────────────────
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

export async function fetchCourseImage(
  courseName: string,
  location?: string,
): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;

  const cacheKey = courseName.toLowerCase().replace(/\s+/g, '_');
  const cached = await getCachedImage(cacheKey);
  if (cached) return cached;

  try {
    const query = location
      ? `golf course ${location}`
      : `golf course ${courseName}`;
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

// ─── Hardcoded dream destination images ──────────────────────────────
// These are specific Unsplash URLs for the 8 dream destinations.
// They use the imgix parameters from Unsplash for optimal sizing.
export const DREAM_DESTINATION_IMAGES: Record<string, string> = {
  // Scottsdale — desert landscape
  scottsdale: 'https://images.unsplash.com/photo-1535587566541-97121a128607?w=800&q=80',
  // Myrtle Beach — coastal
  'myrtle beach': 'https://images.unsplash.com/photo-1587502537745-84b86da1204f?w=800&q=80',
  // Bandon — rugged Oregon coast
  bandon: 'https://images.unsplash.com/photo-1587502537104-aac2f5393323?w=800&q=80',
  // Pinehurst — Carolina pines
  pinehurst: 'https://images.unsplash.com/photo-1592919505780-303950717480?w=800&q=80',
  // Ireland — green links
  ireland: 'https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?w=800&q=80',
  // Scotland — Scottish links
  scotland: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800&q=80',
  // Monterey — Pacific coast
  monterey: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80',
  // Las Vegas — desert/resort
  'las vegas': 'https://images.unsplash.com/photo-1605833556294-ea5c7a74f57d?w=800&q=80',
  // Pebble Beach — iconic coast
  'pebble beach': 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80',
  // Hilton Head — lowcountry
  'hilton head': 'https://images.unsplash.com/photo-1587502537745-84b86da1204f?w=800&q=80',
  // Palm Springs — desert resort
  'palm springs': 'https://images.unsplash.com/photo-1535587566541-97121a128607?w=800&q=80',
  // Austin — hill country
  austin: 'https://images.unsplash.com/photo-1587502537104-aac2f5393323?w=800&q=80',
};

export function getDreamImage(name: string): string | null {
  const key = name.toLowerCase();
  return DREAM_DESTINATION_IMAGES[key] ?? null;
}
