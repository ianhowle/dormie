/**
 * Weather-aware home screen pill.
 * Uses expo-location + free weather API when available.
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
};

const CONDITION_ICONS: Record<string, string> = {
  Clear: 'sunny',
  Sunny: 'sunny',
  'Partly cloudy': 'partly-sunny',
  Cloudy: 'cloudy',
  Overcast: 'cloudy',
  Rain: 'rainy',
  'Light rain': 'rainy',
  Thunderstorm: 'thunderstorm',
  Snow: 'snow',
  Fog: 'cloudy',
  Mist: 'cloudy',
  Wind: 'flag',
};

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

    // Use wttr.in — free, no API key, JSON format
    const res = await fetch(
      `https://wttr.in/${latitude},${longitude}?format=j1`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const current = data?.current_condition?.[0];
    if (!current) return null;

    const condition = current.weatherDesc?.[0]?.value ?? 'Clear';
    const tempF = parseInt(current.temp_F, 10);

    cachedWeather = {
      temp: tempF,
      condition,
      icon: CONDITION_ICONS[condition] ?? 'partly-sunny',
    };
    lastFetchTime = Date.now();

    return cachedWeather;
  } catch {
    return cachedWeather; // Return stale cache if available
  }
}
