"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Globe, LogOut, Moon, Search, Settings, Sun } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { persistLocale, signOut } from "@/lib/actions/auth-actions";
import { applyTheme } from "@/lib/theme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import type { ProfileRow } from "@/lib/database.types";

const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

function toggleTheme() {
  const dark = document.documentElement.classList.contains("dark");
  applyTheme(dark ? "light" : "dark");
}

export function TopBar({ profile }: { profile: ProfileRow }) {
  const t = useTranslations("app");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function switchLocale(next: Locale) {
    startTransition(() => {
      void persistLocale(next);
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
      <label className="relative flex h-11 max-w-xl flex-1 items-center rounded-2xl border border-transparent bg-secondary/60 focus-within:ring-2 focus-within:ring-ring">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3.5 size-4 text-muted-foreground"
        />
        <input
          type="search"
          placeholder={t("search")}
          className="h-full w-full rounded-2xl bg-transparent ps-10 pe-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
        />
        <kbd className="me-2.5 hidden shrink-0 items-center gap-0.5 rounded-md border border-border bg-card px-1.5 font-mono text-[10px] text-muted-foreground sm:flex">
          <span>Ctrl</span>
          <span>K</span>
        </kbd>
      </label>

      <div className="ms-auto flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("language")}
              className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Globe aria-hidden="true" className="size-4 text-muted-foreground" />
              {locale.toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
            {locales.map((l) => (
              <DropdownMenuItem
                key={l}
                onSelect={() => switchLocale(l)}
                className={l === locale ? "font-semibold text-primary" : undefined}
              >
                {LOCALE_LABELS[l]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          aria-label={t("darkMode")}
          onClick={toggleTheme}
          className="grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Sun className="size-4.5 dark:hidden" />
          <Moon className="hidden size-4.5 dark:block" />
        </button>

        <button
          type="button"
          aria-label={t("notifications")}
          className="relative grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Bell className="size-4.5" />
          <span
            aria-hidden="true"
            className="absolute end-2 top-2 size-2 rounded-full bg-rouge"
          />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ms-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`${profile.prenom} ${profile.nom}`}
            >
              <Avatar className="ring-1 ring-border">
                <AvatarFallback>
                  {initials(profile.nom, profile.prenom)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {profile.prenom} {profile.nom}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/parametres")}>
              <Settings />
              {tNav("parametres")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
