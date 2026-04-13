import { NextResponse } from "next/server";

import { getOpenMeteoWeatherSnapshot } from "@/lib/weather/open-meteo";

const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

const weatherCache = new Map<
  string,
  {
    expiresAt: number;
    payload: Awaited<ReturnType<typeof getOpenMeteoWeatherSnapshot>>;
  }
>();

function parseCoordinate(value: string | null, label: string) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function getCacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseCoordinate(searchParams.get("latitude"), "Latitude");
    const longitude = parseCoordinate(searchParams.get("longitude"), "Longitude");
    const forceRefresh = searchParams.get("refresh") === "1";
    const cacheKey = getCacheKey(latitude, longitude);
    const cached = weatherCache.get(cacheKey);

    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload);
    }

    const payload = await getOpenMeteoWeatherSnapshot(latitude, longitude);

    weatherCache.set(cacheKey, {
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load the weather.";
    const status = /required|valid number/i.test(message) ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
