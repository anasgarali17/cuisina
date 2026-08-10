import { format } from "date-fns";
import { arTN, enGB, fr } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

const DATE_LOCALES: Record<string, DateFnsLocale> = {
  fr,
  ar: arTN,
  en: enGB,
};

/** date-fns locale object for the active UI locale (calendar widgets, etc.). */
export function dateFnsLocale(locale: string): DateFnsLocale {
  return DATE_LOCALES[locale] ?? fr;
}

/** Locale-aware date formatting — numerals stay Western Arabic everywhere. */
export function formatDate(
  date: string | Date,
  pattern: string,
  locale: string,
): string {
  return format(new Date(date), pattern, {
    locale: DATE_LOCALES[locale] ?? fr,
  });
}

export function isToday(date: string | Date): boolean {
  const d = new Date(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * `yyyy-MM-dd` from a date's LOCAL calendar day.
 *
 * Not `toISOString().slice(0,10)`: east of Greenwich that converts local
 * midnight back to the previous day, which silently filed "today" tasks as
 * overdue for everyone in Tunisia.
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000,
  );
}
