/** Business time is Asia/Kolkata (UTC+05:30, no DST). All timestamps are epoch ms. */
const IST_OFFSET = 330 * 60 * 1000;
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const startOfDayIST = (ts: number) => Math.floor((ts + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
export const istHour = (ts: number) => new Date(ts + IST_OFFSET).getUTCHours();
export const istMinutes = (ts: number) => {
  const d = new Date(ts + IST_OFFSET);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
export const dayKey = (ts: number) => new Date(ts + IST_OFFSET).toISOString().slice(0, 10);

const TZ = "Asia/Kolkata";
const fTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
const fDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const fDateYear = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const fLong = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

export const formatTime = (ts: number) => fTime.format(ts).replace(/\s+/g, " ").toUpperCase();
export const formatDate = (ts: number) => fDate.format(ts);
export const formatDateYear = (ts: number) => fDateYear.format(ts);
export const formatLongDate = (ts: number) => {
  // "Tuesday, 6 October"
  const parts = fLong.formatToParts(ts);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
};
export const formatDateTime = (ts: number) => `${formatDate(ts)}, ${formatTime(ts)}`;

export function greeting(ts: number): string {
  const h = istHour(ts);
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "32 min", "1 h 05 m" */
export function formatElapsed(ms: number): string {
  const m = Math.max(0, Math.floor(ms / MIN));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} m`;
}
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function timeAgo(ts: number, now: number): string {
  const d = now - ts;
  if (d < MIN) return "just now";
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)} h ago`;
  if (d < 2 * DAY) return "yesterday";
  return formatDate(ts);
}

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "custom";
export interface ResolvedRange {
  key: RangeKey;
  from: number; // inclusive
  to: number; // exclusive
  prevFrom: number;
  prevTo: number;
  label: string;
}

export function resolveRange(key: RangeKey, now: number, custom?: { from?: string; to?: string }): ResolvedRange {
  const today = startOfDayIST(now);
  switch (key) {
    case "yesterday":
      return { key, from: today - DAY, to: today, prevFrom: today - 2 * DAY, prevTo: today - DAY, label: "Yesterday" };
    case "7d":
      return { key, from: today - 6 * DAY, to: today + DAY, prevFrom: today - 13 * DAY, prevTo: today - 6 * DAY, label: "Last 7 days" };
    case "30d":
      return { key, from: today - 29 * DAY, to: today + DAY, prevFrom: today - 59 * DAY, prevTo: today - 29 * DAY, label: "Last 30 days" };
    case "custom": {
      const f = custom?.from ? Date.parse(custom.from + "T00:00:00+05:30") : today - 6 * DAY;
      const t = custom?.to ? Date.parse(custom.to + "T00:00:00+05:30") + DAY : today + DAY;
      const from = Number.isFinite(f) ? f : today - 6 * DAY;
      const to = Number.isFinite(t) && t > from ? t : from + DAY;
      const len = to - from;
      return { key, from, to, prevFrom: from - len, prevTo: from, label: `${formatDate(from)} – ${formatDate(to - DAY)}` };
    }
    default:
      return { key: "today", from: today, to: today + DAY, prevFrom: today - DAY, prevTo: today, label: "Today" };
  }
}
