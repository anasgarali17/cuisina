"use client";

import { useId } from "react";

/**
 * Les cinq types de façade, dessinés.
 *
 * « Stratifié » et « PVC » ne veulent rien dire à qui n'a jamais posé de
 * cuisine : le client cochait un mot et découvrait la matière au rendez-vous.
 * Les photos du catalogue n'existent pas encore — tant qu'elles ne sont pas
 * déposées dans `public/catalogue/facades/`, ces vignettes tiennent le rôle.
 *
 * Ce sont des schémas, pas des photographies, et c'est délibéré : une image
 * inventée présentée comme une cuisine CUISINA promettrait au client une
 * porte que l'atelier n'a jamais fabriquée. Un dessin se lit comme un dessin.
 *
 * Chacun montre ce qui distingue vraiment la matière, pas sa couleur :
 *   · la laque mate ne renvoie rien ;
 *   · la laque brillante renvoie la fenêtre ;
 *   · le bois massif a un fil irrégulier et un cadre assemblé ;
 *   · le stratifié a un décor imprimé, donc parfaitement régulier, et un
 *     chant rapporté qu'on voit sur la tranche ;
 *   · le PVC est thermoformé d'une seule pièce : moulure creusée, arêtes
 *     arrondies, aucun assemblage.
 *
 * Le rendu passe par des dégradés et des motifs SVG plutôt que par des
 * fichiers : cinq vignettes de plus à télécharger sur une 4G de foire, c'est
 * cinq occasions d'abandonner le formulaire.
 */
