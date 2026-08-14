"use client";

import { useTranslations } from "next-intl";
import { AtSign, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** WhatsApp, e-mail, ou ni l'un ni l'autre tant que rien n'est choisi. */
export type CanalPrefere = "whatsapp" | "email" | null;

/**
 * Comment on recontacte cette personne : WhatsApp **ou** e-mail.
 *
 * Un choix, pas deux cases à remplir. Afficher le champ e-mail en permanence
 * à côté d'une case WhatsApp demandait les deux à quelqu'un qui n'en veut
 * qu'un — et laissait deviner lequel serait effectivement utilisé.
 *
 * WhatsApp ne demande rien : c'est le mobile déjà saisi. L'e-mail ouvre un
 * champ. Changer d'avis efface l'autre, pour qu'une fiche ne porte jamais
 * deux canaux dont un seul est vrai.
 *
 * Le même composant sert la fiche du conseiller et le formulaire client :
 * c'est la même question, elle mérite la même réponse.
 */
export function ChoixContact({
  canal,
  email,
  telephone,
  onChange,
  erreurEmail,
  idPrefixe = "contact",
}: {
  canal: CanalPrefere;
  email: string;
  /** Le mobile déjà saisi — repris tel quel par WhatsApp. */
  telephone: string;
  onChange: (patch: { canal: CanalPrefere; email: string }) => void;
  erreurEmail?: string | null;
  idPrefixe?: string;
}) {
  const t = useTranslations();
  const mobilePret = telephone.trim().length >= 8;

  function choisir(suivant: CanalPrefere) {
    // Re-cliquer sur le canal actif le désélectionne : on peut ne rien vouloir.
    const actif = canal === suivant ? null : suivant;
    onChange({ canal: actif, email: actif === "email" ? email : "" });
  }

  const options = [
    {
      id: "whatsapp" as const,
      icone: MessageCircle,
      libelle: t("contact.whatsapp"),
      dispo: mobilePret,
    },
    {
      id: "email" as const,
      icone: AtSign,
      libelle: t("contact.email"),
      dispo: true,
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("contact.question")}</p>

      <div className="grid grid-cols-2 gap-2 sm:max-w-md">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={!o.dispo}
            aria-pressed={canal === o.id}
            onClick={() => choisir(o.id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors",
              canal === o.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-secondary/60",
              !o.dispo && "cursor-not-allowed opacity-45",
            )}
          >
            <o.icone aria-hidden className="size-4" />
            {o.libelle}
          </button>
        ))}
      </div>

      {canal === "whatsapp" && (
        <p className="text-xs text-muted-foreground">
          {t("contact.whatsappRepris", { numero: telephone.trim() })}
        </p>
      )}

      {canal === null && !mobilePret && (
        <p className="text-xs text-muted-foreground">
          {t("contact.mobileDabord")}
        </p>
      )}

      {canal === "email" && (
        <div className="space-y-1.5 pt-1 sm:max-w-md">
          <Label htmlFor={`${idPrefixe}-email`}>{t("contact.emailLabel")}</Label>
          <Input
            id={`${idPrefixe}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            aria-invalid={Boolean(erreurEmail)}
            onChange={(e) => onChange({ canal, email: e.target.value })}
          />
          {erreurEmail && (
            <p className="text-xs font-medium text-rouge">{erreurEmail}</p>
          )}
        </div>
      )}
    </div>
  );
}
