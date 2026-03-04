// ===============================
// Config
// ===============================
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";
const AIR_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

const LOCAL_KEY_LAST_CITY = "airaware:lastCity";
const LOCAL_KEY_RECENT_CITIES = "airaware:recentCities";
const LOCAL_KEY_THEME = "airaware:theme";

// ===============================
// DOM refs
// ===============================
const cityInput = document.getElementById("city-input");
const searchButton = document.getElementById("search-button");
const suggestionsBox = document.getElementById("search-suggestions");
const recentCitiesContainer = document.querySelector(".recent-cities");
const statusMessage = document.getElementById("status-message");

const currentCityEl = document.getElementById("current-city");
const currentTimeEl = document.getElementById("current-time");
const currentIconEmojiEl = document.getElementById("current-icon-emoji");
const currentDescEl = document.getElementById("current-description");
const currentTempEl = document.getElementById("current-temp");
const currentFeelsEl = document.getElementById("current-feels");
const currentHumidityEl = document.getElementById("current-humidity");
const currentWindEl = document.getElementById("current-wind");
const currentPressureEl = document.getElementById("current-pressure");

const aqiIndicatorEl = document.getElementById("aqi-indicator");
const aqiValueEl = document.getElementById("aqi-value");
const aqiLabelEl = document.getElementById("aqi-label");
const aqiMainPollutantEl = document.getElementById("aqi-main-pollutant");
const aqiNoteEl = document.getElementById("aqi-note");

const uvIndicatorEl = document.getElementById("uv-indicator");
const uvValueEl = document.getElementById("uv-value");
const uvLabelEl = document.getElementById("uv-label");
const uvRecommendationEl = document.getElementById("uv-recommendation");

const recommendTextEl = document.getElementById("recommend-text");
const forecastScrollerEl = document.getElementById("forecast-scroller");

const themeToggle = document.getElementById("theme-toggle");
const themeToggleIcon = document.querySelector(".theme-toggle__icon");
const themeToggleLabel = document.querySelector(".theme-toggle__label");

// ===============================
// Utilities
// ===============================
function debounce(fn, delay = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function setStatus(msg, isError = false) {
  statusMessage.textContent = msg || "";
  statusMessage.style.color = isError ? "#fca5a5" : "var(--text-muted)";
}

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function readLocal(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function formatTimeLocal(isoString, timezone) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });
}

