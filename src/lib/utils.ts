import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DT_FORMAT = new Intl.NumberFormat("fr-TN", {
  maximumFractionDigits: 0,
});

/** Formats an amount in Tunisian dinars — Western Arabic numerals in every locale. */
export function formatDT(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `${DT_FORMAT.format(amount)} DT`;
}

export function initials(nom: string, prenom?: string | null): string {
  const a = (prenom ?? "").trim().charAt(0);
  const b = nom.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}