export function TextureFacade({ type }: { type: string }) {
  // Deux vignettes affichées ensemble partageraient leurs `id` de dégradé, et
  // la seconde hériterait du motif de la première.
  const uid = useId().replace(/:/g, "");
  const ref = (nom: string) => `${nom}-${uid}`;

  const commun = {
    viewBox: "0 0 120 80",
    // Comme `object-cover` : on remplit la vignette sans déformer le fil.
    preserveAspectRatio: "xMidYMid slice" as const,
    className: "size-full",
    role: "presentation" as const,
  };

  switch (type) {
    /* — Laque mate : un aplat qui n'accroche aucune lumière — */
    case "laque_mat":
      return (
        <svg {...commun}>
          <defs>
            <linearGradient id={ref("mat")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e6e1da" />
              <stop offset="100%" stopColor="#cfc8bf" />
            </linearGradient>
          </defs>
          <rect width="120" height="80" fill={`url(#${ref("mat")})`} />
          {/* Le jeu entre deux portes — seul relief d'une façade sans poignée */}
          <rect x="86" y="0" width="1.6" height="80" fill="#0000001a" />
          <rect x="87.6" y="0" width="0.8" height="80" fill="#ffffff40" />
        </svg>
      );

    /* — Laque brillante : la fenêtre de la pièce, posée sur la porte — */
    case "laque_brillant":
      return (
        <svg {...commun}>
          <defs>
            <linearGradient id={ref("gloss")} x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0%" stopColor="#fbfbf9" />
              <stop offset="55%" stopColor="#e8e7e2" />
              <stop offset="100%" stopColor="#cdccc6" />
            </linearGradient>
            <linearGradient id={ref("sweep")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="120" height="80" fill={`url(#${ref("gloss")})`} />
          {/* Le reflet d'une fenêtre : deux carreaux, nets, en biais */}
          <g transform="rotate(-24 40 34)" opacity="0.5">
            <rect x="10" y="12" width="22" height="15" rx="1" fill="#fff" />
            <rect x="10" y="30" width="22" height="15" rx="1" fill="#fff" />
          </g>
          <rect width="120" height="80" fill={`url(#${ref("sweep")})`} />
          <rect x="0" y="0" width="120" height="1.4" fill="#ffffffcc" />
        </svg>
      );

    /* — Bois massif : fil irrégulier, et un cadre qui est un assemblage — */
    case "bois_massif":
      return (
        <svg {...commun}>
          <defs>
            <linearGradient id={ref("chene")} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c08b52" />
              <stop offset="100%" stopColor="#a06f3c" />
            </linearGradient>
          </defs>
          <rect width="120" height="80" fill={`url(#${ref("chene")})`} />
          {/* Le fil : dévié, jamais parallèle — c'est ce qui trahit le massif */}
          <g stroke="#6f4720" strokeOpacity="0.4" fill="none" strokeWidth="0.7">
            <path d="M14 -5 C 18 20, 10 45, 16 85" />
            <path d="M30 -5 C 34 25, 26 50, 32 85" />
            <path d="M47 -5 C 43 22, 51 48, 45 85" />
            <path d="M63 -5 C 68 26, 60 52, 66 85" />
            <path d="M80 -5 C 76 20, 84 46, 78 85" />
            <path d="M97 -5 C 101 24, 93 50, 99 85" />
            <path d="M112 -5 C 108 22, 116 48, 110 85" />
          </g>
          {/* Un nœud : un défaut que seul le bois vrai porte */}
          <ellipse cx="63" cy="40" rx="4.2" ry="2.6" fill="#7c4f24" opacity="0.5" />
          <ellipse cx="63" cy="40" rx="2" ry="1.2" fill="#5f3a19" opacity="0.55" />
          {/* Le cadre assemblé, en creux */}
          <rect
            x="12"
            y="10"
            width="96"
            height="60"
            fill="none"
            stroke="#6b431e"
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
          <rect
            x="13.2"
            y="11.2"
            width="96"
            height="60"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.25"
            strokeWidth="0.8"
          />
        </svg>
      );

    /* — Stratifié : un décor imprimé, donc d'une régularité de machine — */
    case "stratifie":
      return (
        <svg {...commun}>
          <defs>
            <pattern
              id={ref("decor")}
              width="6"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="80" fill="#c9bba4" />
              <rect x="0" y="0" width="1.1" height="80" fill="#b3a288" />
              <rect x="3" y="0" width="0.5" height="80" fill="#d6cab6" />
            </pattern>
          </defs>
          <rect width="120" height="80" fill={`url(#${ref("decor")})`} />
          {/* Le chant rapporté : la tranche d'un panneau, collée après coup */}
          <rect x="0" y="68" width="120" height="12" fill="#a08d70" />
          <rect x="0" y="68" width="120" height="0.9" fill="#00000033" />
          <rect x="0" y="69.6" width="120" height="0.7" fill="#ffffff3d" />
        </svg>
      );

    /* — PVC : thermoformé d'une pièce, donc sans un seul assemblage — */
    case "pvc":
      return (
        <svg {...commun}>
          <defs>
            <linearGradient id={ref("pvc")} x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stopColor="#f2ece0" />
              <stop offset="100%" stopColor="#ddd4c4" />
            </linearGradient>
            <radialGradient id={ref("satin")} cx="0.32" cy="0.24" r="0.75">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="120" height="80" fill={`url(#${ref("pvc")})`} />
          {/* La moulure creusée : biseau clair en haut, ombre en bas */}
          <g fill="none">
            <rect
              x="11"
              y="9"
              width="98"
              height="62"
              rx="5"
              stroke="#a8997f"
              strokeOpacity="0.5"
              strokeWidth="2.4"
            />
            <rect
              x="11"
              y="9"
              width="98"
              height="62"
              rx="5"
              stroke="#ffffff"
              strokeOpacity="0.6"
              strokeWidth="0.9"
            />
            <rect
              x="19"
              y="16"
              width="82"
              height="48"
              rx="3.5"
              stroke="#b3a48b"
              strokeOpacity="0.42"
              strokeWidth="1.6"
            />
            <rect
              x="19"
              y="16.9"
              width="82"
              height="48"
              rx="3.5"
              stroke="#ffffff"
              strokeOpacity="0.45"
              strokeWidth="0.7"
            />
          </g>
          <rect width="120" height="80" fill={`url(#${ref("satin")})`} />
        </svg>
      );

    default:
      return null;
  }
}
