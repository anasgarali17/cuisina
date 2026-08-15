import { imageCouleur, teinteDe, type Finition } from "@/lib/couleurs";
import { cn } from "@/lib/utils";

/**
 * La pastille d'une teinte.
 *
 * Un rond de couleur, et rien d'autre — le nom l'accompagne mais ne le
 * remplace plus. La finition change le rendu, sans quoi dix-sept beiges
 * mats se ressemblent : le brillant reçoit un reflet en diagonale, le bois
 * des veines, la pierre un veinage clair.
 *
 * Si un échantillon photographié a été déposé dans
 * `public/catalogue/couleurs/`, il prend la place du dégradé calculé. C'est
 * le même contrat que les vignettes de modèle : déposer le fichier suffit.
 */
export function PastilleCouleur({
  nom,
  visuels,
  className,
}: {
  nom: string;
  /** Chemins réellement présents sur le disque — voir catalogue-server.ts. */
  visuels?: ReadonlySet<string>;
  className?: string;
}) {
  const teinte = teinteDe(nom);
  // `imageCouleur` normalise le nom : l'appeler deux fois refaisait le travail
  // pour en jeter la moitié.
  const echantillon = imageCouleur(nom);
  const photo = visuels?.has(echantillon) ? echantillon : null;

  return (
    <span
      aria-hidden
      className={cn(
        // La bordure interne empêche un blanc cassé de disparaître sur fond
        // clair — sans elle, « Blanc Brillant » n'est plus qu'un trou.
        "relative block size-5 shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-black/15 dark:ring-white/20",
        className,
      )}
      style={photo ? undefined : fondDe(teinte.hex, teinte.finition)}
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="size-full object-cover" />
      )}
    </span>
  );
}

/**
 * Les fonds déjà composés, par teinte et finition.
 *
 * Un dégradé de bois enchaîne six mélanges et deux gradients écrits à la
 * main ; une grille de catalogue affiche cinquante pastilles, et React les
 * redessine à chaque frappe dans le formulaire. Le résultat ne dépend que de
 * la teinte et de la finition — deux valeurs figées — donc il se calcule une
 * fois et se relit ensuite.
 */
const FONDS = new Map<string, React.CSSProperties>();

/**
 * Le fond d'une pastille : la teinte, plus ce que la finition lui fait.
 *
 * Tout se joue en dégradés CSS — pas d'image à charger pour trente-cinq
 * pastilles, et le rendu reste net à n'importe quelle taille.
 */
function fondDe(hex: string, finition: Finition): React.CSSProperties {
  const cle = `${hex}|${finition}`;
  const connu = FONDS.get(cle);
  if (connu) return connu;
  const calcule = composerFond(hex, finition);
  FONDS.set(cle, calcule);
  return calcule;
}

function composerFond(hex: string, finition: Finition): React.CSSProperties {
  switch (finition) {
    /* Le reflet d'une laque : une bande claire en diagonale. */
    case "brillant":
      return {
        backgroundImage: `linear-gradient(135deg, ${melange(hex, "#ffffff", 0.55)} 0%, ${hex} 42%, ${melange(hex, "#000000", 0.16)} 100%)`,
      };
    /* Les veines du bois : des rayures serrées, à peine contrastées. */
    case "bois":
      return {
        backgroundColor: hex,
        backgroundImage: `repeating-linear-gradient(72deg, ${melange(hex, "#000000", 0.14)} 0px, ${melange(hex, "#000000", 0.14)} 1px, transparent 1px, transparent 4px), linear-gradient(160deg, ${melange(hex, "#ffffff", 0.18)} 0%, ${hex} 60%)`,
      };
    /* Le veinage d'un marbre : deux traits clairs en biais. */
    case "pierre":
      return {
        backgroundColor: hex,
        backgroundImage: `linear-gradient(118deg, transparent 34%, ${melange(hex, "#ffffff", 0.5)} 37%, transparent 41%), linear-gradient(118deg, transparent 62%, ${melange(hex, "#ffffff", 0.32)} 65%, transparent 68%), linear-gradient(150deg, ${melange(hex, "#ffffff", 0.14)} 0%, ${hex} 70%)`,
      };
    /* Le mat ne renvoie rien : un aplat, avec un fond de volume. */
    default:
      return {
        backgroundImage: `linear-gradient(150deg, ${melange(hex, "#ffffff", 0.1)} 0%, ${hex} 55%, ${melange(hex, "#000000", 0.1)} 100%)`,
      };
  }
}

/** Mélange deux couleurs hex — `ratio` est la part de la seconde. */
function melange(hex: string, vers: string, ratio: number): string {
  const a = versRvb(hex);
  const b = versRvb(vers);
  const canal = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * ratio)
      .toString(16)
      .padStart(2, "0");
  return `#${canal(0)}${canal(1)}${canal(2)}`;
}

function versRvb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}
