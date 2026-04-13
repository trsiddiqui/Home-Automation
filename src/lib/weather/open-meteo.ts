import type {
  WeatherDailyForecast,
  WeatherHourlyForecast,
  WeatherLocation,
  WeatherSnapshot,
} from "./types";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

function roundNumber(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function getWeatherLabel(weatherCode: number) {
  switch (weatherCode) {
    case 0:
      return "Clear";
    case 1:
      return "Mostly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Cloudy";
    case 45:
    case 48:
      return "Fog";
    case 51:
    case 53:
    case 55:
      return "Drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
    case 63:
    case 65:
      return "Rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
    case 73:
    case 75:
      return "Snow";
    case 77:
      return "Snow grains";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorm with hail";
    default:
      return "Weather";
  }
}

type OpenMeteoForecastResponse = {
  current: {
    apparent_temperature: number;
    is_day: number;
    precipitation_probability: number;
    pressure_msl: number;
    relative_humidity_2m: number;
    temperature_2m: number;
    time: string;
    uv_index: number;
    visibility: number;
    weather_code: number;
    wind_direction_10m: number;
    wind_speed_10m: number;
  };
  daily: {
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    time: string[];
    uv_index_max: number[];
    weather_code: number[];
  };
  hourly: {
    apparent_temperature: number[];
    precipitation_probability: number[];
    temperature_2m: number[];
    time: string[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
  timezone: string;
};

function getLocationNameFromTimezone(timezone: string) {
  const parts = timezone.split("/");
  const candidate = parts[parts.length - 1] ?? "";

  if (!candidate) {
    return "Current location";
  }

  return candidate.replaceAll("_", " ");
}

function buildLocation(
  latitude: number,
  longitude: number,
  timezone: string,
): WeatherLocation {
  return {
    admin1: "",
    country: "",
    latitude,
    longitude,
    name: getLocationNameFromTimezone(timezone),
    timezone,
  };
}

function buildHourlyForecast(data: OpenMeteoForecastResponse): WeatherHourlyForecast[] {
  const currentIndex = data.hourly.time.findIndex((time) => time === data.current.time);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const endIndex = Math.min(startIndex + 12, data.hourly.time.length);

  return data.hourly.time.slice(startIndex, endIndex).map((time, offset) => {
    const index = startIndex + offset;
    const weatherCode = data.hourly.weather_code[index];

    return {
      apparentTemperatureC: roundNumber(data.hourly.apparent_temperature[index], 1),
      precipitationChancePercent: roundNumber(
        data.hourly.precipitation_probability[index] ?? 0,
      ),
      temperatureC: roundNumber(data.hourly.temperature_2m[index], 1),
      time,
      weatherCode,
      weatherLabel: getWeatherLabel(weatherCode),
      windSpeedKph: roundNumber(data.hourly.wind_speed_10m[index], 1),
    };
  });
}

function buildDailyForecast(data: OpenMeteoForecastResponse): WeatherDailyForecast[] {
  return data.daily.time.slice(0, 6).map((date, index) => {
    const weatherCode = data.daily.weather_code[index];

    return {
      date,
      precipitationChancePercent: roundNumber(
        data.daily.precipitation_probability_max[index] ?? 0,
      ),
      sunrise: data.daily.sunrise[index],
      sunset: data.daily.sunset[index],
      temperatureMaxC: roundNumber(data.daily.temperature_2m_max[index], 1),
      temperatureMinC: roundNumber(data.daily.temperature_2m_min[index], 1),
      uvIndexMax: roundNumber(data.daily.uv_index_max[index] ?? 0, 1),
      weatherCode,
      weatherLabel: getWeatherLabel(weatherCode),
    };
  });
}

export async function getOpenMeteoWeatherSnapshot(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot> {
  const forecastUrl = new URL(FORECAST_URL);
  forecastUrl.searchParams.set("latitude", latitude.toString());
  forecastUrl.searchParams.set("longitude", longitude.toString());
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("forecast_days", "6");
  forecastUrl.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation_probability",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "uv_index",
      "visibility",
      "pressure_msl",
      "is_day",
    ].join(","),
  );
  forecastUrl.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
  );
  forecastUrl.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
      "uv_index_max",
      "precipitation_probability_max",
    ].join(","),
  );

  const forecastResponse = await fetch(forecastUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!forecastResponse.ok) {
    throw new Error("Unable to load weather right now.");
  }

  const forecast = (await forecastResponse.json()) as OpenMeteoForecastResponse;
  const weatherCode = forecast.current.weather_code;

  return {
    current: {
      apparentTemperatureC: roundNumber(forecast.current.apparent_temperature, 1),
      humidityPercent: roundNumber(forecast.current.relative_humidity_2m ?? 0),
      isDay: forecast.current.is_day === 1,
      precipitationChancePercent: roundNumber(
        forecast.current.precipitation_probability ?? 0,
      ),
      pressureHpa: roundNumber(forecast.current.pressure_msl, 1),
      temperatureC: roundNumber(forecast.current.temperature_2m, 1),
      uvIndex: roundNumber(forecast.current.uv_index ?? 0, 1),
      visibilityKm: roundNumber((forecast.current.visibility ?? 0) / 1000, 1),
      weatherCode,
      weatherLabel: getWeatherLabel(weatherCode),
      windDirectionDegrees: roundNumber(forecast.current.wind_direction_10m ?? 0),
      windSpeedKph: roundNumber(forecast.current.wind_speed_10m, 1),
    },
    daily: buildDailyForecast(forecast),
    fetchedAt: new Date().toISOString(),
    hourly: buildHourlyForecast(forecast),
    location: buildLocation(latitude, longitude, forecast.timezone),
  };
}
