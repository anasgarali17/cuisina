import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Coins,
  FileText,
  MessageCircleMore,
  MessageSquareText,
  PackageCheck,
  Radar,
  ScrollText,
  Settings,
  SquareCheck,
  SquareKanban,
  Store,
  Sun,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
  ready: boolean;
}

export interface NavGroup {
  key: "pilotage" | "commercial" | "organisation" | "automatisation" | "administration";
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "pilotage",
    items: [{ key: "maJournee", href: "/ma-journee", icon: Sun, ready: true }],
  },
  {
    key: "commercial",
    items: [
      { key: "fiches", href: "/fiches", icon: ClipboardList, ready: true },
      { key: "pipeline", href: "/pipeline", icon: SquareKanban, ready: true },
      { key: "clients", href: "/clients", icon: Users, ready: true },
      { key: "commandes", href: "/commandes", icon: PackageCheck, ready: false },
      { key: "devis", href: "/devis", icon: FileText, ready: false },
    ],
  },
  {
    key: "organisation",
    items: [
      { key: "agendaEquipe", href: "/agenda-equipe", icon: CalendarDays, ready: false },
      { key: "agendaClient", href: "/agenda-client", icon: CalendarClock, ready: false },
      { key: "taches", href: "/taches", icon: SquareCheck, ready: true },
    ],
  },
  {
    key: "automatisation",
    items: [
      { key: "sequences", href: "/sequences", icon: MessageCircleMore, ready: false },
      { key: "modeles", href: "/modeles", icon: MessageSquareText, ready: false },
      { key: "journalEnvoi", href: "/journal-envoi", icon: ScrollText, ready: false },
    ],
  },
  {
    key: "administration",
    items: [
      { key: "flux", href: "/flux", icon: TrendingUp, ready: false },
      { key: "reglements", href: "/reglements", icon: Wallet, ready: false },
      { key: "rayonnement", href: "/rayonnement", icon: Radar, ready: false },
      { key: "commissions", href: "/commissions", icon: Coins, ready: false },
      { key: "equipe", href: "/equipe", icon: Store, ready: true },
      { key: "configuration", href: "/configuration", icon: Settings, ready: false },
    ],
  },
];

/** Mobile bottom tabs: Ma Journée · Fiches · Pipeline · Clients · Plus. */
export const MOBILE_TABS = [
  { key: "maJournee", href: "/ma-journee", icon: Sun },
  { key: "fiches", href: "/fiches", icon: ClipboardList },
  { key: "pipeline", href: "/pipeline", icon: SquareKanban },
  { key: "clients", href: "/clients", icon: Users },
] as const;