function degToCompass(deg) {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Simplified weather-code to emoji + description
function getWeatherIconAndDesc(code, isNight) {
  // https://open-meteo.com/en/docs
  if ([0].includes(code))
    return { emoji: isNight ? "🌙" : "☀️", desc: "Clear sky" };
  if ([1, 2].includes(code))
    return { emoji: isNight ? "🌤️" : "⛅", desc: "Partly cloudy" };
  if ([3].includes(code)) return { emoji: "☁️", desc: "Overcast" };
  if ([45, 48].includes(code)) return { emoji: "🌫️", desc: "Fog" };
  if ([51, 53, 55].includes(code))
    return { emoji: "🌦️", desc: "Drizzle" };
  if ([61, 63, 65].includes(code))
    return { emoji: "🌧️", desc: "Rain" };
  if ([71, 73, 75].includes(code))
    return { emoji: "🌨️", desc: "Snow" };
  if ([95, 96, 99].includes(code))
    return { emoji: "⛈️", desc: "Thunderstorm" };
  return { emoji: "🌡️", desc: "Weather" };
}

// Simple AQI interpretation using WHO-like buckets for PM2.5 in µg/m³
function interpretAQI(pm25) {
  if (pm25 == null || isNaN(pm25)) {
    return { label: "Unknown", level: "aqi-moderate", note: "Air quality data not available." };
  }
  if (pm25 <= 10)
    return {
      label: "Good",
      level: "aqi-good",
      note: "Air quality is great. Perfect for outdoor activities.",
    };
  if (pm25 <= 25)
    return {
      label: "Moderate",
      level: "aqi-moderate",
      note: "Acceptable for most people. Sensitive groups should still be fine.",
    };
  return {
    label: "Unhealthy",
    level: "aqi-unhealthy",
    note: "Limit prolonged outdoor exertion, especially for sensitive groups.",
  };
}

// UV interpretation (approximate WHO scale)
function interpretUV(uv) {
  if (uv == null || isNaN(uv)) {
    return {
      label: "Unknown",
      level: "uv-moderate",
      advice: "UV data not available. When in doubt, use sunscreen during the day.",
    };
  }
  if (uv < 3)
    return {
      label: "Low",
      level: "uv-low",
      advice: "Low risk. Sunglasses are enough for most people.",
    };
  if (uv < 6)
    return {
      label: "Moderate",
      level: "uv-moderate",
      advice: "Use SPF 30+, sunglasses, and consider a hat during midday.",
    };
  if (uv < 8)
    return {
      label: "High",
      level: "uv-high",
      advice: "Use SPF 30+, sunglasses, hat, and seek shade around midday.",
    };
  return {
    label: "Very high",
    level: "uv-high",
    advice: "Avoid midday sun, use high SPF, hat, sunglasses, and cover exposed skin.",
  };
}

// Recommendations based on temp, uv, aqi
function buildRecommendations({ temp, feelsLike, uv, pm25 }) {
  const parts = [];

  // Activity
  if (pm25 != null && pm25 <= 25 && uv != null && uv <= 6 && feelsLike >= 10 && feelsLike <= 26) {
    parts.push("Great conditions for running, walking, or cycling outdoors.");
  } else if (pm25 != null && pm25 > 25) {
    parts.push("Air quality is not ideal. Prefer shorter outdoor activities or exercise indoors.");
  } else {
    parts.push("Outdoor activities are possible, adjust your pace to how it feels outside.");
  }

  // Clothing
  if (feelsLike <= 5) {
    parts.push("Dress warmly: coat, scarf, and gloves are recommended.");
  } else if (feelsLike <= 15) {
    parts.push("A light jacket or sweater should be comfortable.");
  } else if (feelsLike >= 27) {
    parts.push("Go for breathable, light clothing and stay hydrated.");
  } else {
    parts.push("Regular everyday clothing is fine today.");
  }

  // UV
  const uvInfo = interpretUV(uv);
  parts.push(uvInfo.advice);

  // Short “don’t forget” line
  let dontForget = "";
  if (uv >= 6) dontForget = "Don’t forget your sunscreen and sunglasses.";
  else if (pm25 > 25) dontForget = "Don’t forget a mask if you’re sensitive to air pollution.";
  else if (temp <= 5) dontForget = "Don’t forget a warm layer if you’re out for long.";
  if (dontForget) parts.push(dontForget);

  return parts.join(" ");
}

// Theme
function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("theme-dark", isDark);
  document.body.classList.toggle("theme-light", !isDark);
  themeToggleIcon.textContent = isDark ? "🌙" : "☀️";
  themeToggleLabel.textContent = isDark ? "Dark" : "Light";
}

// ===============================
// API calls
// ===============================
async function searchCities(query) {
  const url = new URL(GEO_BASE);
  url.searchParams.set("name", query);
  url.searchParams.set("count", 6);
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) throw new Error("geocoding_failed");
  const data = await res.json();
  return data.results || [];
}

async function fetchWeatherAndAirQuality(lat, lon) {
  const weatherUrl = new URL(WEATHER_BASE);
  weatherUrl.searchParams.set("latitude", lat);
  weatherUrl.searchParams.set("longitude", lon);
  weatherUrl.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "apparent_temperature",
      "relativehumidity_2m",
      "pressure_msl",
      "windspeed_10m",
      "winddirection_10m",
      "weathercode",
      "uv_index",
    ].join(",")
  );
  weatherUrl.searchParams.set("current_weather", "true");
  weatherUrl.searchParams.set("timezone", "auto");

  const airUrl = new URL(AIR_BASE);
  airUrl.searchParams.set("latitude", lat);
  airUrl.searchParams.set("longitude", lon);
  airUrl.searchParams.set("hourly", ["pm10", "pm2_5", "ozone"].join(","));
  airUrl.searchParams.set("timezone", "auto");

  const [weatherRes, airRes] = await Promise.all([
    fetch(weatherUrl),
    fetch(airUrl),
  ]);

  if (!weatherRes.ok) throw new Error("weather_failed");
  if (!airRes.ok) throw new Error("air_failed");

  const weatherData = await weatherRes.json();
  const airData = await airRes.json();

  return { weatherData, airData };
}

