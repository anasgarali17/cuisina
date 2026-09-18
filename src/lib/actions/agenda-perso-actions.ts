"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { getCurrentProfile } from "@/lib/auth";
import { type ActionResult, dbError, fail, succeed } from "./result";

/**
 * L'agenda personnel : les rendez-vous qui n'appartiennent qu'à celui qui les
 * pose. Pas de fiche, pas de client, pas de showroom — sinon ils auraient
 * leur place dans « rendez_vous ».
 *
 * Le propriétaire n'est jamais lu depuis le formulaire : il vient de la
 * session. Le champ n'existe donc pas côté client, et la politique RLS de la
 * table refuserait de toute façon une ligne posée au nom d'un autre.
 */
const evenementSchema = z
  .object({
    id: z.string().uuid().nullable().default(null),
    titre: z.string().min(1, "titre_requis").max(200),
    /** Datetime-local, sans fuseau : « 2026-08-24T14:30 ». */
    debut: z.string().min(10).max(40),
    fin: z.string().min(10).max(40),
    notes: z.string().max(1000).default(""),
  })
  .refine((v) => new Date(v.fin) > new Date(v.debut), {
    message: "fin_avant_debut",
    path: ["fin"],
  });

export async function enregistrerEvenementPerso(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = evenementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "validation");
  }

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const { id, titre, debut, fin, notes } = parsed.data;
  const supabase = await createClient();

  const ligne = {
    titre: titre.trim(),
    debut: new Date(debut).toISOString(),
    fin: new Date(fin).toISOString(),
    notes: notes.trim() || null,
  };

  // La modification ne cite pas le propriétaire : la RLS borne déjà la ligne
  // à son auteur, et l'écrire ici laisserait croire qu'on pourrait la changer.
  const { data, error } = id
    ? await supabase
        .from("evenements_personnels")
        .update(ligne)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("evenements_personnels")
        .insert({ ...ligne, proprietaire_id: profile.id })
        .select("id")
        .single();

  if (error || !data) return fail(dbError(error));

  revalidatePath("/direction");
  revalidatePath("/mon-espace");
  return succeed({ id: data.id });
}

/**
 * Déplacer un événement d'un jour à l'autre, sans toucher à l'heure.
 *
 * C'est ce que fait un glisser-déposer sur la grille : on change le jour, on
 * garde le créneau. La durée suit, pour qu'un rendez-vous d'une heure reste
 * d'une heure après le déplacement.
 */
const deplacementSchema = z.object({
  id: z.string().uuid(),
  /** Le jour d'arrivée, « 2026-09-18 ». */
  jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation"),
});

export async function deplacerEvenementPerso(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = deplacementSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();

  // On relit la ligne pour conserver l'heure et la durée : le client n'envoie
  // que le jour, et recalculer à partir de ce qu'il aurait pu envoyer d'autre
  // reviendrait à lui faire confiance sur des données qu'il ne possède pas.
  const { data: actuel, error: lecture } = await supabase
    .from("evenements_personnels")
    .select("debut, fin")
    .eq("id", parsed.data.id)
    .single();
  if (lecture || !actuel) return fail(dbError(lecture));

  const debut = new Date(actuel.debut);
  const duree = new Date(actuel.fin).getTime() - debut.getTime();

  const [annee, mois, jour] = parsed.data.jour.split("-").map(Number);
  if (!annee || !mois || !jour) return fail("validation");
  const nouveauDebut = new Date(debut);
  nouveauDebut.setFullYear(annee, mois - 1, jour);

  const { error } = await supabase
    .from("evenements_personnels")
    .update({
      debut: nouveauDebut.toISOString(),
      fin: new Date(nouveauDebut.getTime() + duree).toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  revalidatePath("/direction");
  revalidatePath("/mon-espace");
  return succeed(undefined);
}

export async function supprimerEvenementPerso(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();
  const { error } = await supabase
    .from("evenements_personnels")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  revalidatePath("/direction");
  revalidatePath("/mon-espace");
  return succeed(undefined);
}
