import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { envoyerEmail } from "@/lib/email";
import type { Database } from "@/lib/database.types";

/**
 * Le rappel quotidien : le premier rendez-vous de demain, envoyé avant 15 h.
 *
 * Déclenché par le cron Vercel (voir `vercel.json`, 14 h UTC = 15 h à Tunis).
 * Un seul e-mail par conseiller, et seulement s'il a un rendez-vous demain —
 * un message pour annoncer qu'il n'y a rien finit par ne plus être lu, et
 * emporte les vrais avec lui.
 *
 * Passe par la clé service : ce n'est personne qui appelle, c'est l'horloge.
 * D'où le jeton partagé ci-dessous — sans lui, l'URL serait un bouton
 * « envoyer des e-mails » ouvert sur Internet.
 */
export const dynamic = "force-dynamic";

interface RdvAvecConseiller {
  id: string;
  titre: string;
  type: string;
  debut: string;
  lieu: string | null;
  notes: string | null;
  conseiller_id: string;
  fiches_contact: { client_nom: string; tel_mobile: string | null } | null;
}

export async function GET(request: Request) {
  const attendu = process.env.CRON_SECRET;
  const fourni = request.headers.get("authorization");
  if (!attendu || fourni !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: "non_autorise" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    return NextResponse.json({ error: "supabase_absent" }, { status: 503 });
  }

  const supabase = createClient<Database>(url, service, {
    auth: { persistSession: false },
  });

  /*
   * « Demain » se calcule à l'heure de Tunis, pas à celle du serveur : la
   * fonction tourne à 14 h UTC, et un calcul en UTC désignerait le bon jour
   * par accident aujourd'hui et le mauvais au changement d'heure.
   */
  const maintenant = new Date();
  const tunis = new Date(
    maintenant.toLocaleString("en-US", { timeZone: "Africa/Tunis" }),
  );
  const debut = new Date(tunis);
  debut.setDate(debut.getDate() + 1);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);

  const { data: rdv, error } = await supabase
    .from("rendez_vous")
    .select(
      "id, titre, type, debut, lieu, notes, conseiller_id, fiches_contact(client_nom, tel_mobile)",
    )
    .gte("debut", debut.toISOString())
    .lt("debut", fin.toISOString())
    .order("debut", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rdv || rdv.length === 0) {
    return NextResponse.json({ envoyes: 0, raison: "aucun_rdv" });
  }

  // Trié par heure croissante : le premier vu pour un conseiller est le sien.
  const premierParConseiller = new Map<string, RdvAvecConseiller>();
  for (const r of rdv as unknown as RdvAvecConseiller[]) {
    if (!premierParConseiller.has(r.conseiller_id)) {
      premierParConseiller.set(r.conseiller_id, r);
    }
  }

  const { data: profilsBruts } = await supabase
    .from("profiles")
    .select("id, prenom, nom")
    .in("id", [...premierParConseiller.keys()]);
  const profils = (profilsBruts ?? []) as unknown as Array<{
    id: string;
    prenom: string;
    nom: string;
  }>;

  // L'e-mail vit dans auth.users, pas dans profiles.
  const { data: comptes } = await supabase.auth.admin.listUsers({
    perPage: 200,
  });
  const emailParId = new Map(
    (comptes?.users ?? []).flatMap((u) => (u.email ? [[u.id, u.email]] : [])),
  );

  const heure = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Tunis",
    hour: "2-digit",
    minute: "2-digit",
  });
  const jour = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Tunis",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let envoyes = 0;
  for (const [conseillerId, r] of premierParConseiller) {
    const destinataire = emailParId.get(conseillerId);
    if (!destinataire) continue;

    const profil = profils.find((p) => p.id === conseillerId);
    const client = r.fiches_contact?.client_nom ?? r.titre;
    const debutRdv = new Date(r.debut);

    const lignes = [
      `Bonjour ${profil?.prenom ?? ""},`.trim(),
      `Votre premier rendez-vous de demain, ${jour.format(debutRdv)} :`,
      [
        `${heure.format(debutRdv)} — ${client}`,
        r.fiches_contact?.tel_mobile
          ? `Téléphone : ${r.fiches_contact.tel_mobile}`
          : null,
        `Type : ${r.type}`,
        r.lieu ? `Lieu : ${r.lieu}` : null,
        r.notes ? `Détails : ${r.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      "Bonne journée,\nCUISINA",
    ];

    const ok = await envoyerEmail({
      to: destinataire,
      subject: `Demain ${heure.format(debutRdv)} — ${client}`,
      text: lignes.join("\n\n"),
    });
    if (ok) envoyes += 1;
  }

  return NextResponse.json({
    envoyes,
    conseillers: premierParConseiller.size,
  });
}
