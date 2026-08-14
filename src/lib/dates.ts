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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `yyyy-MM-dd` désigne un jour du calendrier, pas un instant.
 *
 * `new Date("2026-08-12")` le lit comme minuit UTC, puis l'affichage le
 * ramène au fuseau de la machine : « 12 août » sur un serveur en UTC, « 11
 * août » dans un navigateur à l'ouest de Greenwich — le même jour rendu deux
 * fois différemment, et React qui régénère tout l'arbre à l'hydratation. On
 * construit donc la date à midi local : le jour reste celui qui est écrit.
 */
function asDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

/** Locale-aware date formatting — numerals stay Western Arabic everywhere. */
export function formatDate(
  date: string | Date,
  pattern: string,
  locale: string,
): string {
  return format(asDate(date), pattern, {
    locale: DATE_LOCALES[locale] ?? fr,
  });
}

export function isToday(date: string | Date): boolean {
  const d = asDate(date);
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
  return Math.floor((asDate(b).getTime() - asDate(a).getTime()) / 86_400_000);
}

/**
 * Jours écoulés depuis une date, jamais négatif. L'horloge se lit ici plutôt
 * que dans un rendu — comme `startOfToday`, c'est la fonction qui est impure,
 * pas le composant.
 */
export function daysSince(date: string | Date | null): number | null {
  if (!date) return null;
  const t = asDate(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}
