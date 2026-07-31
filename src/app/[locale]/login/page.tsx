"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const t = useTranslations("login");
  const tApp = useTranslations("app");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await signIn({
        email: form.get("email"),
        password: form.get("password"),
      });
      if (result && !result.ok) setError(t("invalid"));
    });
  }

  return (
    <div className="grid min-h-screen bg-noir-atelier lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 text-ivoire lg:flex">
        <span className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-rouge font-display text-xl font-bold text-white">
            C
          </span>
          <span className="font-display text-lg font-bold tracking-wide">
            CUISINA
          </span>
        </span>
        <div>
          <p className="font-display text-5xl font-bold leading-tight">
            {tApp("tagline")}
          </p>
          <p className="mt-4 max-w-md text-sm text-ivoire/60">
            {t("subtitle")}
          </p>
        </div>
        <p className="text-xs text-ivoire/40">
          PROMOCUISINE · ISO 9001 · 9 showrooms
        </p>
      </div>

      <div className="flex items-center justify-center bg-background p-6 lg:rounded-s-[2.5rem]">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

          <div className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                inputMode="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-rouge">
              {error}
            </p>
          )}

          <Button type="submit" className="mt-6 w-full" disabled={pending}>
            {t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
