/**
 * L'agenda se lit dans le fuseau du showroom, pas dans celui de la machine.
 *
 * Un rendez-vous est stocké en UTC ; l'afficher avec `getHours()` donne
 * l'heure du serveur (UTC sur Vercel) au premier rendu et celle du navigateur
 * ensuite — deux textes différents pour le même RDV, et React qui jette tout
 * l'arbre à l'hydratation. Tout ce qui touche à une heure de calendrier passe
 * donc par ici, où le fuseau est fixe.
 *
 * La Tunisie est à UTC+1 toute l'année, sans heure d'été.
 */
export const BUSINESS_TZ = "Africa/Tunis";

const PART_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface TzParts {
  day: string;
  hour: number;
  minute: number;
}

function partsOf(date: Date): TzParts {
  const found: Record<string, string> = {};
  for (const p of PART_FORMAT.formatToParts(date)) {
    if (p.type !== "literal") found[p.type] = p.value;
  }
  return {
    day: `${found.year}-${found.month}-${found.day}`,
    // À minuit, `hour12: false` peut rendre « 24 » selon la plateforme.
    hour: Number(found.hour) % 24,
    minute: Number(found.minute),
  };
}

/** Le jour calendaire `yyyy-MM-dd` de cet instant, au showroom. */
export function tzDay(date: Date): string {
  return partsOf(date).day;
}

/** `HH:mm` de cet instant, au showroom. */
export function tzHhmm(date: Date): string {
  const { hour, minute } = partsOf(date);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Minutes écoulées depuis minuit, au showroom. */
export function tzMinutes(date: Date): number {
  const { hour, minute } = partsOf(date);
  return hour * 60 + minute;
}

/** L'écart du fuseau à cet instant, en millisecondes. */
function tzOffsetMs(instant: Date): number {
  const utc = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(
    instant.toLocaleString("en-US", { timeZone: BUSINESS_TZ }),
  );
  return local.getTime() - utc.getTime();
}

/** L'instant absolu correspondant à `yyyy-MM-dd` + `HH:mm` au showroom. */
export function tzInstant(day: string, time: string): Date {
  const naive = new Date(`${day}T${time}:00Z`);
  // Deux passes : l'écart se lit à l'instant visé, pas à l'instant supposé.
  const first = new Date(naive.getTime() - tzOffsetMs(naive));
  return new Date(naive.getTime() - tzOffsetMs(first));
}
