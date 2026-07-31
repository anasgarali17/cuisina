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
