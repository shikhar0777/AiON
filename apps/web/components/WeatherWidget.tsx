"use client";

import { useState, useEffect } from "react";

interface WeatherData {
  temperature: number;
  code: number;
  city: string;
}

const WEATHER_ICONS: Record<number, string> = {
  0: "\u2600\uFE0F", 1: "\u{1F324}\uFE0F", 2: "\u26C5", 3: "\u2601\uFE0F",
  45: "\u{1F32B}\uFE0F", 48: "\u{1F32B}\uFE0F",
  51: "\u{1F326}\uFE0F", 53: "\u{1F326}\uFE0F", 55: "\u{1F326}\uFE0F",
  61: "\u{1F327}\uFE0F", 63: "\u{1F327}\uFE0F", 65: "\u{1F327}\uFE0F",
  71: "\u{1F328}\uFE0F", 73: "\u{1F328}\uFE0F", 75: "\u{1F328}\uFE0F", 77: "\u2744\uFE0F",
  80: "\u{1F327}\uFE0F", 81: "\u{1F327}\uFE0F", 82: "\u{1F327}\uFE0F",
  85: "\u{1F328}\uFE0F", 86: "\u{1F328}\uFE0F",
  95: "\u26C8\uFE0F", 96: "\u26C8\uFE0F", 99: "\u26C8\uFE0F",
};

const WEATHER_LABELS: Record<number, string> = {
  0: "Clear", 1: "Clear", 2: "Cloudy", 3: "Overcast",
  45: "Foggy", 48: "Foggy",
  51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
  61: "Rain", 63: "Rain", 65: "Heavy Rain",
  71: "Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow",
  80: "Showers", 81: "Showers", 82: "Showers",
  85: "Snow", 86: "Snow",
  95: "Storm", 96: "Storm", 99: "Storm",
};

function getTimezone(): { zone: string; abbr: string } {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  // e.g. "Asia/Kathmandu" → "Kathmandu"
  const short = zone.split("/").pop()?.replace(/_/g, " ") || zone;
  return { zone: short, abbr: zone };
}

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [time, setTime] = useState(formatTime);
  const [tz] = useState(getTimezone);

  // Update clock every 30s
  useEffect(() => {
    const interval = setInterval(() => setTime(formatTime()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch weather — prefer browser geolocation (actual user location), fall back to IP lookup
  useEffect(() => {
    async function fetchWeather(lat: number, lon: number) {
      try {
        const [weatherResp, geoResp] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`),
        ]);
        const weatherJson = await weatherResp.json();
        const cw = weatherJson.current_weather;

        let city = "";
        try {
          const geoJson = await geoResp.json();
          city = geoJson.address?.city || geoJson.address?.town || geoJson.address?.village || geoJson.address?.county || "";
        } catch { /* ignore */ }

        setWeather({ temperature: Math.round(cw.temperature), code: cw.weathercode, city });
      } catch { /* ignore */ }
    }

    const fetchByIpFallback = () => {
      fetch("https://ipapi.co/json/")
        .then((r) => r.json())
        .then((data) => {
          if (data.latitude && data.longitude) {
            fetchWeather(data.latitude, data.longitude);
          }
        })
        .catch(() => {});
    };

    if (!navigator.geolocation) {
      fetchByIpFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => fetchByIpFallback(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const icon = weather ? (WEATHER_ICONS[weather.code] || "\u{1F321}\uFE0F") : null;
  const label = weather ? (WEATHER_LABELS[weather.code] || "") : null;

  return (
    <div className="px-3 py-3 border-b border-[var(--color-border)] bg-white">
      <div className="flex flex-col items-center gap-1.5">
        {/* Local time */}
        <span className="text-[22px] font-serif font-bold text-[var(--color-text-primary)] leading-none tracking-tight">
          {time}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-tertiary)] leading-none">
          {tz.zone}
        </span>

        {/* Weather */}
        {weather ? (
          <>
            <div className="w-full border-t border-[var(--color-border)] my-0.5" />
            <span className="text-[22px] leading-none">{icon}</span>
            <span className="text-[18px] font-serif font-bold text-[var(--color-text-primary)] leading-none">
              {weather.temperature}°C
            </span>
            {label && (
              <span className="text-[9px] text-[var(--color-text-tertiary)] leading-tight">
                {label}
              </span>
            )}
            {weather.city && (
              <span className="text-[9px] font-medium text-[var(--color-text-secondary)] leading-tight text-center">
                {weather.city}
              </span>
            )}
          </>
        ) : (
          <div className="text-[10px] text-[var(--color-text-tertiary)] animate-pulse mt-1">
            loading weather...
          </div>
        )}
      </div>
    </div>
  );
}
