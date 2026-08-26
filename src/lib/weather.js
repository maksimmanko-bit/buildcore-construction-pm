const weatherCodeLabels = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  95: "Thunderstorm",
};

export function getGoogleMapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "")}`;
}

function getAddressCandidates(address) {
  const raw = String(address || "").trim();
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return [
    raw,
    parts.slice(1).join(", "),
    parts.find((part) => /winnipeg|brandon|steinbach|selkirk|thompson|portage/i.test(part)),
    "Winnipeg, Manitoba, Canada",
  ].filter(Boolean);
}

async function geocodeAddress(address) {
  const tried = new Set();

  for (const candidate of getAddressCandidates(address)) {
    if (tried.has(candidate.toLowerCase())) continue;
    tried.add(candidate.toLowerCase());

    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1&language=en&format=json`);
    if (!response.ok) continue;

    const payload = await response.json();
    const location = payload.results?.[0];
    if (location?.latitude && location?.longitude) return location;
  }

  throw new Error("Weather location was not found.");
}

export async function getWeatherForAddress(address) {
  const location = await geocodeAddress(address);
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    wind_speed_unit: "kmh",
    temperature_unit: "celsius",
    timezone: "auto",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error("Weather service is not available.");

  const payload = await response.json();
  const current = payload.current;
  if (!current) throw new Error("Weather data is not available.");

  return {
    apparent: Math.round(current.apparent_temperature),
    condition: weatherCodeLabels[current.weather_code] ?? "Weather",
    humidity: current.relative_humidity_2m,
    locationName: [location.name, location.admin1].filter(Boolean).join(", "),
    temperature: Math.round(current.temperature_2m),
    time: current.time,
    wind: Math.round(current.wind_speed_10m),
  };
}
