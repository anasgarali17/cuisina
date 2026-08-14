"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { getCurrentProfile } from "@/lib/auth";
import { computeScoreCompletude, EXIGENCES_VIDES } from "@/lib/schemas/fiche";
import {
  createLienSchema,
  decisionSchema,
  submitPublicSchema,
  toggleLienSchema,
} from "@/lib/schemas/lien";
import { toISODate } from "@/lib/dates";
import { type ActionResult, dbError, fail, succeed } from "./result";

/**
 * Alphabet sans caractères jumeaux (0/O, 1/I/l) : le token finit parfois
 * recopié à la main depuis une affiche, pas seulement scanné.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newToken(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

/* — Côté CRM : fabriquer et piloter les liens — */

export async function createLien(
  input: unknown,
): Promise<ActionResult<{ id: string; token: string }>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = createLienSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiche_liens")
    .insert({ ...parsed.data, token: newToken(), cree_par: profile.id })
    .select("id, token")
    .single();
  if (error || !data) return fail(dbError(error));

  revalidatePath("/fiches");
  return succeed({ id: data.id, token: data.token });
}

export async function toggleLien(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = toggleLienSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("fiche_liens")
    .update({ actif: parsed.data.actif })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  revalidatePath("/fiches");
  return succeed(undefined);
}

/* — Côté client : le formulaire public — */

/**
 * Dépose une demande depuis /f/{token}. Aucune session : tout passe par la
 * fonction `soumettre_fiche`, qui n'écrit que dans fiche_submissions. Une
 * demande n'est pas une fiche — elle attend son verdict.
 */
export async function submitFichePublique(
  input: unknown,
): Promise<ActionResult<{ reference: string }>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = submitPublicSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const { token, payload } = parsed.data;
  const score = computeScoreCompletude({
    identite: payload.identite,
    origine: payload.origine,
    projet: payload.projet,
    exigences: EXIGENCES_VIDES,
    // Le formulaire public ne recueille pas de signature : elle se pose au
    // showroom, plan sous les yeux. Le modèle et les coloris, eux, comptent
    // dans la complétude — c'est ce que le client est venu dire.
    signature: null,
    modele: payload.souhaits.modele,
    couleurs: payload.souhaits.couleurs,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soumettre_fiche", {
    p_token: token,
    p_payload: {
      ...payload.identite,
      ...payload.origine,
      ...payload.projet,
      point_de_vente_id: payload.point_de_vente_id,
      // À plat plutôt qu'imbriqué : la fonction Postgres lit `p_payload->>…`
      // clé par clé, et n'a pas à connaître la forme du formulaire.
      type_projet: payload.souhaits.type_projet,
      modele: payload.souhaits.modele,
      facade: payload.souhaits.facade,
      couleurs: payload.souhaits.couleurs,
      croquis_client: payload.souhaits.croquis,
      photos: payload.souhaits.photos,
      commentaire_client: payload.souhaits.commentaire,
      exigences: EXIGENCES_VIDES,
      score_completude: score,
    },
  });
  if (error) return fail(dbError(error));

  const result = data as { ok: boolean; error?: string; reference?: string };
  if (!result?.ok || !result.reference) {
    return fail(result?.error ?? "db");
  }

  revalidatePath("/fiches");
  return succeed({ reference: result.reference });
}

/* — Côté direction : le verdict — */

const ACCEPTE = "accepte";

/**
 * Accepter, refuser ou laisser en attente. L'acceptation est le seul chemin
 * qui crée une vraie fiche : elle entre au pipeline en « nouveau contact »,
 * avec un rappel programmé pour demain — un lead arrivé par QR code sans
 * personne pour le rappeler est un lead déjà perdu.
 */
export async function decideSubmission(
  input: unknown,
): Promise<ActionResult<{ fiche_id: string | null }>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const { submission_id, statut, note, conseiller_id } = parsed.data;
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("fiche_submissions")
    .select("*")
    .eq("id", submission_id)
    .single();
  if (!submission) return fail("not_found");

  let ficheId: string | null = submission.fiche_id;

  // Une demande déjà acceptée garde sa fiche : on ne duplique pas le lead
  // si la direction rouvre puis ré-accepte la demande.
  if (statut === ACCEPTE && !ficheId) {
    const assigne = conseiller_id ?? submission.conseiller_id;
    const { data: fiche, error: ficheError } = await supabase
      .from("fiches_contact")
      .insert({
        client_nom: submission.client_nom,
        tel_domicile: submission.tel_domicile,
        tel_bureau: submission.tel_bureau,
        tel_mobile: submission.tel_mobile,
        email: submission.email,
        adresse_complete: submission.adresse_complete,
        ville: submission.ville,
        origine: submission.origine,
        origine_detail: submission.origine_detail,
        nb_cuisines: submission.nb_cuisines,
        nb_dressings: submission.nb_dressings,
        date_livraison_souhaitee: submission.date_livraison_souhaitee,
        exigences: submission.exigences,
        // Ce que le client a choisi lui-même suit la fiche : sans quoi il
        // aurait décrit son projet pour rien, et le conseiller redemanderait
        // au rendez-vous ce qui était déjà écrit.
        type_projet: submission.type_projet,
        modele: submission.modele,
        facade: submission.facade,
        couleurs: submission.couleurs,
        croquis_client: submission.croquis_client,
        photos_client: submission.photos,
        commentaire_client: submission.commentaire_client,
        score_completude: submission.score_completude,
        conseiller_id: assigne,
        point_de_vente_id: submission.point_de_vente_id,
      })
      .select("id")
      .single();
    if (ficheError || !fiche) return fail(dbError(ficheError));
    ficheId = fiche.id;

    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    await supabase.from("taches").insert({
      titre: `Rappeler ${submission.client_nom}`,
      description: `Demande reçue en ligne · ${submission.reference}`,
      echeance: toISODate(demain),
      priorite: "haute" as const,
      fiche_id: fiche.id,
      assigne_a: assigne,
      cree_par: profile.id,
      auto_generee: true,
      canal: "appel" as const,
    });
  }

  const { error } = await supabase
    .from("fiche_submissions")
    .update({
      statut,
      decision_note: note.trim() || null,
      decide_par: profile.id,
      decide_le: new Date().toISOString(),
      fiche_id: ficheId,
      ...(conseiller_id ? { conseiller_id } : {}),
    })
    .eq("id", submission_id);
  if (error) return fail(dbError(error));

  revalidatePath("/fiches");
  revalidatePath("/etat-dossier");
  revalidatePath("/taches");
  revalidatePath("/ma-journee");
  return succeed({ fiche_id: ficheId });
}

const deleteSubmissionSchema = z.object({ id: z.string().uuid() });

export async function deleteSubmission(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = deleteSubmissionSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("fiche_submissions")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  revalidatePath("/fiches");
  return succeed(undefined);
}