// ===============================
// Rendering helpers
// ===============================
function renderSuggestions(cities) {
  suggestionsBox.innerHTML = "";
  if (!cities.length) {
    suggestionsBox.classList.remove("visible");
    return;
  }

  cities.forEach((city) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.role = "option";
    item.dataset.lat = city.latitude;
    item.dataset.lon = city.longitude;
    item.dataset.name = city.name;
    item.dataset.country = city.country || "";
    item.dataset.timezone = city.timezone || "";

    item.innerHTML = `
      <span>${city.name}</span>
      <span class="suggestion-secondary">
        ${(city.admin1 || "").toString().slice(0, 18)}${city.admin1 ? ", " : ""}${city.country || ""}
      </span>
    `;
    item.addEventListener("click", () => {
      const payload = {
        name: item.dataset.name,
        country: item.dataset.country,
        lat: Number(item.dataset.lat),
        lon: Number(item.dataset.lon),
        timezone: item.dataset.timezone || "auto",
      };
      suggestionsBox.classList.remove("visible");
      cityInput.value = payload.name;
      handleCitySelection(payload);
    });
    suggestionsBox.appendChild(item);
  });

  suggestionsBox.classList.add("visible");
}

function renderRecentCities() {
  const recent = readLocal(LOCAL_KEY_RECENT_CITIES, []);
  recentCitiesContainer.innerHTML = "";
  if (!recent.length) return;

  recent.forEach((city) => {
    const btn = document.createElement("button");
    btn.className = "recent-chip";
    btn.textContent = city.name + (city.country ? `, ${city.country}` : "");
    btn.addEventListener("click", () => handleCitySelection(city));
    recentCitiesContainer.appendChild(btn);
  });
}

function updateRecentCities(city) {
  const max = 6;
  let list = readLocal(LOCAL_KEY_RECENT_CITIES, []);
  // Remove duplicates by lat/lon
  list = list.filter(
    (c) => c.lat !== city.lat || c.lon !== city.lon || c.name !== city.name
  );
  list.unshift(city);
  if (list.length > max) list = list.slice(0, max);
  saveLocal(LOCAL_KEY_RECENT_CITIES, list);
  renderRecentCities();
}

function renderCurrentWeather(cityMeta, weatherData) {
  const { current_weather, hourly, timezone } = weatherData;
  const temp = current_weather?.temperature;
  const feels = hourly?.apparent_temperature?.[current_weather?.time_index] ?? null;

  const nowIdx = hourly.time.indexOf(current_weather.time);
  const humidity = hourly.relativehumidity_2m?.[nowIdx];
  const pressure = hourly.pressure_msl?.[nowIdx];
  const windSpeed = current_weather.windspeed;
  const windDir = current_weather.winddirection;
  const code = current_weather.weathercode;

  const nowLocal = formatTimeLocal(current_weather.time, timezone);
  const isNight = new Date(current_weather.time).getHours() >= 19 ||
    new Date(current_weather.time).getHours() <= 6;

  const { emoji, desc } = getWeatherIconAndDesc(code, isNight);

  currentCityEl.textContent = cityMeta.name + (cityMeta.country ? `, ${cityMeta.country}` : "");
  currentTimeEl.textContent = nowLocal;
  currentIconEmojiEl.textContent = emoji;
  currentDescEl.textContent = desc;
  currentTempEl.textContent = temp != null ? `${Math.round(temp)}°` : "—°";
  currentFeelsEl.textContent =
    feels != null ? `Feels like ${Math.round(feels)}°` : "Feels like —°";

  currentHumidityEl.textContent =
    humidity != null ? `${Math.round(humidity)}%` : "—%";
  currentPressureEl.textContent =
    pressure != null ? `${Math.round(pressure)} hPa` : "— hPa";
  currentWindEl.textContent =
    windSpeed != null && windDir != null
      ? `${Math.round(windSpeed)} km/h ${degToCompass(windDir)}`
      : "—";
}

