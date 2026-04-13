export type WeatherLocation = {
  name: string;
  admin1: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type WeatherCurrent = {
  apparentTemperatureC: number;
  humidityPercent: number;
  isDay: boolean;
  precipitationChancePercent: number;
  pressureHpa: number;
  temperatureC: number;
  uvIndex: number;
  visibilityKm: number;
  weatherCode: number;
  weatherLabel: string;
  windDirectionDegrees: number;
  windSpeedKph: number;
};

export type WeatherHourlyForecast = {
  apparentTemperatureC: number;
  precipitationChancePercent: number;
  temperatureC: number;
  time: string;
  weatherCode: number;
  weatherLabel: string;
  windSpeedKph: number;
};

export type WeatherDailyForecast = {
  date: string;
  precipitationChancePercent: number;
  sunrise: string;
  sunset: string;
  temperatureMaxC: number;
  temperatureMinC: number;
  uvIndexMax: number;
  weatherCode: number;
  weatherLabel: string;
};

export type WeatherSnapshot = {
  current: WeatherCurrent;
  daily: WeatherDailyForecast[];
  fetchedAt: string;
  hourly: WeatherHourlyForecast[];
  location: WeatherLocation;
};
