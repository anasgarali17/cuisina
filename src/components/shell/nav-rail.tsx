"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_GROUPS } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

const CONFIG_HREF = "/configuration";

export function NavRail() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  /* Configuration lives in the bottom cluster — keep it out of the main list. */
  const groups = NAV_GROUPS.map((group) => ({
    key: group.key,
    items: group.items.filter((item) => item.href !== CONFIG_HREF),
  })).filter((group) => group.items.length > 0);

  const configActive = isActive(CONFIG_HREF);

  return (
    <aside className="no-print sticky top-0 hidden h-screen w-18 shrink-0 flex-col border-e border-border bg-card md:flex">
      <div className="flex h-16 shrink-0 items-center justify-center">
        <Link
          href="/ma-journee"
          aria-label={t("maJournee")}
          className="grid size-10 place-items-center rounded-2xl bg-rouge font-display text-lg font-bold text-white"
        >
          C
        </Link>
      </div>

      <nav className="flex flex-1 flex-col items-center overflow-y-auto py-2">
        {groups.map((group, groupIndex) => (
          <Fragment key={group.key}>
            {groupIndex > 0 && (
              <span
                aria-hidden="true"
                className="mx-auto my-2 h-px w-8 shrink-0 bg-border"
              />
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  data-active={active ? "true" : undefined}
                  aria-current={active ? "page" : undefined}
                  title={t(item.key)}
                  aria-label={t(item.key)}
                  className={cn("rail-btn shrink-0", !item.ready && "opacity-40")}
                >
                  <Icon className="size-5" />
                </Link>
              );
            })}
          </Fragment>
        ))}
      </nav>

      <div className="mt-auto flex shrink-0 flex-col items-center pb-4 pt-2">
        <Link
          href={CONFIG_HREF}
          data-active={configActive ? "true" : undefined}
          aria-current={configActive ? "page" : undefined}
          title={t("configuration")}
          aria-label={t("configuration")}
          className="rail-btn"
        >
          <Settings className="size-5" />
        </Link>
      </div>
    </aside>
  );
}
