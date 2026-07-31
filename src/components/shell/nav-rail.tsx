"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PanelLeft } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_GROUPS } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

export function NavRail() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);

  return (
    <aside
      className={cn(
        "no-print sticky top-0 hidden h-screen shrink-0 flex-col bg-noir-atelier text-ivoire transition-[width] duration-200 motion-reduce:transition-none md:flex",
        expanded ? "w-62" : "w-18",
      )}
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <Link
          href="/ma-journee"
          className="flex items-center gap-3 overflow-hidden"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rouge font-display text-lg font-bold text-white">
            C
          </span>
          {expanded && (
            <span className="truncate">
              <span className="block font-display text-base font-bold tracking-wide">
                CUISINA
              </span>
              <span className="block text-[10px] italic text-chene">
                {tApp("tagline")}
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="mt-5 first:mt-2">
            {expanded && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-chene/80">
                {t(`groups.${group.key}`)}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={expanded ? undefined : t(item.key)}
                      className={cn(
                        "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                        active
                          ? "bg-white/8 font-medium text-white"
                          : "text-ivoire/60 hover:bg-white/5 hover:text-ivoire",
                        !item.ready && "opacity-55",
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-rouge" />
                      )}
                      <Icon className="size-4.5 shrink-0" />
                      {expanded && <span className="truncate">{t(item.key)}</span>}
                      {expanded && !item.ready && (
                        <span className="ms-auto size-1.5 rounded-full bg-chene/50" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mx-3 mb-4 flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-ivoire/60 transition-colors hover:bg-white/5 hover:text-ivoire"
        aria-label={expanded ? "Réduire le menu" : "Développer le menu"}
      >
        <PanelLeft className="size-4.5 shrink-0 rtl:rotate-180" />
      </button>
    </aside>
  );
}
