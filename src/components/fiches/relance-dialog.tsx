"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { logRelance } from "@/lib/actions/fiche-actions";
import { CANAUX, RELANCE_RESULTATS, type Canal } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { messageErreur } from "@/lib/utils";

interface RelanceDialogProps {
  ficheId: string;
  tacheId?: string | null;
  defaultCanal?: Canal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

/**
 * Logs a relance (the digital heir of the paper's 1er–5ème contact lines)
 * and offers to schedule the next one.
 */
export function RelanceDialog({
  ficheId,
  tacheId = null,
  defaultCanal = null,
  open,
  onOpenChange,
  onDone,
}: RelanceDialogProps) {
  const t = useTranslations();
  const [canal, setCanal] = useState<string>(defaultCanal ?? "appel");
  const [resultat, setResultat] = useState<string>("joint");
  const [commentaire, setCommentaire] = useState("");
  const [prochaine, setProchaine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await logRelance({
        fiche_id: ficheId,
        canal,
        resultat,
        commentaire,
        tache_id: tacheId,
        prochaine_relance: prochaine || null,
      });
      if (!result.ok) {
        setError(
          messageErreur(t, result.error),
        );
        return;
      }
      onOpenChange(false);
      setCommentaire("");
      setProchaine("");
      onDone?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("fiches.detail.addRelance")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="relance-canal">{t("fiches.detail.canal")}</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger id="relance-canal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAUX.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`canaux.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relance-resultat">
                {t("fiches.detail.resultat")}
              </Label>
              <Select value={resultat} onValueChange={setResultat}>
                <SelectTrigger id="relance-resultat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELANCE_RESULTATS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`relanceResultats.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="relance-commentaire">
              {t("fiches.detail.commentaire")}
            </Label>
            <Textarea
              id="relance-commentaire"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="relance-prochaine">
              {t("fiches.detail.scheduleNext")}
            </Label>
            <DatePicker
              id="relance-prochaine"
              value={prochaine}
              onChange={setProchaine}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-rouge">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
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
