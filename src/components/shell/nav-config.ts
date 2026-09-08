import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  MessageCircleMore,
  MessageSquareText,
  PackageCheck,
  Settings,
  SquareCheck,
  SquareKanban,
  Store,
  Sun,
  ToggleRight,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { sageConfigured } from "@/lib/env";
import { ADMIN, DIRECTION, ENCADREMENT } from "@/lib/acces";
import type { Role } from "@/lib/domain";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
  ready: boolean;
  /**
   * Qui voit cette entrée. Omis = tout le monde.
   *
   * Le commercial ne voit que ce dont il se sert : ses fiches, l'état de ses
   * dossiers, ses agendas, ses tâches. Le reste — le fichier client complet,
   * les points de vente, l'automatisation, la production — appartient à la
   * direction. Masquer ne suffit pas : `ROUTES_PROTEGEES` ci-dessous ferme
   * aussi la porte à qui tape l'adresse à la main.
   */
  roles?: readonly Role[];
}

export interface NavGroup {
  key: "pilotage" | "commercial" | "organisation" | "automatisation" | "administration";
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "pilotage",
    items: [
      { key: "maJournee", href: "/ma-journee", icon: Sun, ready: true },
      // Les chiffres de la direction et son agenda personnel : hors du
      // tableau de bord commun, qui appartient à tout le monde.
      {
        key: "direction",
        href: "/direction",
        icon: Gauge,
        ready: true,
        roles: DIRECTION,
      },
    ],
  },
  {
    key: "commercial",
    items: [
      { key: "fiches", href: "/fiches", icon: ClipboardList, ready: true },
      { key: "etatDossier", href: "/etat-dossier", icon: SquareKanban, ready: true },
      {
        key: "clientsActifs",
        href: "/clients-actifs",
        icon: Factory,
        ready: true,
        roles: ENCADREMENT,
      },
      { key: "clients", href: "/clients", icon: Users, ready: true, roles: ENCADREMENT },
      {
        key: "commandes",
        href: "/commandes",
        icon: PackageCheck,
        ready: false,
        roles: ENCADREMENT,
      },
      { key: "devis", href: "/devis", icon: FileText, ready: false, roles: ENCADREMENT },
    ],
  },
  {
    key: "organisation",
    items: [
      { key: "agendaEquipe", href: "/agenda-equipe", icon: CalendarDays, ready: true },
      { key: "agendaClient", href: "/agenda-client", icon: CalendarClock, ready: true },
      { key: "taches", href: "/taches", icon: SquareCheck, ready: true },
    ],
  },
  {
    key: "automatisation",
    items: [
      // Les messages d'abord : c'est l'écran quotidien. L'activation et les
      // textes se règlent une fois, puis on n'y revient plus.
      {
        key: "messages",
        href: "/messages",
        icon: MessageCircleMore,
        ready: true,
        roles: ENCADREMENT,
      },
      {
        key: "sequences",
        href: "/sequences",
        icon: ToggleRight,
        ready: true,
        roles: ENCADREMENT,
      },
      {
        key: "modeles",
        href: "/modeles",
        icon: MessageSquareText,
        ready: true,
        roles: ENCADREMENT,
      },
    ],
  },
  {
    key: "administration",
    items: [
      // Règlements & encaissements : ouvert au commercial, mais seulement
      // quand la passerelle Sage existe — voir `sageConfigured()`.
      { key: "reglements", href: "/reglements", icon: Wallet, ready: false },
      // Le réseau au complet — les neuf showrooms, leurs équipes, leurs
      // chiffres. Réservé à l'administrateur : lui seul regarde ailleurs que
      // chez lui.
      { key: "equipe", href: "/equipe", icon: Store, ready: true, roles: ADMIN },
      {
        key: "configuration",
        href: "/configuration",
        icon: Settings,
        ready: false,
        roles: DIRECTION,
      },
      { key: "parametres", href: "/parametres", icon: UserCog, ready: true },
    ],
  },
];

/**
 * La navigation telle qu'un rôle la voit.
 *
 * Un groupe qui se vide disparaît : mieux vaut pas de titre du tout qu'un
 * titre « Administration » suivi de rien.
 */
export function navPourRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.key === "reglements" && !sageConfigured()) return false;
      return !item.roles || item.roles.includes(role);
    }),
  })).filter((group) => group.items.length > 0);
}

/** Les périmètres, réexportés pour les gardes de page déjà écrites. */
export { ADMIN, DIRECTION, ENCADREMENT };

/** Mobile bottom tabs: Ma Journée · Fiches · État du dossier · Clients · Plus. */
export const MOBILE_TABS: readonly NavItem[] = [
  { key: "maJournee", href: "/ma-journee", icon: Sun, ready: true },
  { key: "fiches", href: "/fiches", icon: ClipboardList, ready: true },
  { key: "etatDossier", href: "/etat-dossier", icon: SquareKanban, ready: true },
  {
    key: "clients",
    href: "/clients",
    icon: Users,
    ready: true,
    roles: ENCADREMENT,
  },
  // Le commercial n'a pas le fichier client ; on lui rend l'onglet plutôt que
  // de le laisser vide — un raccourci qui mène à « Section réservée » est pire
  // que pas de raccourci.
  { key: "taches", href: "/taches", icon: SquareCheck, ready: true },
];

/** Les onglets du bas, tels qu'un rôle les voit — quatre au plus. */
export function tabsPourRole(role: Role): NavItem[] {
  return MOBILE_TABS.filter(
    (tab) => !tab.roles || tab.roles.includes(role),
  ).slice(0, 4);
}
