"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { updateObjectif } from "@/lib/actions/tache-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageErreur } from "@/lib/utils";

/** Admin-only: edit a conseiller's monthly objective. */
export function ObjectifDialog({
  profileId,
  name,
  current,
}: {
  profileId: string;
  name: string;
  current: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await updateObjectif({
        profile_id: profileId,
        objectif_mensuel: value,
      });
      if (!result.ok) {
        setError(
          messageErreur(t, result.error),
        );
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`${t("equipe.editObjectif")} — ${name}`}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("equipe.editObjectif")}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="objectif-value">{t("equipe.objectifMensuel")}</Label>
          <Input
            id="objectif-value"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-rouge">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {t("app.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
