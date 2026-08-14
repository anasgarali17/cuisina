"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Inbox,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { decideSubmission } from "@/lib/actions/lien-actions";
import type { FicheSubmissionRow } from "@/lib/database.types";
import { SUBMISSION_STATUTS, type SubmissionStatut } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { cn, formatDT, messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ALL = "__all__";

const STATUT_CHIP: Record<SubmissionStatut, string> = {
  en_attente: "border-ambre/40 bg-ambre/10 text-ambre",
  accepte: "border-vert-plan/40 bg-vert-plan/10 text-vert-plan",
  refuse: "border-rouge/40 bg-rouge/10 text-rouge",
};

function StatutChip({ statut }: { statut: SubmissionStatut }) {
  const t = useTranslations();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUT_CHIP[statut],
      )}
    >
      <span aria-hidden className="text-[8px] leading-none">
        ●
      </span>
      {t(`demandes.statuts.${statut}`)}
    </span>
  );
}

/**
 * Ce que le QR code a fait remonter. Rien n'entre au pipeline sans un
 * verdict : une demande acceptée devient une fiche, une demande refusée
 * reste ici comme trace, une demande en attente garde sa place sur la pile.
 */
export function DemandesPanel({
  submissions: initial,
  conseillers,
}: {
  submissions: FicheSubmissionRow[];
  conseillers: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [submissions, setSubmissions] = useState(initial);
  const [filter, setFilter] = useState<string>("en_attente");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<{
    submission: FicheSubmissionRow;
    statut: SubmissionStatut;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(
    () => Object.fromEntries(conseillers.map((c) => [c.id, c.name])),
    [conseillers],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { [ALL]: submissions.length };
    for (const statut of SUBMISSION_STATUTS) {
      map[statut] = submissions.filter((s) => s.statut === statut).length;
    }
    return map;
  }, [submissions]);

  const visible = useMemo(
    () =>
      filter === ALL
        ? submissions
        : submissions.filter((s) => s.statut === filter),
    [submissions, filter],
  );

  async function decide(
    submission: FicheSubmissionRow,
    statut: SubmissionStatut,
    note: string,
    conseillerId: string | null,
  ) {
    setBusyId(submission.id);
    setError(null);
    const result = await decideSubmission({
      submission_id: submission.id,
      statut,
      note,
      conseiller_id: conseillerId,
    });
    setBusyId(null);
    if (!result.ok) {
      setError(
        messageErreur(t, result.error),
      );
      return;
    }
    setSubmissions((list) =>
      list.map((s) =>
        s.id === submission.id
          ? {
              ...s,
              statut,
              decision_note: note.trim() || null,
              decide_le: new Date().toISOString(),
              fiche_id: result.data.fiche_id,
              conseiller_id: conseillerId ?? s.conseiller_id,
            }
          : s,
      ),
    );
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (submissions.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <Inbox aria-hidden className="size-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("demandes.empty")}
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[...SUBMISSION_STATUTS, ALL].map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
              filter === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {key === ALL ? t("demandes.filters.all") : t(`demandes.statuts.${key}`)}
            <span className="font-mono text-xs opacity-70">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-rouge">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t("demandes.emptyFiltered")}
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => {
            const isOpen = expanded.has(s.id);
            const busy = busyId === s.id;
            return (
              <li key={s.id}>
                <Card className="overflow-hidden p-0">
                  <div className="p-4 md:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.reference}
                      </span>
                      <StatutChip statut={s.statut} />
                      <span className="ms-auto text-xs text-muted-foreground">
                        {formatDate(s.created_at, "d MMM yyyy · HH:mm", locale)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="font-display text-lg font-semibold">
                        {s.client_nom}
                      </p>
                      <p className="font-semibold tabular-nums">
                        {formatDT(s.budget_estimatif)}
                      </p>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {[
                        s.tel_mobile,
                        s.ville,
                        s.origine ? t(`origines.${s.origine}`) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <ProjectChips submission={s} />
                      <span className="ms-auto text-xs text-muted-foreground">
                        {t("demandes.score", { score: s.score_completude })}
                      </span>
                    </div>

                    {isOpen && <Details submission={s} names={names} />}

                    {s.statut !== "en_attente" && s.decision_note && (
                      <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                        {s.decision_note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/30 px-4 py-3">
                    {s.statut !== "accepte" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => setPending({ submission: s, statut: "accepte" })}
                      >
                        <Check />
                        {t("demandes.actions.accept")}
                      </Button>
                    )}
                    {s.statut !== "en_attente" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void decide(s, "en_attente", "", null)}
                      >
                        <Clock />
                        {t("demandes.actions.hold")}
                      </Button>
                    )}
                    {s.statut === "en_attente" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setPending({ submission: s, statut: "en_attente" })}
                      >
                        <Clock />
                        {t("demandes.actions.note")}
                      </Button>
                    )}
                    {s.statut !== "refuse" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setPending({ submission: s, statut: "refuse" })}
                      >
                        <X />
                        {t("demandes.actions.refuse")}
                      </Button>
                    )}

                    {s.fiche_id && (
                      <Link
                        href={`/fiches/${s.fiche_id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        {t("demandes.actions.openFiche")}
                        <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-expanded={isOpen}
                      className="ms-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t("app.seeAll")}
                      <ChevronRight
                        aria-hidden
                        className={cn(
                          "size-4 transition-transform",
                          isOpen ? "rotate-90" : "rtl:rotate-180",
                        )}
                      />
                    </button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <DecisionDialog
        pending={pending}
        conseillers={conseillers}
        onClose={() => setPending(null)}
        onConfirm={(note, conseillerId) => {
          if (!pending) return;
          void decide(pending.submission, pending.statut, note, conseillerId);
          setPending(null);
        }}
      />
    </div>
  );
}

function ProjectChips({ submission }: { submission: FicheSubmissionRow }) {
  const t = useTranslations();
  const chips: string[] = [];
  if (submission.nb_cuisines > 0) {
    chips.push(t("pipeline.projectChips.cuisine", { n: submission.nb_cuisines }));
  }
  if (submission.nb_dressings > 0) {
    chips.push(t("pipeline.projectChips.dressing", { n: submission.nb_dressings }));
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip}
          className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function Details({
  submission,
  names,
}: {
  submission: FicheSubmissionRow;
  names: Record<string, string>;
}) {
  const t = useTranslations();
  const rows: [string, string | null][] = [
    [t("fiches.wizard.email"), submission.email],
    [t("fiches.wizard.telDomicile"), submission.tel_domicile],
    [t("fiches.wizard.adresse"), submission.adresse_complete],
    [t("fiches.wizard.codePostal"), submission.code_postal],
    [
      t("fiches.wizard.etatChantier"),
      submission.etat_chantier
        ? t(`fiches.wizard.${submission.etat_chantier}`)
        : null,
    ],
    [t("fiches.wizard.dateLivraison"), submission.date_livraison_souhaitee],
    [
      t("demandes.origineDetail"),
      submission.origine_detail
        ? t(`origines.details.${submission.origine_detail}`)
        : null,
    ],
    [t("demandes.assigne"), names[submission.conseiller_id] ?? null],
  ];

  return (
    <div className="mt-4 border-t border-border pt-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {submission.observations && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            {t("fiches.wizard.observations")}
          </p>
          <p className="mt-0.5 text-sm">{submission.observations}</p>
        </div>
      )}
    </div>
  );
}

function DecisionDialog({
  pending,
  conseillers,
  onClose,
  onConfirm,
}: {
  pending: { submission: FicheSubmissionRow; statut: SubmissionStatut } | null;
  conseillers: { id: string; name: string }[];
  onClose: () => void;
  onConfirm: (note: string, conseillerId: string | null) => void;
}) {
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {pending && (
          // Remonté à chaque ouverture : le formulaire repart toujours vierge.
          <DecisionForm
            key={pending.submission.id + pending.statut}
            pending={pending}
            conseillers={conseillers}
            onCancel={onClose}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DecisionForm({
  pending,
  conseillers,
  onCancel,
  onConfirm,
}: {
  pending: { submission: FicheSubmissionRow; statut: SubmissionStatut };
  conseillers: { id: string; name: string }[];
  onCancel: () => void;
  onConfirm: (note: string, conseillerId: string | null) => void;
}) {
  const t = useTranslations();
  const { submission, statut } = pending;
  const [note, setNote] = useState("");
  const [conseillerId, setConseillerId] = useState(submission.conseiller_id);

  const isAccept = statut === "accepte";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(`demandes.dialog.${statut}.title`)}</DialogTitle>
        <DialogDescription>
          {t(`demandes.dialog.${statut}.prompt`, { client: submission.client_nom })}
        </DialogDescription>
      </DialogHeader>

      {isAccept && conseillers.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="d-conseiller">{t("demandes.dialog.assignTo")}</Label>
          <Select value={conseillerId} onValueChange={setConseillerId}>
            <SelectTrigger id="d-conseiller">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conseillers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="d-note">{t("demandes.dialog.note")}</Label>
        <Textarea
          id="d-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(`demandes.dialog.${statut}.placeholder`)}
          maxLength={500}
        />
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          {t("app.cancel")}
        </Button>
        <Button
          variant={statut === "refuse" ? "destructive" : "default"}
          onClick={() => onConfirm(note, isAccept ? conseillerId : null)}
        >
          {t("app.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
