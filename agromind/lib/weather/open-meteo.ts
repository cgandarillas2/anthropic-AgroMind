/**
 * Open-Meteo Client — no API key, free
 * Documentation: https://open-meteo.com/en/docs
 */

const BASE_URL = "https://api.open-meteo.com/v1";

// ─── WMO Weather Codes → description + emoji ───────────────────────────────
export const WMO_CODES: Record<number, { label: string; emoji: string }> = {
  0:  { label: "Clear",          emoji: "☀️"  },
  1:  { label: "Mostly clear", emoji: "🌤️" },
  2:  { label: "Partly cloudy", emoji: "⛅" },
  3:  { label: "Cloudy",             emoji: "☁️"  },
  45: { label: "Fog",              emoji: "🌫️" },
  48: { label: "Freezing fog",       emoji: "🌫️" },
  51: { label: "Light drizzle",       emoji: "🌦️" },
  53: { label: "Moderate drizzle",   emoji: "🌦️" },
  55: { label: "Heavy drizzle",    emoji: "🌧️" },
  61: { label: "Light rain",         emoji: "🌧️" },
  63: { label: "Moderate rain",     emoji: "🌧️" },
  65: { label: "Heavy rain",      emoji: "🌧️" },
  71: { label: "Light snow",         emoji: "🌨️" },
  73: { label: "Moderate snow",     emoji: "🌨️" },
  75: { label: "Heavy snow",      emoji: "❄️"  },
  77: { label: "Hail",             emoji: "🌨️" },
  80: { label: "Light showers",     emoji: "🌦️" },
  81: { label: "Moderate showers", emoji: "🌧️" },
  82: { label: "Heavy showers",  emoji: "⛈️" },
  85: { label: "Snow showers",  emoji: "🌨️" },
  86: { label: "Snow showers",  emoji: "❄️"  },
  95: { label: "Thunderstorm",            emoji: "⛈️" },
  96: { label: "Thunderstorm with hail", emoji: "⛈️" },
  99: { label: "Severe thunderstorm",     emoji: "⛈️" },
};

export function getWeatherInfo(code: number) {
  return WMO_CODES[code] ?? { label: "Unknown", emoji: "🌡️" };
}

// ─── Open-Meteo response types ─────────────────────────────────────────

interface OpenMeteoCurrentResponse {
  temperature_2m: number;
  precipitation: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  relative_humidity_2m: number;
  shortwave_radiation: number;
  weather_code: number;
  is_day: number;
}

interface OpenMeteoDailyResponse {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  et0_fao_evapotranspiration: number[];
  weather_code: number[];
}

interface OpenMeteoHourlyResponse {
  time: string[];
  temperature_2m: number[];
}

// ─── Normalized types for the app ────────────────────────────────────────────

export interface CurrentWeather {
  tempC: number;
  precipMm: number;
  windSpeedKmh: number;
  windDirection: number;
  humidity: number;
  solarRadiation: number;
  weatherCode: number;
  isDay: boolean;
}

export interface ForecastDay {
  date: string;           // "2025-01-05"
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  precipProb: number;     // %
  windSpeedMaxKmh: number;
  etMm: number;
  weatherCode: number;
  // Calculated indicators for cherries
  riesgoHelada: boolean;  // tMin < -1°C
  riesgoLluvia: boolean;  // precipMm > 1 during critical period
  riesgoCalor: boolean;   // tMax > 35°C
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastDay[];
  /** Hours when temp < 7°C in the last 24h (to add to accumulated) */
  horasFrioHoy: number;
}

// ─── Main function ────────────────────────────────────────────────────────

export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: [
      "temperature_2m",
      "precipitation",
      "wind_speed_10m",
      "wind_direction_10m",
      "relative_humidity_2m",
      "shortwave_radiation",
      "weather_code",
      "is_day",
    ].join(","),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "et0_fao_evapotranspiration",
      "weather_code",
    ].join(","),
    hourly: "temperature_2m",
    timezone: "America/Santiago",
    forecast_days: "7",
    past_days: "1",  // includes yesterday to calculate chill hours from last 24h
  });

  const res = await fetch(`${BASE_URL}/forecast?${params}`, {
    next: { revalidate: 1800 }, // cache 30 min (Next.js fetch cache)
  });

  if (!res.ok) {
    throw new Error(`Open-Meteo error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  const current = data.current as OpenMeteoCurrentResponse;
  const daily = data.daily as OpenMeteoDailyResponse;
  const hourly = data.hourly as OpenMeteoHourlyResponse;

  // Calculate chill hours in the last 24h
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const horasFrioHoy = hourly.time.reduce((count, timeStr, i) => {
    const t = new Date(timeStr);
    if (t >= last24h && t <= now && hourly.temperature_2m[i] < 7) {
      return count + 1;
    }
    return count;
  }, 0);

  // Normalize forecast (skip the past day, only next 7)
  const today = new Date().toISOString().split("T")[0];
  const forecast: ForecastDay[] = daily.time
    .map((date, i) => ({
      date,
      tempMaxC: daily.temperature_2m_max[i],
      tempMinC: daily.temperature_2m_min[i],
      precipMm: daily.precipitation_sum[i],
      precipProb: daily.precipitation_probability_max[i],
      windSpeedMaxKmh: daily.wind_speed_10m_max[i],
      etMm: daily.et0_fao_evapotranspiration[i],
      weatherCode: daily.weather_code[i],
      // Risks for cherries — January context (harvest)
      riesgoHelada: daily.temperature_2m_min[i] < -1,
      riesgoLluvia: daily.precipitation_sum[i] > 1,
      riesgoCalor: daily.temperature_2m_max[i] > 35,
    }))
    .filter((d) => d.date >= today);

  return {
    current: {
      tempC: current.temperature_2m,
      precipMm: current.precipitation,
      windSpeedKmh: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      humidity: current.relative_humidity_2m,
      solarRadiation: current.shortwave_radiation,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
    },
    forecast,
    horasFrioHoy,
  };
}
