"use client";

import { format, parseISO } from "date-fns";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Eye,
  Gauge,
  LoaderCircle,
  MapPin,
  MoonStar,
  RefreshCw,
  Sunrise,
  Sunset,
  Sun,
  Umbrella,
  Wind,
} from "lucide-react";

import styles from "./family-calendar-app.module.css";
import type { WeatherSnapshot } from "@/lib/weather/types";

type WeatherPanelStatus = "idle" | "locating" | "loading" | "ready" | "error";

function getWindDirectionLabel(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % directions.length];
}

function formatTemperature(value: number) {
  return `${Math.round(value)}°C`;
}

function renderWeatherIcon(weatherCode: number, isDay = true, size = 20) {
  if (weatherCode === 0) {
    return isDay ? <Sun size={size} /> : <MoonStar size={size} />;
  }

  if (weatherCode === 1 || weatherCode === 2) {
    return isDay ? <CloudSun size={size} /> : <CloudMoon size={size} />;
  }

  if (weatherCode === 3) {
    return <Cloud size={size} />;
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return <CloudFog size={size} />;
  }

  if ([51, 53, 55, 56, 57].includes(weatherCode)) {
    return <CloudDrizzle size={size} />;
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return <CloudRain size={size} />;
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return <CloudSnow size={size} />;
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return <CloudLightning size={size} />;
  }

  return <Cloud size={size} />;
}