function renderAQI(airData) {
  const hourly = airData.hourly;
  if (!hourly || !hourly.time?.length) {
    aqiIndicatorEl.className = "aqi-indicator aqi-moderate";
    aqiValueEl.textContent = "—";
    aqiLabelEl.textContent = "Unknown";
    aqiMainPollutantEl.textContent = "Main pollutant: —";
    aqiNoteEl.textContent = "Air quality data not available.";
    return;
  }

  const nowIdx = hourly.time.findIndex((t) => t === airData.hourly.time[0]);
  const idx = Math.max(0, nowIdx);

  const pm25 = hourly.pm2_5?.[idx];
  const pm10 = hourly.pm10?.[idx];
  const ozone = hourly.ozone?.[idx];

  const mainPollutant = (() => {
    const entries = [
      { name: "PM2.5", value: pm25 },
      { name: "PM10", value: pm10 },
      { name: "O₃", value: ozone },
    ].filter((e) => e.value != null);
    if (!entries.length) return "Unknown";
    entries.sort((a, b) => b.value - a.value);
    return entries[0].name;
  })();

  const aqiInfo = interpretAQI(pm25);

  aqiIndicatorEl.className = `aqi-indicator ${aqiInfo.level}`;
  aqiValueEl.textContent = pm25 != null ? Math.round(pm25) : "—";
  aqiLabelEl.textContent = aqiInfo.label;
  aqiMainPollutantEl.textContent = `Main pollutant: ${mainPollutant}`;
  aqiNoteEl.textContent = aqiInfo.note;

  return { pm25 };
}

function renderUV(weatherData) {
  const hourly = weatherData.hourly;
  if (!hourly || !hourly.uv_index?.length) {
    uvIndicatorEl.className = "uv-indicator uv-moderate";
    uvValueEl.textContent = "—";
    uvLabelEl.textContent = "Unknown";
    uvRecommendationEl.textContent =
      "UV data not available. Use sunscreen during the day if you are outside.";
    return { uv: null };
  }

  // Use current weather time index for UV
  const currentTime = weatherData.current_weather.time;
  const idx = hourly.time.indexOf(currentTime);
  const index = idx >= 0 ? idx : 0;
  const uv = hourly.uv_index[index];

  const info = interpretUV(uv);

  uvIndicatorEl.className = `uv-indicator ${info.level}`;
  uvValueEl.textContent = uv != null ? uv.toFixed(1) : "—";
  uvLabelEl.textContent = info.label;
  uvRecommendationEl.textContent = info.advice;

  return { uv };
}

