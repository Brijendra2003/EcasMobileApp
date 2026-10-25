// Display formats (§14): dates as "25 Oct 2026", 12-hour clock, IST.
import { formatDate, formatDateTime, formatTime, istDate, istMinutes } from '../shared/dates';

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function timeRange(start: string, end: string): string {
  return `${formatTime(hhmmToMinutes(start))} – ${formatTime(hhmmToMinutes(end))}`;
}

/** "25 Oct" or "Mon, 25 Oct 2026" for a yyyy-mm-dd date. */
export function day(iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  return formatDate(iso, opts);
}

export function dateRange(from: string, to: string): string {
  return from === to ? day(from, { year: true }) : `${day(from)} – ${day(to, { year: true })}`;
}

/** Instant → "25 Oct 2026, 10:42 AM" (IST). */
export function instant(iso: string): string {
  return formatDateTime(iso);
}

/** Instant → "10:42 AM" (IST). */
export function clock(iso: string): string {
  return formatTime(istMinutes(new Date(iso)));
}

/** Instant → yyyy-mm-dd in IST. */
export function istDay(iso: string): string {
  return istDate(new Date(iso));
}

export function pct(p: number | null | undefined): string {
  return p === null || p === undefined ? '—' : `${Number(p).toFixed(1)}%`;
}
