export const DEFAULT_TZ = "Asia/Kolkata";

export function partsInTz(d: Date, tz = DEFAULT_TZ) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second };
}

export function hhmmToMin(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  return +m[1] * 60 + +m[2];
}

export function minutesNow(d: Date, tz = DEFAULT_TZ): number {
  const p = partsInTz(d, tz);
  return p.hh * 60 + p.mm;
}

export function inWindow(d: Date, start: string, end: string, tz = DEFAULT_TZ): boolean {
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  const n = minutesNow(d, tz);
  if (s === e) return false;
  return s < e ? n >= s && n < e : n >= s || n < e;
}

export function intersectWindow(a: [string, string], b: [string, string]): [string, string] {
  const s = Math.max(hhmmToMin(a[0]), hhmmToMin(b[0]));
  const e = Math.min(hhmmToMin(a[1]), hhmmToMin(b[1]));
  const f = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  if (e <= s) return ["00:00", "00:00"];
  return [f(s), f(e)];
}

function tzOffsetMs(d: Date, tz: string): number {
  const p = partsInTz(d, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(d.getTime() / 1000) * 1000;
}

export function startOfDayInTz(d: Date, tz = DEFAULT_TZ): Date {
  const p = partsInTz(d, tz);
  const guess = Date.UTC(p.y, p.m - 1, p.d);
  return new Date(guess - tzOffsetMs(d, tz));
}

export function fromLocalInput(value: string, tz = DEFAULT_TZ): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!m) return new Date(NaN);
  const utcGuess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  return new Date(utcGuess - tzOffsetMs(new Date(utcGuess), tz));
}

export function fmtDateTime(d: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}

export function fmtDate(d: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, dateStyle: "medium" }).format(new Date(d));
}

export function dateKey(d: Date, tz = DEFAULT_TZ): string {
  const p = partsInTz(d, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function daysAgo(n: number, from = new Date()): Date {
  return new Date(from.getTime() - n * 86400_000);
}