function renderForecast(weatherData) {
  const hourly = weatherData.hourly;
  if (!hourly || !hourly.time?.length) {
    forecastScrollerEl.innerHTML = "";
    return;
  }

  const nowIso = weatherData.current_weather.time;
  const nowIdx = hourly.time.indexOf(nowIso);
  const start = nowIdx >= 0 ? nowIdx : 0;
  const end = Math.min(start + 24, hourly.time.length);

  forecastScrollerEl.innerHTML = "";
  for (let i = start; i < end; i++) {
    const t = hourly.time[i];
    const temp = hourly.temperature_2m?.[i];
    const feels = hourly.apparent_temperature?.[i];
    const code = hourly.weathercode?.[i];

    const date = new Date(t);
    const timeLabel = date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const isNight = date.getHours() >= 19 || date.getHours() <= 6;
    const { emoji } = getWeatherIconAndDesc(code, isNight);

    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <div class="forecast-time">${timeLabel}</div>
      <div class="forecast-icon">${emoji}</div>
      <div class="forecast-temp">${temp != null ? Math.round(temp) + "°" : "—°"}</div>
      <div class="forecast-feels">${
        feels != null ? "Feels " + Math.round(feels) + "°" : "Feels —°"
      }</div>
    `;
    forecastScrollerEl.appendChild(card);
  }
}

// ===============================
// Main flow
// ===============================
async function handleCitySelection(cityMeta) {
  setStatus("Loading weather and air quality…");
  saveLocal(LOCAL_KEY_LAST_CITY, cityMeta);
  updateRecentCities(cityMeta);

  try {
    const { weatherData, airData } = await fetchWeatherAndAirQuality(
      cityMeta.lat,
      cityMeta.lon
    );

    // Attach index of current time in hourly arrays
    const currentIdx = weatherData.hourly.time.indexOf(
      weatherData.current_weather.time
    );
    weatherData.current_weather.time_index = currentIdx >= 0 ? currentIdx : 0;

    renderCurrentWeather(cityMeta, weatherData);
    const { pm25 } = renderAQI(airData) || {};
    const { uv } = renderUV(weatherData);

    renderForecast(weatherData);

    const temp = weatherData.current_weather.temperature;
    const feels =
      weatherData.hourly.apparent_temperature[
        weatherData.current_weather.time_index
      ];
    const text = buildRecommendations({
      temp,
      feelsLike: feels,
      uv,
      pm25,
    });
    recommendTextEl.textContent = text;

    setStatus("");
  } catch (err) {
    console.error(err);
    if (navigator.onLine === false) {
      setStatus("No internet connection. Please check your network.", true);
    } else if (err.message === "weather_failed") {
      setStatus("Weather service temporarily unavailable. Please try again.", true);
    } else if (err.message === "air_failed") {
      setStatus(
        "Weather loaded, but air quality service is temporarily unavailable.",
        true
      );
    } else {
      setStatus("Something went wrong while loading data.", true);
    }
  }
}

// ===============================
// Event handlers
// ===============================
const debouncedSearch = debounce(async () => {
  const q = cityInput.value.trim();
  if (!q) {
    suggestionsBox.classList.remove("visible");
    return;
  }
  try {
    const cities = await searchCities(q);
    if (!cities.length) {
      renderSuggestions([]);
      setStatus("City not found. Try a different spelling.", true);
      return;
    }
    setStatus("");
    renderSuggestions(cities);
  } catch (err) {
    console.error(err);
    if (navigator.onLine === false) {
      setStatus("No internet connection. Cannot search for cities.", true);
    } else {
      setStatus("Unable to search for cities right now.", true);
    }
  }
}, 350);

cityInput.addEventListener("input", () => {
  setStatus("");
  debouncedSearch();
});

searchButton.addEventListener("click", () => {
  const query = cityInput.value.trim();
  if (!query) return;
  // If user presses "Search" we attempt a lookup & take first result
  (async () => {
    try {
      const cities = await searchCities(query);
      if (!cities.length) {
        setStatus("City not found. Try a nearby larger city.", true);
        return;
      }
      const top = cities[0];
      const payload = {
        name: top.name,
        country: top.country || "",
        lat: top.latitude,
        lon: top.longitude,
        timezone: top.timezone || "auto",
      };
      handleCitySelection(payload);
      suggestionsBox.classList.remove("visible");
    } catch (err) {
      console.error(err);
      if (navigator.onLine === false) {
        setStatus("No internet connection. Cannot search for cities.", true);
      } else {
        setStatus("Unable to search for cities right now.", true);
      }
    }
  })();
});

document.addEventListener("click", (e) => {
  if (!suggestionsBox.contains(e.target) && e.target !== cityInput) {
    suggestionsBox.classList.remove("visible");
  }
});

// Theme toggle
themeToggle.addEventListener("click", () => {
  const current = readLocal(LOCAL_KEY_THEME, "dark");
  const next = current === "dark" ? "light" : "dark";
  saveLocal(LOCAL_KEY_THEME, next);
  applyTheme(next);
});

// ===============================
// Init
// ===============================
function initTheme() {
  const stored = readLocal(LOCAL_KEY_THEME);
  const prefersDark = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

function initLastCity() {
  renderRecentCities();
  const last = readLocal(LOCAL_KEY_LAST_CITY);
  if (last) {
    cityInput.value = last.name;
    handleCitySelection(last);
  } else {
    setStatus("Search for a city to get started.");
  }
}

window.addEventListener("load", () => {
  initTheme();
  initLastCity();
});