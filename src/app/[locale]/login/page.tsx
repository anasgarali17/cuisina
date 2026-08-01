"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BorderBeam } from "@/components/ui/border-beam";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* quiet grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:56px_56px] opacity-40 [mask-image:radial-gradient(60rem_36rem_at_50%_38%,black,transparent)]"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-rouge font-display text-2xl font-bold text-white">
          C
        </span>
        <h1 className="mt-5 text-center font-display text-4xl font-bold tracking-tight md:text-5xl">
          {tApp("tagline")}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t("subtitle")}
        </p>

        <Card className="relative mt-8 w-full overflow-hidden">
          <BorderBeam size={140} duration={10} borderWidth={1.5} />
          <CardHeader>
            <h2 className="font-display text-xl font-semibold">{t("title")}</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
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

              {error && (
                <p role="alert" className="text-sm font-medium text-rouge">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {t("submit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-8 text-xs text-muted-foreground">
          PROMOCUISINE · ISO 9001 · 9 showrooms
        </p>
      </div>
    </div>
  );
}
