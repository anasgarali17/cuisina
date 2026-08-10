"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_GROUPS } from "./nav-config";
import { signOut } from "@/lib/actions/auth-actions";
import { cn } from "@/lib/utils";

export function NavRail() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-border bg-card md:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cuisina-mark.svg"
          alt="CUISINA"
          className="size-9 shrink-0 rounded-lg"
        />
        <p className="truncate font-display text-sm font-bold tracking-tight">
          CUISINA <span className="text-primary">PRO</span>
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <Fragment key={group.key}>
            <div className="mb-1 mt-5 flex items-center justify-between px-3 first:mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {t(`groups.${group.key}`)}
              </p>
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
            </div>
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  // Forced: the sidebar scrolls, and Next only auto-prefetches
                  // links already in the viewport — which left the bottom
                  // entries (Conseillers & Points de Vente) paying a full
                  // round trip before the URL would even commit.
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm",
                    active
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    !item.ready && "opacity-50",
                  )}
                >
                  <Icon className="size-4.5 shrink-0" />
                  <span className="truncate">{t(item.key)}</span>
                  {!item.ready && (
                    <span
                      aria-hidden="true"
                      className="ms-auto size-1.5 shrink-0 rounded-full bg-border"
                    />
                  )}
                </Link>
              );
            })}
          </Fragment>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <LogOut className="size-4.5 shrink-0" />
          {tApp("logout")}
        </button>
      </div>
    </aside>
  );
}
