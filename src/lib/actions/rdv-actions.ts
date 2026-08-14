"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { getCurrentProfile } from "@/lib/auth";
import { RDV_TYPES } from "@/lib/domain";
import { tzHhmm, tzInstant } from "@/lib/tz";
import { type ActionResult, dbError, fail, succeed } from "./result";

/** Both agendas read the same table, so both have to be refreshed. */
function revalidateAgendas() {
  revalidatePath("/agenda-equipe");
  revalidatePath("/agenda-client");
  revalidatePath("/ma-journee");
}

const createSchema = z
  .object({
    titre: z.string().trim().min(1).max(200),
    type: z.enum(RDV_TYPES).default("showroom"),
    debut: z.string().datetime({ offset: true }),
    fin: z.string().datetime({ offset: true }),
    fiche_id: z.string().uuid().nullable().default(null),
    client_id: z.string().uuid().nullable().default(null),
    conseiller_id: z.string().uuid().nullable().default(null),
    point_de_vente_id: z.string().uuid().nullable().default(null),
    lieu: z.string().trim().max(200).default(""),
    notes: z.string().trim().max(1000).default(""),
  })
  .refine((v) => new Date(v.fin) > new Date(v.debut), {
    message: "fin_before_debut",
    path: ["fin"],
  });

export async function createRdv(input: unknown): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  // Every appointment belongs to a point of sale; fall back to the author's.
  const pdv = parsed.data.point_de_vente_id ?? profile.point_de_vente_id;
  if (!pdv) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase.from("rendez_vous").insert({
    titre: parsed.data.titre,
    type: parsed.data.type,
    debut: parsed.data.debut,
    fin: parsed.data.fin,
    fiche_id: parsed.data.fiche_id,
    client_id: parsed.data.client_id,
    conseiller_id: parsed.data.conseiller_id ?? profile.id,
    point_de_vente_id: pdv,
    lieu: parsed.data.lieu || null,
    notes: parsed.data.notes || null,
  });
  if (error) return fail(dbError(error));
  revalidateAgendas();
  return succeed(undefined);
}

const moveSchema = z.object({
  id: z.string().uuid(),
  /** Target calendar day; the time of day is preserved. */
  day: z.string().date(),
});

/**
 * Drops an appointment on another day, keeping its start time and duration —
 * what dragging a block across the calendar means.
 */
export async function moveRdv(input: unknown): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("rendez_vous")
    .select("debut, fin")
    .eq("id", parsed.data.id)
    .single();
  if (readError || !existing) return fail(dbError(readError));

  const debut = new Date(existing.debut);
  const fin = new Date(existing.fin);
  const duration = fin.getTime() - debut.getTime();

  // Le jour visé et l'heure conservée se lisent au showroom : le serveur, lui,
  // tourne en UTC, où un rendez-vous de fin de soirée tombe la veille.
  const nextDebut = tzInstant(parsed.data.day, tzHhmm(debut));

  const { error } = await supabase
    .from("rendez_vous")
    .update({
      debut: nextDebut.toISOString(),
      fin: new Date(nextDebut.getTime() + duration).toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));
  revalidateAgendas();
  return succeed(undefined);
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteRdv(input: unknown): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();
  const { error } = await supabase
    .from("rendez_vous")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));
  revalidateAgendas();
  return succeed(undefined);
}
