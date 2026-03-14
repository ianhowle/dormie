/**
 * Weather-aware home screen pill.
 * Uses expo-location + Open-Meteo API (free, no key needed).
 * Falls back gracefully — weather is nice-to-have.
 */

let Location: any = null;
try {
  Location = require('expo-location');
} catch {
  // expo-location not installed
}

export type WeatherData = {
  temp: number; // Fahrenheit
  condition: string; // 'Sunny', 'Cloudy', 'Rain', etc.
  icon: string; // Ionicons name
  emoji: string; // Compact emoji for pill display
};

/**
 * WMO weather code to display mapping.
 * https://open-meteo.com/en/docs — weathercode table
 */
const WMO_MAP: Record<number, { condition: string; icon: string; emoji: string }> = {
  0: { condition: 'Clear', icon: 'sunny', emoji: '\u2600\uFE0F' },
  1: { condition: 'Mostly Clear', icon: 'partly-sunny', emoji: '\u26C5' },
  2: { condition: 'Partly Cloudy', icon: 'partly-sunny', emoji: '\u26C5' },
  3: { condition: 'Overcast', icon: 'cloudy', emoji: '\u26C5' },
  45: { condition: 'Fog', icon: 'cloudy', emoji: '\uD83C\uDF2B\uFE0F' },
  48: { condition: 'Fog', icon: 'cloudy', emoji: '\uD83C\uDF2B\uFE0F' },
  51: { condition: 'Light Drizzle', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  53: { condition: 'Drizzle', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  55: { condition: 'Heavy Drizzle', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  56: { condition: 'Freezing Drizzle', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  57: { condition: 'Freezing Drizzle', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  61: { condition: 'Light Rain', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  63: { condition: 'Rain', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  65: { condition: 'Heavy Rain', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  66: { condition: 'Freezing Rain', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  67: { condition: 'Freezing Rain', icon: 'rainy', emoji: '\uD83C\uDF27\uFE0F' },
  71: { condition: 'Light Snow', icon: 'snow', emoji: '\u2744\uFE0F' },
  73: { condition: 'Snow', icon: 'snow', emoji: '\u2744\uFE0F' },
  75: { condition: 'Heavy Snow', icon: 'snow', emoji: '\u2744\uFE0F' },
  77: { condition: 'Snow Grains', icon: 'snow', emoji: '\u2744\uFE0F' },
  80: { condition: 'Light Showers', icon: 'rainy', emoji: '\uD83C\uDF26\uFE0F' },
  81: { condition: 'Showers', icon: 'rainy', emoji: '\uD83C\uDF26\uFE0F' },
  82: { condition: 'Heavy Showers', icon: 'rainy', emoji: '\uD83C\uDF26\uFE0F' },
  95: { condition: 'Thunderstorm', icon: 'thunderstorm', emoji: '\u26C8\uFE0F' },
  96: { condition: 'Thunderstorm + Hail', icon: 'thunderstorm', emoji: '\u26C8\uFE0F' },
  99: { condition: 'Severe Thunderstorm', icon: 'thunderstorm', emoji: '\u26C8\uFE0F' },
};

function lookupWMO(code: number): { condition: string; icon: string; emoji: string } {
  return WMO_MAP[code] ?? { condition: 'Clear', icon: 'partly-sunny', emoji: '\u26C5' };
}

/** Convert Celsius to Fahrenheit */
function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

let cachedWeather: WeatherData | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export async function fetchWeather(): Promise<WeatherData | null> {
  // Return cached if fresh
  if (cachedWeather && Date.now() - lastFetchTime < CACHE_DURATION) {
    return cachedWeather;
  }

  if (!Location) return null;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.Low ?? 1,
    });

    const { latitude, longitude } = location.coords;

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&temperature_unit=fahrenheit`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const current = data?.current;
    if (!current) return null;

    const weatherCode = current.weathercode ?? 0;
    const tempF = Math.round(current.temperature_2m ?? 72);
    const { condition, icon, emoji } = lookupWMO(weatherCode);

    cachedWeather = { temp: tempF, condition, icon, emoji };
    lastFetchTime = Date.now();

    return cachedWeather;
  } catch {
    return cachedWeather; // Return stale cache if available
  }
}
