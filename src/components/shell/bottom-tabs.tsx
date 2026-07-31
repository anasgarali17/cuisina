"use client";

import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { MOBILE_TABS, NAV_GROUPS } from "@/components/shell/nav-config";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function BottomTabs() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {MOBILE_TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-rouge" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {t(tab.key)}
          </Link>
        );
      })}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <Menu className="size-5" />
            {t("plus")}
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogTitle className="mb-2">{t("plus")}</DialogTitle>
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="mb-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-chene">
                {t(`groups.${group.key}`)}
              </p>
              <ul>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm",
                          !item.ready && "opacity-55",
                        )}
                      >
                        <Icon className="size-4.5 text-muted-foreground" />
                        {t(item.key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </nav>
  );
}