export function WeatherPanel({
  errorMessage,
  onRefresh,
  snapshot,
  status,
}: {
  errorMessage: string;
  onRefresh: () => void;
  snapshot: WeatherSnapshot | null;
  status: WeatherPanelStatus;
}) {
  if (status === "locating" || status === "loading") {
    return (
      <div className={styles.weatherState}>
        <LoaderCircle className={styles.inlineSpinner} />
        <h3>{status === "locating" ? "Finding your weather" : "Updating the weather"}</h3>
        <p className={styles.modalBodyCopy}>
          Pulling current conditions, precipitation chances, hourly forecast, and
          the next few days.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.weatherState}>
        <CloudRain size={28} />
        <h3>Weather unavailable</h3>
        <p className={styles.modalBodyCopy}>
          {errorMessage ||
            "Allow location access once so the dashboard can pull the right forecast."}
        </p>
        <button type="button" className={styles.primaryButton} onClick={onRefresh}>
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    );
  }

  if (status !== "ready" || !snapshot) {
    return (
      <div className={styles.weatherState}>
        <CloudSun size={28} />
        <h3>Open weather</h3>
        <p className={styles.modalBodyCopy}>
          Tap refresh to load your local forecast.
        </p>
        <button type="button" className={styles.primaryButton} onClick={onRefresh}>
          <RefreshCw size={16} />
          Load weather
        </button>
      </div>
    );
  }

  const today = snapshot.daily[0];

  return (
    <div className={styles.weatherPanel}>
      <div className={styles.weatherHeader}>
        <div className={styles.weatherHeaderCopy}>
          <p className={styles.toolbarLabel}>Weather</p>
          <h2 className={styles.weatherTitle}>Current conditions</h2>
          <div className={styles.weatherLocation}>
            <MapPin size={15} />
            <span>
              {snapshot.location.name}
              {snapshot.location.admin1 ? `, ${snapshot.location.admin1}` : ""}
              {snapshot.location.country ? `, ${snapshot.location.country}` : ""}
            </span>
          </div>
        </div>

        <button type="button" className={styles.secondaryButton} onClick={onRefresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <section className={styles.weatherHero}>
        <div className={styles.weatherHeroMain}>
          <span className={styles.weatherHeroIcon}>
            {renderWeatherIcon(
              snapshot.current.weatherCode,
              snapshot.current.isDay,
              34,
            )}
          </span>
          <div className={styles.weatherHeroTemp}>
            <strong>{formatTemperature(snapshot.current.temperatureC)}</strong>
            <span>{snapshot.current.weatherLabel}</span>
          </div>
        </div>

        <div className={styles.weatherHeroMeta}>
          <div className={styles.weatherHeroMetaItem}>
            <span>Feels like</span>
            <strong>{formatTemperature(snapshot.current.apparentTemperatureC)}</strong>
          </div>
          <div className={styles.weatherHeroMetaItem}>
            <span>Today</span>
            <strong>
              {today
                ? `${formatTemperature(today.temperatureMinC)} - ${formatTemperature(today.temperatureMaxC)}`
                : "No forecast"}
            </strong>
          </div>
          <div className={styles.weatherHeroMetaItem}>
            <span>Rain chance</span>
            <strong>{snapshot.current.precipitationChancePercent}%</strong>
          </div>
        </div>
      </section>

      <section className={styles.weatherMetricsGrid}>
        <div className={styles.weatherMetricCard}>
          <Droplets size={18} />
          <span>Humidity</span>
          <strong>{snapshot.current.humidityPercent}%</strong>
        </div>
        <div className={styles.weatherMetricCard}>
          <Wind size={18} />
          <span>Wind</span>
          <strong>
            {Math.round(snapshot.current.windSpeedKph)} km/h {getWindDirectionLabel(snapshot.current.windDirectionDegrees)}
          </strong>
        </div>
        <div className={styles.weatherMetricCard}>
          <Umbrella size={18} />
          <span>Precip</span>
          <strong>{snapshot.current.precipitationChancePercent}%</strong>
        </div>
        <div className={styles.weatherMetricCard}>
          <Sun size={18} />
          <span>UV index</span>
          <strong>{snapshot.current.uvIndex}</strong>
        </div>
        <div className={styles.weatherMetricCard}>
          <Eye size={18} />
          <span>Visibility</span>
          <strong>{snapshot.current.visibilityKm} km</strong>
        </div>
        <div className={styles.weatherMetricCard}>
          <Gauge size={18} />
          <span>Pressure</span>
          <strong>{Math.round(snapshot.current.pressureHpa)} hPa</strong>
        </div>
        {today ? (
          <>
            <div className={styles.weatherMetricCard}>
              <Sunrise size={18} />
              <span>Sunrise</span>
              <strong>{format(parseISO(today.sunrise), "h:mm a")}</strong>
            </div>
            <div className={styles.weatherMetricCard}>
              <Sunset size={18} />
              <span>Sunset</span>
              <strong>{format(parseISO(today.sunset), "h:mm a")}</strong>
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.weatherSection}>
        <div className={styles.weatherSectionHeader}>
          <h3>Next hours</h3>
          <span className={styles.fieldHelp}>
            Dashboards like this usually lead with the next few hours so rain and
            temperature swings are obvious at a glance.
          </span>
        </div>
        <div className={styles.weatherHourlyStrip}>
          {snapshot.hourly.map((hour) => {
            return (
              <div key={hour.time} className={styles.weatherHourCard}>
                <span className={styles.weatherHourTime}>
                  {format(parseISO(hour.time), "ha")}
                </span>
                {renderWeatherIcon(hour.weatherCode, true, 20)}
                <strong>{formatTemperature(hour.temperatureC)}</strong>
                <span>{hour.precipitationChancePercent}% rain</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.weatherSection}>
        <div className={styles.weatherSectionHeader}>
          <h3>Next days</h3>
          <span className={styles.fieldHelp}>
            High and low, rain chance, and UV are the most useful planning metrics
            for a family schedule board.
          </span>
        </div>
        <div className={styles.weatherDailyGrid}>
          {snapshot.daily.map((day) => {
            return (
              <div key={day.date} className={styles.weatherDayCard}>
                <div className={styles.weatherDayHeader}>
                  <div>
                    <span className={styles.weatherDayLabel}>
                      {format(parseISO(day.date), "EEE")}
                    </span>
                    <strong>{format(parseISO(day.date), "MMM d")}</strong>
                  </div>
                  {renderWeatherIcon(day.weatherCode, true, 20)}
                </div>
                <p className={styles.weatherDaySummary}>{day.weatherLabel}</p>
                <div className={styles.weatherDayTemps}>
                  <span>{formatTemperature(day.temperatureMinC)}</span>
                  <strong>{formatTemperature(day.temperatureMaxC)}</strong>
                </div>
                <div className={styles.weatherDayStats}>
                  <span>{day.precipitationChancePercent}% rain</span>
                  <span>UV {day.uvIndexMax}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p className={styles.weatherFootnote}>
        Updated {format(parseISO(snapshot.fetchedAt), "EEE h:mm a")} using
        Open-Meteo forecast data for your current location.
      </p>
    </div>
  );
}
