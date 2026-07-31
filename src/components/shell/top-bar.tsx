"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Globe, LogOut, Moon, Search, Sun } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { persistLocale, signOut } from "@/lib/actions/auth-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  const root = document.documentElement;
  const dark = root.classList.toggle("dark");
  try {
    localStorage.setItem("cuisina-theme", dark ? "dark" : "light");
  } catch {
    // Preference only — safe to lose in private browsing.
  }
}

export function TopBar({ profile }: { profile: ProfileRow }) {
  const t = useTranslations("app");
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
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <label className="relative hidden max-w-md flex-1 items-center sm:flex">
        <Search className="pointer-events-none absolute start-3.5 size-4 text-muted-foreground" />
        <input
          type="search"
          placeholder={t("search")}
          className="h-10 w-full rounded-full border border-border bg-card ps-10 pe-4 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
        />
      </label>

      <div className="ms-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="iconSm" aria-label={t("language")}>
              <Globe />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
            {locales.map((l) => (
              <DropdownMenuItem
                key={l}
                onSelect={() => switchLocale(l)}
                className={l === locale ? "font-semibold text-rouge" : undefined}
              >
                {LOCALE_LABELS[l]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="iconSm"
          aria-label={t("darkMode")}
          onClick={toggleTheme}
        >
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>

        <Button variant="ghost" size="iconSm" aria-label={t("notifications")}>
          <Bell />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ms-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`${profile.prenom} ${profile.nom}`}
            >
              <Avatar>
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
