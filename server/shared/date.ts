import "server-only";

export const APP_TIME_ZONE = "America/Guatemala";

export function getDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function getTime(date = new Date()) {
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatLongDate(date = new Date()) {
  const formatted = new Intl.DateTimeFormat("es-GT", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getCurrentWeekRange(date = new Date()) {
  const dateKey = getDateKey(date);
  const dayOfWeek = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const from = addDays(dateKey, -daysSinceMonday);
  return { from, to: addDays(from, 6) };
}
