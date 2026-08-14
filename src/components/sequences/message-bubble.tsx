import { Check, CheckCheck, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

/** L'état d'une bulle sortante, du plus incertain au plus abouti. */
export type EtatBulle = "programme" | "en_retard" | "envoye" | "repondu" | "echec";

/**
 * Les coches de WhatsApp. Une horloge tant que le message n'est pas parti,
 * une coche quand il l'est, deux coches bleues quand le client a répondu.
 */
function Coches({ etat }: { etat: EtatBulle }) {
  if (etat === "programme" || etat === "en_retard") {
    return <Clock3 aria-hidden className="size-3.5 opacity-70" />;
  }
  if (etat === "repondu") {
    return (
      <CheckCheck
        aria-hidden
        className="size-3.5"
        style={{ color: "var(--wa-bleu-lu)" }}
      />
    );
  }
  if (etat === "echec") {
    return <span className="text-[11px] font-bold">!</span>;
  }
  return <Check aria-hidden className="size-3.5 opacity-70" />;
}

/**
 * Une bulle WhatsApp. Sortante par défaut — l'outil parle, il n'écoute pas
 * encore : nous n'avons aucun moyen de lire les réponses tant que la
 * passerelle n'est pas branchée.
 *
 * Un message seulement programmé garde la forme de la bulle mais perd son
 * aplomb : contour tireté, fond en retrait. Il faut voir en un coup d'œil ce
 * qui est parti et ce qui ne fait qu'attendre.
 */
export function MessageBubble({
  corps,
  heure,
  etat = "envoye",
  entrant,
  legende,
  className,
}: {
  corps: string;
  heure?: string;
  etat?: EtatBulle;
  entrant?: boolean;
  /** Petite ligne au-dessus du texte : la séquence, le palier. */
  legende?: string;
  className?: string;
}) {
  const enAttente = etat === "programme" || etat === "en_retard";

  return (
    <div
      dir="auto"
      className={cn(
        "relative w-fit max-w-[min(32rem,85%)] rounded-lg px-2.5 py-1.5 text-[14.2px] leading-[19px]",
        "shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
        entrant
          ? "me-auto rounded-tl-none wa-queue-gauche"
          : "ms-auto rounded-tr-none wa-queue-droite",
        enAttente && "border border-dashed opacity-90 shadow-none",
        className,
      )}
      style={{
        background: entrant ? "var(--wa-entrant)" : "var(--wa-sortant)",
        color: "var(--wa-texte)",
        ...(enAttente
          ? { borderColor: "color-mix(in srgb, var(--wa-texte) 25%, transparent)" }
          : {}),
      }}
    >
      {legende && (
        <p
          className="mb-0.5 text-[11px] font-semibold"
          style={{ color: "var(--wa-vert)" }}
        >
          {legende}
        </p>
      )}
      <span className="whitespace-pre-wrap break-words">{corps}</span>
      {/* Réserve la place de l'horodatage sur la dernière ligne, comme WhatsApp. */}
      <span className="float-end ms-2 mt-1 inline-flex translate-y-0.5 items-center gap-1 text-[11px]">
        <span style={{ color: "var(--wa-attenue)" }}>{heure}</span>
        {!entrant && (
          <span style={{ color: "var(--wa-attenue)" }}>
            <Coches etat={etat} />
          </span>
        )}
      </span>
    </div>
  );
}

/** La pastille centrale de WhatsApp : dates, avis de service. */
export function PastilleSysteme({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex justify-center">
      <span
        className={cn(
          "rounded-lg px-3 py-1 text-[12.5px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
          className,
        )}
        style={{
          background: "var(--wa-bulle-systeme)",
          color: "var(--wa-texte)",
        }}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * Les variables restantes, surlignées. Sur un modèle en cours d'écriture on
 * veut voir les `{{trous}}` ; sur un message rendu il n'en reste aucun.
 */
export function CorpsAvecVariables({ corps }: { corps: string }) {
  const morceaux = corps.split(/(\{\{\s*[a-z_]+\s*\}\})/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {morceaux.map((morceau, i) =>
        morceau.startsWith("{{") ? (
          <span
            key={i}
            className="rounded bg-chene/20 px-1 font-mono text-[0.85em] text-chene"
          >
            {morceau.replace(/[{}\s]/g, "")}
          </span>
        ) : (
          <span key={i}>{morceau}</span>
        ),
      )}
    </span>
  );
}
