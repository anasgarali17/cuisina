"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { listMotifsPersonnalises } from "@/lib/actions/fiche-actions";
import {
  CADENCES,
  CADENCE_PAR_MOTIF,
  MOTIFS_PAUSE,
  MOTIFS_PERTE,
  type MotifPause,
  type MotifPerte,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";

export interface StageReason {
  motif_perte: MotifPerte | null;
  motif_perte_libre: string;
  motif_pause: MotifPause | null;
  motif_pause_detail: string;
  pause_cadence_jours: number | null;
  enregistrer_motif: boolean;
}

/** No reason attached — moving between ordinary funnel stages. */
export const EMPTY_REASON: StageReason = {
  motif_perte: null,
  motif_perte_libre: "",
  motif_pause: null,
  motif_pause_detail: "",
  pause_cadence_jours: null,
  enregistrer_motif: false,
};

const FREE = "__libre__";
const DEFAULT_CADENCE = 14;

/**
 * Asks why a fiche leaves the funnel. Presets first, then any reason the team
 * saved earlier, then a free-text box the conseiller can choose to keep — so
 * the list grows with the way this showroom actually loses and parks leads.
 * For a pause it also picks the WhatsApp check-back rhythm.
 */
export function StageReasonDialog({
  mode,
  open,
  onOpenChange,
  onConfirm,
}: {
  mode: "perdu" | "en_pause" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: StageReason) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {mode && (
          // Remounts per opening, so the form always starts blank.
          <ReasonForm
            key={`${mode}-${String(open)}`}
            mode={mode}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReasonForm({
  mode,
  onCancel,
  onConfirm,
}: {
  mode: "perdu" | "en_pause";
  onCancel: () => void;
  onConfirm: (reason: StageReason) => void;
}) {
  const t = useTranslations();
  const [choice, setChoice] = useState("");
  const [libre, setLibre] = useState("");
  const [garder, setGarder] = useState(false);
  const [cadenceOverride, setCadenceOverride] = useState<number | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  const isPause = mode === "en_pause";

  useEffect(() => {
    let alive = true;
    void listMotifsPersonnalises(isPause ? "pause" : "perte").then((list) => {
      if (alive) setSaved(list);
    });
    return () => {
      alive = false;
    };
  }, [isPause]);

  // Derived, not synced: each pause reason suggests its own rhythm until the
  // conseiller picks one explicitly.
  const suggested = MOTIFS_PAUSE.includes(choice as MotifPause)
    ? CADENCE_PAR_MOTIF[choice as MotifPause]
    : DEFAULT_CADENCE;
  const cadence = cadenceOverride ?? suggested;

  const usingFree = choice === FREE || saved.includes(choice);
  const freeText = choice === FREE ? libre.trim() : usingFree ? choice : "";
  const valid = usingFree ? freeText.length >= 2 : choice.length > 0;

  function confirm() {
    if (!valid) return;
    onConfirm(
      isPause
        ? {
            ...EMPTY_REASON,
            motif_pause: usingFree ? "autre" : (choice as MotifPause),
            motif_pause_detail: freeText,
            pause_cadence_jours: cadence,
            enregistrer_motif: choice === FREE && garder,
          }
        : {
            ...EMPTY_REASON,
            motif_perte: usingFree ? "autre" : (choice as MotifPerte),
            motif_perte_libre: freeText,
            enregistrer_motif: choice === FREE && garder,
          },
    );
  }

  const presets: readonly string[] = isPause ? MOTIFS_PAUSE : MOTIFS_PERTE;
  const presetLabel = (key: string) =>
    isPause ? t(`pipeline.pause.${key}`) : t(`motifsPerte.${key}`);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isPause ? t("pipeline.pause.title") : t("motifsPerte.title")}
        </DialogTitle>
        <DialogDescription>
          {isPause ? t("pipeline.pause.prompt") : t("motifsPerte.prompt")}
        </DialogDescription>
      </DialogHeader>

      <RadioGroup value={choice} onValueChange={setChoice} className="gap-2">
        {presets
          .filter((key) => key !== "autre")
          .map((key) => (
            <RadioCard key={key} value={key}>
              {presetLabel(key)}
            </RadioCard>
          ))}

        {saved.map((libelle) => (
          <RadioCard key={libelle} value={libelle}>
            {libelle}
          </RadioCard>
        ))}

        <RadioCard value={FREE}>{t("pipeline.motifLibre.label")}</RadioCard>
      </RadioGroup>

      {choice === FREE && (
        <div className="space-y-2 ps-2">
          <Input
            value={libre}
            onChange={(e) => setLibre(e.target.value)}
            placeholder={t("pipeline.motifLibre.placeholder")}
            maxLength={120}
            aria-label={t("pipeline.motifLibre.label")}
            autoFocus
          />
          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={garder}
              onCheckedChange={(v) => setGarder(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium">
                {t("pipeline.motifLibre.save")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("pipeline.motifLibre.saveHint")}
              </span>
            </span>
          </label>
        </div>
      )}

      {isPause && (
        <div className="mt-2 space-y-2 border-t border-border pt-4">
          <Label className="text-sm font-medium">
            {t("pipeline.pause.cadence")}
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {CADENCES.map((jours) => (
              <button
                key={jours}
                type="button"
                aria-pressed={cadence === jours}
                onClick={() => setCadenceOverride(jours)}
                className={cn(
                  "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                  cadence === jours
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                {t("pipeline.pause.jours", { n: jours })}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("pipeline.pause.cadenceHint")}
          </p>
        </div>
      )}

      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          {t("app.cancel")}
        </Button>
        <Button disabled={!valid} onClick={confirm}>
          {t("app.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
