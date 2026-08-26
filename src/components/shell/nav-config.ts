import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Coins,
  Factory,
  FileText,
  Gauge,
  MessageCircleMore,
  MessageSquareText,
  PackageCheck,
  Radar,
  Settings,
  SquareCheck,
  SquareKanban,
  Store,
  Sun,
  ToggleRight,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { sageConfigured } from "@/lib/env";
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

/** Direction et administrateurs — tout leur est ouvert. */
const DIRECTION: readonly Role[] = ["direction", "admin"];
/** Y compris le chef de showroom, que la RLS borne déjà à son point de vente. */
const ENCADREMENT: readonly Role[] = ["chef_showroom", "direction", "admin"];

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
      { key: "flux", href: "/flux", icon: TrendingUp, ready: false, roles: DIRECTION },
      // Règlements & encaissements : ouvert au commercial, mais seulement
      // quand la passerelle Sage existe — voir `sageConfigured()`.
      { key: "reglements", href: "/reglements", icon: Wallet, ready: false },
      {
        key: "rayonnement",
        href: "/rayonnement",
        icon: Radar,
        ready: false,
        roles: DIRECTION,
      },
      {
        key: "commissions",
        href: "/commissions",
        icon: Coins,
        ready: false,
        roles: DIRECTION,
      },
      { key: "equipe", href: "/equipe", icon: Store, ready: true, roles: ENCADREMENT },
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

/** Les deux périmètres, exportés pour les gardes de page. */
export { DIRECTION, ENCADREMENT };

/** Mobile bottom tabs: Ma Journée · Fiches · État du dossier · Clients · Plus. */
export const MOBILE_TABS = [
  { key: "maJournee", href: "/ma-journee", icon: Sun },
  { key: "fiches", href: "/fiches", icon: ClipboardList },
  { key: "etatDossier", href: "/etat-dossier", icon: SquareKanban },
  { key: "clients", href: "/clients", icon: Users },
] as const;
