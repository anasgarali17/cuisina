"use client";

import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { navPourRole, tabsPourRole } from "@/components/shell/nav-config";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/domain";

export function BottomTabs({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav className="no-print glass-strong fixed inset-x-0 bottom-0 z-40 flex border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden">
      {tabsPourRole(role).map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full",
                active && "bg-primary text-primary-foreground",
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="max-w-full truncate px-0.5">{t(tab.key)}</span>
          </Link>
        );
      })}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <span className="grid size-9 place-items-center rounded-full">
              <Menu className="size-5" />
            </span>
            <span className="max-w-full truncate px-0.5">{t("plus")}</span>
          </button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogTitle className="mb-2">{t("plus")}</DialogTitle>
          {navPourRole(role).map((group) => (
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
