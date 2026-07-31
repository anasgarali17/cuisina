"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { updateSuivi } from "@/lib/actions/fiche-actions";
import { formatDate } from "@/lib/dates";
import type { FicheRelanceRow, FicheRow } from "@/lib/database.types";
import type { Canal } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RelanceDialog } from "@/components/fiches/relance-dialog";

const CANAL_ICONS: Record<Canal, typeof Phone> = {
  whatsapp: MessageCircle,
  appel: Phone,
  sms: MessageSquare,
  email: Mail,
  visite: MapPin,
};

export function SuiviPanel({
  fiche,
  relances,
}: {
  fiche: FicheRow;
  relances: FicheRelanceRow[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [prevue, setPrevue] = useState(fiche.date_prevue_remise_devis ?? "");
  const [effective, setEffective] = useState(
    fiche.date_effective_remise_devis ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function saveDates() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateSuivi({
        fiche_id: fiche.id,
        date_prevue_remise_devis: prevue || null,
        date_effective_remise_devis: effective || null,
      });
      setMessage(
        result.ok
          ? t("app.saved")
          : result.error === "demo_mode"
            ? t("app.demoReadOnly")
            : t("app.error"),
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("fiches.detail.suivi")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="suivi-prevue">
              {t("fiches.detail.datePrevueDevis")}
            </Label>
            <Input
              id="suivi-prevue"
              type="date"
              value={prevue}
              onChange={(e) => setPrevue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suivi-effective">
              {t("fiches.detail.dateEffectiveDevis")}
            </Label>
            <Input
              id="suivi-effective"
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveDates} disabled={pending}>
              {t("app.save")}
            </Button>
            {message && (
              <span className="text-xs text-muted-foreground">{message}</span>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("fiches.detail.relances")}
          </h4>
          {relances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("fiches.detail.noRelance")}
            </p>
          ) : (
            <ol className="space-y-3">
              {relances.map((r) => {
                const Icon = CANAL_ICONS[r.canal];
                return (
                  <li key={r.id} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {t("fiches.detail.contactN", { n: r.numero_contact })} ·{" "}
                        {t(`canaux.${r.canal}`)} —{" "}
                        {t(`relanceResultats.${r.resultat}`)}
                      </p>
                      {r.commentaire && (
                        <p className="text-xs text-muted-foreground">
                          {r.commentaire}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.created_at, "d MMM yyyy", locale)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" />
            {t("fiches.detail.addRelance")}
          </Button>
        </div>
      </CardContent>

      <RelanceDialog
        ficheId={fiche.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onDone={() => router.refresh()}
      />
    </Card>
  );
}
