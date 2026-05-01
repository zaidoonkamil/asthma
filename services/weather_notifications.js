const axios = require("axios");
const { User } = require("../models");
const { sendNotificationToUser } = require("./notifications");

const governorateCoordinates = {
  Baghdad: { lat: 33.3152, lon: 44.3661 },
  Basra: { lat: 30.5085, lon: 47.7804 },
  Nineveh: { lat: 36.34, lon: 43.13 },
  Erbil: { lat: 36.1911, lon: 44.0092 },
  Najaf: { lat: 32.0259, lon: 44.3462 },
  Karbala: { lat: 32.616, lon: 44.0249 },
  Kirkuk: { lat: 35.4681, lon: 44.3922 },
  Anbar: { lat: 33.4206, lon: 43.3078 },
  Babil: { lat: 32.4682, lon: 44.55 },
  "Dhi Qar": { lat: 31.0521, lon: 46.2573 },
  Diyala: { lat: 33.7485, lon: 44.6268 },
  Duhok: { lat: 36.8667, lon: 42.9833 },
  Maysan: { lat: 31.8356, lon: 47.1448 },
  Muthanna: { lat: 31.3183, lon: 45.2806 },
  Qadisiyah: { lat: 31.9877, lon: 44.925 },
  Saladin: { lat: 34.6071, lon: 43.6782 },
  Sulaymaniyah: { lat: 35.5572, lon: 45.4356 },
  Wasit: { lat: 32.5128, lon: 45.8182 },
};

const weatherDescription = (code) => {
  if (code === 0) return "clear sky";
  if ([1, 2, 3].includes(code)) return "partly cloudy";
  if ([45, 48].includes(code)) return "foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rainy";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snowy";
  if ([95, 96, 99].includes(code)) return "thunderstorm";
  return "weather update";
};

const asthmaAdvice = ({ weatherCode, temperature, windSpeed }) => {
  if ([45, 48].includes(weatherCode)) {
    return "Fog may affect breathing. Keep your inhaler nearby.";
  }
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
    return "Rain and humidity may trigger symptoms for some people.";
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return "Thunderstorm risk. Stay indoors if symptoms increase.";
  }
  if (windSpeed >= 30) {
    return "Wind is high, so dust may trigger asthma symptoms.";
  }
  if (temperature >= 38) {
    return "Very hot weather. Stay hydrated and avoid peak heat hours.";
  }
  return "Weather looks stable for asthma care.";
};

const getCurrentWeather = async (governorate) => {
  const coords =
    governorateCoordinates[governorate] || governorateCoordinates.Baghdad;

  const response = await axios.get("https://api.open-meteo.com/v1/forecast", {
    params: {
      latitude: coords.lat,
      longitude: coords.lon,
      current: "temperature_2m,weather_code,wind_speed_10m",
      wind_speed_unit: "kmh",
      timezone: "auto",
    },
    timeout: 15000,
  });

  const current = response.data.current;
  return {
    temperature: Number(current.temperature_2m),
    windSpeed: Number(current.wind_speed_10m),
    weatherCode: Number(current.weather_code),
  };
};

const buildWeatherMessage = (governorate, weather) => {
  const temperature = Math.round(weather.temperature);
  const windSpeed = Math.round(weather.windSpeed);
  const description = weatherDescription(weather.weatherCode);
  const advice = asthmaAdvice(weather);

  return `${governorate}: ${temperature}C, ${description}, wind ${windSpeed} km/h. ${advice}`;
};

const sendWeatherNotifications = async () => {
  const users = await User.findAll({
    where: { role: "user", isVerified: true },
    attributes: ["id", "location"],
  });

  const weatherByGovernorate = new Map();

  for (const user of users) {
    const governorate = user.location || "Baghdad";

    if (!weatherByGovernorate.has(governorate)) {
      weatherByGovernorate.set(
        governorate,
        await getCurrentWeather(governorate)
      );
    }

    const weather = weatherByGovernorate.get(governorate);
    const message = buildWeatherMessage(governorate, weather);
    await sendNotificationToUser(user.id, message, "AsthmaCare Weather");
  }

  return { users: users.length };
};

module.exports = {
  sendWeatherNotifications,
};
