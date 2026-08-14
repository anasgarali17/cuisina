"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PieceJointeLocale {
  /** Identifiant local — la ligne en base n'existe qu'après enregistrement. */
  cle: string;
  fichier: File;
}

/** 10 Mo : au-delà, c'est un envoi qui échoue sur une connexion de showroom. */
const TAILLE_MAX = 10 * 1024 * 1024;

function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Les documents accrochés à la fiche : plans, photos de chantier, devis
 * concurrents, justificatifs.
 *
 * Les fichiers restent en mémoire jusqu'à l'enregistrement de la fiche — sans
 * `fiche_id`, il n'y a nulle part où les ranger. Le refus (trop gros, doublon)
 * se dit ici, tout de suite : découvrir à l'envoi qu'un fichier de 40 Mo ne
 * passera pas, c'est perdre la saisie avec.
 */
export function PiecesJointes({
  pieces,
  onChange,
}: {
  pieces: PieceJointeLocale[];
  onChange: (pieces: PieceJointeLocale[]) => void;
}) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [refus, setRefus] = useState<string | null>(null);

  function ajouter(liste: FileList | null) {
    if (!liste || liste.length === 0) return;
    const trop = [...liste].find((f) => f.size > TAILLE_MAX);
    if (trop) {
      setRefus(t("fiches.pieces.tropGros", { nom: trop.name }));
      return;
    }
    setRefus(null);
    const deja = new Set(pieces.map((p) => `${p.fichier.name}:${p.fichier.size}`));
    const nouvelles = [...liste]
      .filter((f) => !deja.has(`${f.name}:${f.size}`))
      .map((fichier, i) => ({
        cle: `${Date.now()}-${i}-${fichier.name}`,
        fichier,
      }));
    onChange([...pieces, ...nouvelles]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip aria-hidden="true" className="size-4" />
          {t("fiches.pieces.titre")}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          {t("fiches.pieces.ajouter")}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
        onChange={(e) => {
          ajouter(e.target.files);
          // Remis à zéro : sinon re-sélectionner le même fichier ne déclenche
          // aucun change.
          e.target.value = "";
        }}
      />

      {refus && (
        <p role="alert" className="text-xs font-medium text-rouge">
          {refus}
        </p>
      )}

      {pieces.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
          {t("fiches.pieces.vide")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {pieces.map((p) => (
            <li
              key={p.cle}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
            >
              <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{p.fichier.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {tailleLisible(p.fichier.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label={t("app.delete")}
                onClick={() => onChange(pieces.filter((x) => x.cle !== p.cle))}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
