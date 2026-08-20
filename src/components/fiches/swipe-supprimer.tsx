"use client";

import { useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Balayer pour supprimer.
 *
 * Le geste du courrier sur téléphone : on pousse la carte de côté, une zone
 * rouge apparaît dessous. Un balayage franc efface directement ; un balayage
 * court laisse le bouton découvert, et c'est lui qui décide. Deux seuils
 * plutôt qu'un : le pouce dérape sur une liste qu'on fait défiler, et une
 * suppression définitive ne doit pas tenir à trois pixels.
 *
 * Le bouton existe pour de vrai dans le DOM, tout le temps. Un geste ne se
 * tabule pas et ne s'annonce pas au lecteur d'écran : sans lui, la
 * suppression n'existerait que pour ceux qui ont une main sur un écran
 * tactile. Le focus clavier ouvre la zone comme le ferait le doigt.
 *
 * Le défilement vertical garde la priorité : tant que le geste penche vers le
 * haut ou le bas, on ne le capture pas — sinon la liste se bloquerait dès
 * qu'un pouce descend un peu de travers.
 */

/** Ce qu'il faut découvrir pour que la zone rouge tienne ouverte. */
const SEUIL_OUVERTURE = 72;
/** Au-delà, le relâchement efface sans repasser par le bouton. */
const SEUIL_SUPPRESSION = 0.45;
/** En deçà, le geste est vertical : c'est un défilement, pas un balayage. */
const PENTE_MINIMALE = 1.2;

export function SwipeSupprimer({
  onSupprimer,
  actif,
  libelle,
  enCours = false,
  children,
}: {
  onSupprimer: () => void;
  /** Faux = carte figée : rien à supprimer ici. */
  actif: boolean;
  /** Nom accessible du bouton — il nomme la demande, pas « supprimer ». */
  libelle: string;
  enCours?: boolean;
  children: React.ReactNode;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  /** Null tant qu'on ne sait pas si le geste est horizontal. */
  const horizontal = useRef<boolean | null>(null);
  /**
   * Le déplacement courant, doublé en ref.
   *
   * Le relâchement décide sur la distance parcourue, et l'état React n'est
   * pas encore à jour quand les déplacements et le relâchement tombent dans
   * le même lot — un geste vif, où tout arrive en une seule frame. La
   * fermeture du gestionnaire lisait alors un `dx` resté à zéro, et le
   * balayage franc ne supprimait rien.
   */
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  /**
   * Le sens de lecture, déduit de la locale plutôt que lu sur le document.
   *
   * C'est la même règle qu'au `layout` (`dir = locale === "ar"`), disponible
   * dès le rendu : passer par `document.dir` dans un effet aurait fait
   * glisser la carte du mauvais côté le temps d'un rendu, en arabe.
   */
  const rtl = useLocale() === "ar";
  /**
   * Le doigt est-il posé ?
   *
   * En état et non en ref : le rendu s'en sert pour couper l'animation, et
   * une ref lue pendant le rendu ne le redéclenche pas — la carte serait
   * restée animée pendant tout le geste, à traîner derrière le pouce.
   */
  const [glisse, setGlisse] = useState(false);

  /** Le déplacement, toujours compté vers l'intérieur de l'écran. */
  const vers = (delta: number) => (rtl ? -delta : delta);

  /*
   * Une carte qui cesse d'être effaçable revient à plat sans qu'un effet ait
   * à la remettre en place : la valeur se déduit, elle ne se synchronise pas.
   * Le cas arrive pour de vrai — remettre une demande refusée « en attente »
   * la fige, et elle serait restée poussée de côté.
   */
  const decalage = actif ? dx : 0;

  function onPointerDown(e: React.PointerEvent) {
    if (!actif || enCours) return;
    // La souris n'a pas à balayer : elle a le bouton, et capturer ses
    // déplacements empêcherait de sélectionner le texte de la carte.
    if (e.pointerType === "mouse") return;
    depart.current = { x: e.clientX, y: e.clientY };
    horizontal.current = null;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!depart.current) return;
    const deltaX = e.clientX - depart.current.x;
    const deltaY = e.clientY - depart.current.y;

    if (horizontal.current === null) {
      // Sous quelques pixels, la direction ne veut encore rien dire.
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      horizontal.current =
        Math.abs(deltaX) > Math.abs(deltaY) * PENTE_MINIMALE;
      if (!horizontal.current) {
        depart.current = null;
        return;
      }
      // La capture peut être refusée si le pointeur a déjà disparu — un doigt
      // relevé hors de l'écran, par exemple. Le balayage marche sans, il
      // suit juste moins bien le pouce s'il sort de la carte.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* tant pis */
      }
      setGlisse(true);
    }

    // Seul le balayage vers l'intérieur découvre : l'autre sens referme.
    const avance = Math.max(0, vers(-deltaX));
    dxRef.current = avance;
    setDx(avance);
  }

  /** Remet la carte à une position donnée, état et ref d'un seul geste. */
  function poser(valeur: number) {
    dxRef.current = valeur;
    setDx(valeur);
  }

  function onPointerUp() {
    if (!depart.current || horizontal.current !== true) {
      depart.current = null;
      setGlisse(false);
      return;
    }
    depart.current = null;
    horizontal.current = null;
    setGlisse(false);

    const parcouru = dxRef.current;
    const largeur = conteneur.current?.offsetWidth ?? 0;
    if (largeur > 0 && parcouru > largeur * SEUIL_SUPPRESSION) {
      // Balayage franc : on efface, sans repasser par le bouton.
      poser(largeur);
      onSupprimer();
      return;
    }
    const reste = parcouru > SEUIL_OUVERTURE;
    setOuvert(reste);
    poser(reste ? SEUIL_OUVERTURE + 24 : 0);
  }

  const decouvert = actif && (decalage > 0 || ouvert);

  return (
    <div
      ref={conteneur}
      className="relative overflow-hidden rounded-3xl"
      // Le navigateur garde le défilement vertical ; nous prenons l'horizontal.
      style={{ touchAction: actif ? "pan-y" : undefined }}
    >
      {/* — La zone rouge, sous la carte —
            Pas d'`aria-hidden` dessus : il retirerait de l'arbre
            d'accessibilité le seul chemin qui ne demande pas un doigt sur un
            écran — et un élément focusable sous `aria-hidden` est de toute
            façon interdit. Le bouton reste annoncé et tabulable ; le focus
            ouvre la zone comme le ferait le pouce. */}
      {actif && (
        <div className="absolute inset-y-0 end-0 flex items-stretch">
          <button
            type="button"
            disabled={enCours}
            onClick={onSupprimer}
            aria-label={libelle}
            onFocus={() => {
              setOuvert(true);
              poser(SEUIL_OUVERTURE + 24);
            }}
            onBlur={() => {
              setOuvert(false);
              poser(0);
            }}
            className={cn(
              "flex w-24 flex-col items-center justify-center gap-1 bg-rouge px-3 text-white transition-opacity",
              "focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white",
              decouvert ? "opacity-100" : "opacity-0",
            )}
          >
            {enCours ? (
              <Loader2 aria-hidden className="size-5 animate-spin" />
            ) : (
              <Trash2 aria-hidden className="size-5" />
            )}
          </button>
        </div>
      )}

      {/* — La carte, poussée de côté — */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${rtl ? decalage : -decalage}px)`,
          // Pendant le geste, le doigt commande : aucune animation, sinon la
          // carte traîne derrière le pouce.
          transition: glisse ? undefined : "transform 180ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
