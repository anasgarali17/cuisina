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

/** Le montant sans l'unité — pour un intervalle, où « DT » ne se répète pas. */
export function formatMontant(amount: number): string {
  return DT_FORMAT.format(amount);
}

/**
 * Le code d'erreur d'une Server Action, transformé en phrase lisible.
 *
 * Le mode démo garde sa formulation propre — ce n'est pas une panne, c'est un
 * état attendu. Tout le reste vient de `errors.*`, et un code inconnu retombe
 * sur le message générique plutôt que d'afficher la clé brute à l'écran.
 */
export function messageErreur(
  t: { (key: string): string; has(key: string): boolean },
  code: string,
): string {
  if (code === "demo_mode") return t("app.demoReadOnly");
  return t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.db");
}

export function initials(nom: string, prenom?: string | null): string {
  const a = (prenom ?? "").trim().charAt(0);
  const b = nom.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}
