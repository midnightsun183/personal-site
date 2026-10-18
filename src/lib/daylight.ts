// Pure helpers for the daylight figures. No clock reads in here, so they're safe to call anywhere.

export type Place = { name: string; lat: number; tz: string };

export const PALMA: Place = { name: "Palma", lat: 39.57, tz: "Europe/Madrid" };
export const LAUREL: Place = { name: "Laurel", lat: 39.1, tz: "America/New_York" };

const RAD = Math.PI / 180;

/** Hours from sunrise to sunset for a latitude and day of year (1–365), with standard refraction. */
export function dayLength(lat: number, doy: number): number {
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + doy)) / 365);
  const c =
    (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl * RAD)) /
    (Math.cos(lat * RAD) * Math.cos(decl * RAD));
  const w = Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
  return (2 * w) / 15;
}

export function formatHours(h: number): string {
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) {
    hh += 1;
    mm = 0;
  }
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const now = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.min(365, Math.round((now - start) / 86400000));
}

export function dayLabel(doy: number): string {
  return new Date(Date.UTC(2026, 0, doy)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function minutesApart(doy: number): { minutes: number; longer: Place } {
  const a = dayLength(PALMA.lat, doy);
  const b = dayLength(LAUREL.lat, doy);
  return { minutes: Math.round(Math.abs(a - b) * 60), longer: a > b ? PALMA : LAUREL };
}
