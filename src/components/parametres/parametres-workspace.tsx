"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages, Palette, UserRound } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { persistLocale } from "@/lib/actions/auth-actions";
import { updateProfil } from "@/lib/actions/profile-actions";
import {
  applyTheme,
  getStoredTheme,
  subscribeTheme,
  THEME_PREVIEWS,
  THEMES,
  type Theme,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, messageErreur } from "@/lib/utils";
import type { ProfileRow } from "@/lib/database.types";

const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ParametresWorkspace({ profile }: { profile: ProfileRow }) {
  const t = useTranslations("parametres");
  const tApp = useTranslations("app");
  /** Racine — `messageErreur` résout des clés `errors.*` et `app.*`. */
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // ----- Profil -----
  const [prenom, setPrenom] = useState(profile.prenom);
  const [nom, setNom] = useState(profile.nom);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    prenom.trim() !== profile.prenom || nom.trim() !== profile.nom;
  const valid = prenom.trim().length > 0 && nom.trim().length > 0;

  function saveProfil() {
    setError(null);
    startTransition(async () => {
      const result = await updateProfil({ prenom, nom });
      if (!result.ok) {
        setError(messageErreur(tRoot, result.error));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  // ----- Apparence -----
  // Le serveur ne connaît pas le thème stocké en local : null jusqu'à l'hydratation.
  const theme = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    (): Theme | null => null,
  );

  // ----- Langue -----
  const [localePending, startLocaleTransition] = useTransition();

  function switchLocale(next: Locale) {
    if (next === locale) return;
    startLocaleTransition(() => {
      void persistLocale(next);
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Card className="p-5 md:p-6">
        <SectionHeader
          icon={UserRound}
          title={t("profil.title")}
          description={t("profil.description")}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="parametres-prenom">{t("profil.prenom")}</Label>
            <Input
              id="parametres-prenom"
              value={prenom}
              maxLength={80}
              onChange={(e) => {
                setPrenom(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="parametres-nom">{t("profil.nom")}</Label>
            <Input
              id="parametres-nom"
              value={nom}
              maxLength={80}
              onChange={(e) => {
                setNom(e.target.value);
                setSaved(false);
              }}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-rouge">
            {error}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={saveProfil} disabled={pending || !dirty || !valid}>
            {tApp("save")}
          </Button>
          {saved && !dirty && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Check aria-hidden="true" className="size-4 text-primary" />
              {tApp("saved")}
            </span>
          )}
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <SectionHeader
          icon={Palette}
          title={t("apparence.title")}
          description={t("apparence.description")}
        />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
          {THEMES.map((th) => {
            const preview = THEME_PREVIEWS[th];
            const active = theme === th;
            return (
              <button
                key={th}
                type="button"
                aria-pressed={active}
                onClick={() => applyTheme(th)}
                className={cn(
                  "rounded-2xl border p-3 text-start transition-colors",
                  active
                    ? "border-primary ring-2 ring-primary/25"
                    : "border-border hover:bg-secondary/60",
                )}
              >
                <span
                  aria-hidden="true"
                  className="block h-16 overflow-hidden rounded-xl border border-border"
                  style={{ background: preview.fond }}
                >
                  <span
                    className="m-2 flex h-5 items-center gap-1.5 rounded-md px-1.5 shadow-sm"
                    style={{ background: preview.carte }}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: preview.accent }}
                    />
                    <span
                      className="h-1.5 flex-1 rounded-full"
                      style={{ background: "rgba(128 128 128 / 0.45)" }}
                    />
                  </span>
                </span>
                <span className="mt-2 flex items-center justify-between text-sm font-medium">
                  {t(`apparence.themes.${th}`)}
                  {active && (
                    <Check aria-hidden="true" className="size-4 text-primary" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <SectionHeader
          icon={Languages}
          title={t("langue.title")}
          description={t("langue.description")}
        />
        <ul className="mt-5 space-y-2 sm:max-w-md">
          {locales.map((l) => {
            const active = l === locale;
            return (
              <li key={l}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={localePending}
                  onClick={() => switchLocale(l)}
                  className={cn(
                    "flex h-12 w-full items-center justify-between rounded-xl border px-4 text-sm transition-colors",
                    active
                      ? "border-primary bg-secondary/60 font-semibold"
                      : "border-border hover:bg-secondary/60",
                  )}
                >
                  <span>{LOCALE_LABELS[l]}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase text-muted-foreground">
                      {l}
                    </span>
                    {active && (
                      <Check
                        aria-hidden="true"
                        className="size-4 text-primary"
                      />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
