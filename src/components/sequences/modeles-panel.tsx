"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  LONGUEUR_MESSAGE_MAX,
  MODELE_CATEGORIES,
  VARIABLES_MESSAGE,
  type ModeleCategorie,
  type VariableMessage,
} from "@/lib/domain";
import type { ModeleMessageRow, ProfileRow } from "@/lib/database.types";
import { createModele, updateModele } from "@/lib/actions/sequence-actions";
import {
  VARIABLES_EXEMPLE,
  rendreMessage,
  variablesInconnues,
} from "@/lib/whatsapp";
import { cn, messageErreur } from "@/lib/utils";
import {
  CorpsAvecVariables,
  MessageBubble,
} from "@/components/sequences/message-bubble";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Les textes. Un modèle validé une fois vaut mieux que neuf conseillers qui
 * réécrivent la même relance neuf fois — et il rend l'automatisation
 * relisible : on corrige le texte ici, pas dans chaque séquence.
 */
export function ModelesPanel({
  modeles,
  profile,
  usageParModele,
}: {
  modeles: ModeleMessageRow[];
  profile: ProfileRow;
  /** Dans combien d'étapes de séquence chaque modèle est employé. */
  usageParModele: Record<string, number>;
}) {
  const t = useTranslations();
  const [edite, setEdite] = useState<ModeleMessageRow | null>(null);
  const [creation, setCreation] = useState(false);

  const peutEcrire = profile.role !== "conseiller";

  const parCategorie = useMemo(() => {
    const map = new Map<ModeleCategorie, ModeleMessageRow[]>();
    for (const categorie of MODELE_CATEGORIES) map.set(categorie, []);
    for (const modele of modeles) {
      map.get(modele.categorie)?.push(modele);
    }
    return [...map.entries()].filter(([, liste]) => liste.length > 0);
  }, [modeles]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("sequences.modeles.intro")}
        </p>
        {peutEcrire && (
          <Button className="neo neo-hover" onClick={() => setCreation(true)}>
            <Plus className="size-4" />
            {t("sequences.modeles.nouveau")}
          </Button>
        )}
      </div>

      {modeles.length === 0 ? (
        <div className="grid min-h-[36vh] place-items-center rounded-3xl border border-dashed border-border bg-card/60">
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("sequences.modeles.vide")}
          </p>
        </div>
      ) : (
        parCategorie.map(([categorie, liste]) => (
          <section key={categorie} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`sequences.categories.${categorie}`)}
            </h3>
            <ul className="grid gap-3 md:grid-cols-2">
              {liste.map((modele) => (
                <li
                  key={modele.id}
                  className={cn(
                    "rounded-3xl border border-border bg-card p-4",
                    !modele.actif && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{modele.libelle}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {modele.code}
                      </p>
                    </div>
                    {peutEcrire && (
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={t("app.edit")}
                        onClick={() => setEdite(modele)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                  </div>

                  <p className="mt-3 rounded-2xl bg-brume/40 p-3 text-sm leading-relaxed">
                    <CorpsAvecVariables corps={modele.corps} />
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{modele.corps.length} car.</Badge>
                    {(usageParModele[modele.id] ?? 0) > 0 ? (
                      <Badge variant="chene">
                        {t("sequences.modeles.usage", {
                          count: usageParModele[modele.id],
                        })}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {t("sequences.modeles.inutilise")}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {(creation || edite) && (
        <ModeleEditor
          key={edite?.id ?? "nouveau"}
          modele={edite}
          onOpenChange={(ouvert) => {
            if (!ouvert) {
              setCreation(false);
              setEdite(null);
            }
          }}
        />
      )}
    </div>
  );
}

function ModeleEditor({
  modele,
  onOpenChange,
}: {
  modele: ModeleMessageRow | null;
  onOpenChange: (ouvert: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [code, setCode] = useState(modele?.code ?? "");
  const [libelle, setLibelle] = useState(modele?.libelle ?? "");
  const [categorie, setCategorie] = useState<ModeleCategorie>(
    modele?.categorie ?? "relance",
  );
  const [corps, setCorps] = useState(modele?.corps ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inconnues = variablesInconnues(corps);
  const trop = corps.length > LONGUEUR_MESSAGE_MAX;
  const valide =
    code.trim().length >= 2 &&
    /^[a-z0-9-]+$/.test(code.trim()) &&
    libelle.trim().length >= 2 &&
    corps.trim().length >= 2 &&
    inconnues.length === 0 &&
    !trop;

  /** Insère la variable à la fin : suffisant, et sans piège de curseur. */
  function inserer(variable: VariableMessage) {
    setCorps((c) => `${c}{{${variable}}}`);
  }

  function enregistrer() {
    setErreur(null);
    const charge = {
      code: code.trim(),
      libelle: libelle.trim(),
      categorie,
      locale: modele?.locale ?? "fr",
      corps,
      point_de_vente_id: modele?.point_de_vente_id ?? null,
    };

    startTransition(async () => {
      const resultat = modele
        ? await updateModele({ id: modele.id, ...charge })
        : await createModele(charge);
      if (!resultat.ok) {
        setErreur(
          resultat.error === "code_existe"
            ? t("sequences.modeles.codeExiste")
            : messageErreur(t, resultat.error),
        );
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {modele
              ? t("sequences.modeles.titreEdition")
              : t("sequences.modeles.titreCreation")}
          </DialogTitle>
          <DialogDescription>
            {t("sequences.modeles.editeurIntro")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mod-libelle">
                {t("sequences.modeles.libelle")}
              </Label>
              <Input
                id="mod-libelle"
                value={libelle}
                maxLength={120}
                onChange={(e) => setLibelle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-cat">{t("sequences.modeles.categorie")}</Label>
              <Select
                value={categorie}
                onValueChange={(v) => setCategorie(v as ModeleCategorie)}
              >
                <SelectTrigger id="mod-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`sequences.categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mod-code">{t("sequences.modeles.code")}</Label>
            <Input
              id="mod-code"
              value={code}
              maxLength={60}
              placeholder="relance-j3"
              className="font-mono"
              onChange={(e) =>
                setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("sequences.modeles.codeAide")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mod-corps">{t("sequences.modeles.corps")}</Label>
            <Textarea
              id="mod-corps"
              className="min-h-40 font-sans leading-relaxed"
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {VARIABLES_MESSAGE.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => inserer(variable)}
                    className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-chene hover:text-chene"
                  >
                    {variable}
                  </button>
                ))}
              </div>
              <span
                className={cn(
                  "font-mono text-xs text-muted-foreground",
                  trop && "font-semibold text-rouge",
                )}
              >
                {corps.length}/{LONGUEUR_MESSAGE_MAX}
              </span>
            </div>
          </div>

          {inconnues.length > 0 && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-2xl bg-rouge/8 p-3 text-sm text-rouge"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t("sequences.modeles.variableInconnue", {
                variables: inconnues.join(", "),
              })}
            </p>
          )}

          {/* L'aperçu vaut la relecture : dans une bulle, les longueurs se voient. */}
          <div className="space-y-2 rounded-2xl border border-border bg-brume/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("sequences.modeles.apercu")}
            </p>
            {corps.trim() ? (
              <MessageBubble
                corps={rendreMessage(corps, VARIABLES_EXEMPLE)}
                heure="10:24"
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">
                {t("sequences.modeles.apercuVide")}
              </p>
            )}
          </div>

          {erreur && (
            <p role="alert" className="text-sm font-medium text-rouge">
              {erreur}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("app.cancel")}
          </Button>
          <Button onClick={enregistrer} disabled={pending || !valide}>
            {t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
