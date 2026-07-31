/**
 * CUISINA CRM — seed script.
 *
 * Run with: npx tsx scripts/seed.ts  (or: npm run seed)
 *
 * Wipes previously-seeded data, then inserts: 9 points de vente, 10 auth
 * users + profiles, ~40 fiches contact, clients, historique, relances,
 * taches and rendez-vous — all with realistic Tunisian data.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

/* ================= env (.env.local, no dotenv) ================= */

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] ?? "";
    if (key === undefined) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "must be set (in .env.local or the environment).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ================= helpers ================= */

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function check(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** Deterministic PRNG so re-runs produce the same dataset. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260731);

function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pick<T>(arr: readonly T[]): T {
  const item = arr[Math.floor(rand() * arr.length)];
  if (item === undefined) throw new Error("pick() on empty array");
  return item;
}

const now = new Date();

/** ISO timestamp `days` days in the past, at a plausible working hour. */
function daysAgoIso(days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(randInt(9, 18), randInt(0, 59), 0, 0);
  return d.toISOString();
}

/** YYYY-MM-DD, `offsetDays` relative to today (negative = past). */
function dateOnly(offsetDays: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO timestamp `offsetDays` from today at a given local hour. */
function atHourIso(offsetDays: number, hour: number, minutes = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minutes, 0, 0);
  return d.toISOString();
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function tunisianMobile(): string {
  const prefix = pick(["98", "97", "96", "95", "94", "93", "92", "90", "55", "54", "53", "52", "50", "27", "26", "25", "24", "22", "21", "20"]);
  return `${prefix} ${randInt(100, 999)} ${randInt(100, 999)}`;
}

/* ================= domain types (mirror DB enums / exigencesSchema) ================= */

type Stage =
  | "nouveau_contact"
  | "contacte"
  | "rdv_showroom"
  | "metre_releve"
  | "conception_devis"
  | "devis_envoye"
  | "negociation"
  | "signe";
type StageOrPerdu = Stage | "perdu";
type MotifPerte = "prix" | "delai" | "concurrent" | "projet_annule" | "injoignable" | "autre";
type Origine = "bouche_a_oreille" | "site_web" | "foire" | "publicite";
type EtatChantier = "en_cours" | "fini";
type Canal = "whatsapp" | "appel" | "sms" | "email" | "visite";
type Priorite = "basse" | "normale" | "haute";
type TacheStatut = "a_faire" | "fait";
type RdvType = "showroom" | "metre" | "livraison" | "pose" | "interne";
type Role = "conseiller" | "chef_showroom" | "direction" | "admin";
type Encastrable = "encastrable" | "non_encastrable";
type RelanceResultat = "joint" | "message_laisse" | "injoignable" | "rdv_pris" | "a_rappeler";

const STAGE_ORDER: readonly Stage[] = [
  "nouveau_contact",
  "contacte",
  "rdv_showroom",
  "metre_releve",
  "conception_devis",
  "devis_envoye",
  "negociation",
  "signe",
];

/** Must match `exigencesSchema` in src/lib/schemas/fiche.ts exactly. */
interface FinitionFacade {
  type: "bois_massif" | "laque" | "pvc" | null;
  type_detail: string;
  caisson: string;
  decor_facade: string;
}
interface Electromenager {
  evier: "1_bac" | "2_bac" | null;
  plaque: "4F" | "5F" | "coin" | null;
  hotte: "60" | "90" | "coin" | "centrale" | null;
  four: Encastrable | null;
  four_taille: "60" | "90" | null;
  micro_onde: Encastrable | null;
  frigo: Encastrable | null;
  frigo_autres: string;
  lave_vaisselle: Encastrable | null;
  electro_autres: string;
}
interface DetailsCuisine {
  avec_retour: boolean | null;
  ilot_central: boolean | null;
  autres_details: string;
}
interface Exigences {
  finition_facade: FinitionFacade;
  electromenager: Electromenager;
  details_cuisine: DetailsCuisine;
}

function emptyExigences(): Exigences {
  return {
    finition_facade: { type: null, type_detail: "", caisson: "", decor_facade: "" },
    electromenager: {
      evier: null,
      plaque: null,
      hotte: null,
      four: null,
      four_taille: null,
      micro_onde: null,
      frigo: null,
      frigo_autres: "",
      lave_vaisselle: null,
      electro_autres: "",
    },
    details_cuisine: { avec_retour: null, ilot_central: null, autres_details: "" },
  };
}

function filledExigences(): Exigences {
  const type = pick(["bois_massif", "laque", "pvc"] as const);
  return {
    finition_facade: {
      type,
      type_detail:
        type === "laque"
          ? pick(["Laque brillante blanche", "Laque mate gris anthracite", "Laque satinée beige"])
          : type === "bois_massif"
            ? pick(["Chêne clair", "Noyer foncé", "Hêtre naturel"])
            : pick(["PVC effet bois", "PVC blanc brillant"]),
      caisson: pick(["MDF hydrofuge 18mm", "Aggloméré mélaminé blanc", "MDF laqué intérieur gris"]),
      decor_facade: pick(["Uni mat", "Effet bois naturel", "Brillant avec profil alu", "Cadre classique"]),
    },
    electromenager: {
      evier: pick(["1_bac", "2_bac"] as const),
      plaque: pick(["4F", "5F", "coin"] as const),
      hotte: pick(["60", "90", "coin", "centrale"] as const),
      four: pick(["encastrable", "non_encastrable"] as const),
      four_taille: pick(["60", "90"] as const),
      micro_onde: pick(["encastrable", "non_encastrable"] as const),
      frigo: pick(["encastrable", "non_encastrable"] as const),
      frigo_autres: pick(["", "", "Side by side prévu", "Frigo américain existant"]),
      lave_vaisselle: pick(["encastrable", "non_encastrable"] as const),
      electro_autres: pick(["", "", "Cave à vin souhaitée", "Machine à café encastrable"]),
    },
    details_cuisine: {
      avec_retour: rand() < 0.5,
      ilot_central: rand() < 0.4,
      autres_details: pick(["", "", "Prévoir coin petit-déjeuner", "Rangement coulissant pour épices", "Plan de travail en quartz"]),
    },
  };
}

/* ================= reference data ================= */

interface PdvSeed {
  nom: string;
  ville: string;
  adresse: string;
  telephone: string;
}

const PDV_SEED: readonly PdvSeed[] = [
  { nom: "Tunis", ville: "Tunis", adresse: "12 Avenue Habib Bourguiba, 1001 Tunis", telephone: "+216 71 340 122" },
  { nom: "La Marsa", ville: "La Marsa", adresse: "Avenue Taïeb Mhiri, Zone Commerciale, 2078 La Marsa", telephone: "+216 71 749 863" },
  { nom: "Soukra", ville: "La Soukra", adresse: "Route de Raoued km 4, 2036 La Soukra", telephone: "+216 70 683 254" },
  { nom: "Hammamet", ville: "Hammamet", adresse: "Avenue Dag Hammarskjöld, 8050 Hammamet", telephone: "+216 72 280 417" },
  { nom: "Nabeul", ville: "Nabeul", adresse: "Avenue Habib Thameur, 8000 Nabeul", telephone: "+216 72 224 981" },
  { nom: "Sousse", ville: "Sousse", adresse: "Avenue Léopold Sédar Senghor, Sahloul, 4054 Sousse", telephone: "+216 73 821 306" },
  { nom: "Djerba", ville: "Djerba", adresse: "Avenue Abdelhamid El Cadhi, Houmt Souk, 4180 Djerba", telephone: "+216 75 650 742" },
  { nom: "Sfax", ville: "Sfax", adresse: "Route de Tunis km 3, 3021 Sfax", telephone: "+216 74 405 289" },
  { nom: "Gabès", ville: "Gabès", adresse: "Avenue Farhat Hached, 6000 Gabès", telephone: "+216 75 271 634" },
];

const VILLES_PAR_PDV: Record<string, readonly string[]> = {
  Tunis: ["Tunis", "El Menzah", "Le Bardo", "Montplaisir"],
  "La Marsa": ["La Marsa", "Gammarth", "Carthage", "Sidi Bou Saïd"],
  Soukra: ["La Soukra", "Ariana", "Ennasr", "Borj Louzir"],
  Hammamet: ["Hammamet", "Yasmine Hammamet", "Bir Bouregba"],
  Nabeul: ["Nabeul", "Dar Chaabane", "Béni Khiar"],
  Sousse: ["Sousse", "Hammam Sousse", "Kantaoui", "Msaken"],
  Djerba: ["Houmt Souk", "Midoun", "Aghir"],
  Sfax: ["Sfax", "Sakiet Ezzit", "Route Gremda"],
  "Gabès": ["Gabès", "Chenini Nahal"],
};

interface UserSeed {
  prenom: string;
  nom: string;
  role: Role;
  pdvNom: string | null;
  email: string;
}

const USER_SEED: readonly UserSeed[] = [
  { prenom: "Ahmed", nom: "Ben Salah", role: "conseiller", pdvNom: "Tunis", email: "ahmed.bensalah@cuisina.tn" },
  { prenom: "Ines", nom: "Trabelsi", role: "conseiller", pdvNom: "La Marsa", email: "ines.trabelsi@cuisina.tn" },
  { prenom: "Mohamed", nom: "Gharbi", role: "conseiller", pdvNom: "Soukra", email: "mohamed.gharbi@cuisina.tn" },
  { prenom: "Sana", nom: "Mansouri", role: "conseiller", pdvNom: "Hammamet", email: "sana.mansouri@cuisina.tn" },
  { prenom: "Karim", nom: "Jlassi", role: "conseiller", pdvNom: "Nabeul", email: "karim.jlassi@cuisina.tn" },
  { prenom: "Rim", nom: "Bouazizi", role: "conseiller", pdvNom: "Sousse", email: "rim.bouazizi@cuisina.tn" },
  { prenom: "Walid", nom: "Hammami", role: "conseiller", pdvNom: "Sfax", email: "walid.hammami@cuisina.tn" },
  { prenom: "Amira", nom: "Chaabane", role: "conseiller", pdvNom: "Djerba", email: "amira.chaabane@cuisina.tn" },
  { prenom: "Leila", nom: "Ben Romdhane", role: "chef_showroom", pdvNom: "Tunis", email: "leila.benromdhane@cuisina.tn" },
  { prenom: "Nabil", nom: "Karoui", role: "direction", pdvNom: null, email: "direction@cuisina.tn" },
];

const CLIENT_NAMES: readonly string[] = [
  "Ali Ben Amor", "Fatma Sassi", "Hichem Baccouche", "Mariem Dridi", "Sami Ayari",
  "Nadia Khelifi", "Tarek Mzoughi", "Salma Ben Youssef", "Youssef Chatti", "Hela Gharsallah",
  "Anis Ferchichi", "Olfa Hamdi", "Riadh Toumi", "Imen Zouari", "Fares Belhadj",
  "Dorra Meddeb", "Bilel Saidi", "Asma Rekik", "Ghassen Abidi", "Sonia Maalej",
  "Mehdi Bouslama", "Rania Guesmi", "Nizar Cherif", "Wafa Jouini", "Adel Masmoudi",
  "Emna Kallel", "Slim Baklouti", "Nour Haddad", "Chokri Zribi", "Lamia Agrebi",
  "Hatem Sfar", "Syrine Ben Hassen", "Marwan Ghorbel", "Ahlem Njeh", "Zied Kacem",
  "Manel Aouadi", "Fedi Turki", "Rihab Selmi", "Kais Ellouze", "Ibtissem Bahri",
];

/** 40 stages: 5 nouveau, 5 contacte, 5 rdv, 5 metre, 5 conception, 4 devis, 3 nego, 5 signe, 3 perdu. */
const STAGE_PLAN: readonly StageOrPerdu[] = [
  "nouveau_contact", "contacte", "rdv_showroom", "metre_releve", "conception_devis",
  "devis_envoye", "negociation", "signe", "perdu", "nouveau_contact",
  "contacte", "rdv_showroom", "metre_releve", "conception_devis", "devis_envoye",
  "negociation", "signe", "perdu", "nouveau_contact", "contacte",
  "rdv_showroom", "metre_releve", "conception_devis", "devis_envoye", "negociation",
  "signe", "perdu", "nouveau_contact", "contacte", "rdv_showroom",
  "metre_releve", "conception_devis", "devis_envoye", "signe", "nouveau_contact",
  "contacte", "rdv_showroom", "metre_releve", "conception_devis", "signe",
];

const ORIGINE_DETAILS: Record<string, readonly string[]> = {
  bouche_a_oreille: ["prospection", "architecte_decorateur", "promoteur_entrepreneur", "ami"],
  publicite: ["spot_publicitaire", "magasine", "affiche_enseigne", "catalogue"],
};

const OBSERVATIONS: readonly string[] = [
  "Client très intéressé par un plan de travail en quartz, à recontacter rapidement.",
  "Souhaite finaliser avant le mariage de sa fille en septembre.",
  "Appartement neuf, livraison du chantier prévue le mois prochain.",
  "Compare avec un concurrent local, sensible au prix.",
  "A visité le showroom avec son architecte, projet haut de gamme.",
  "Préfère être contacté par WhatsApp en fin de journée.",
  "Rénovation complète : cuisine + dressing chambre parentale.",
  "Recommandé par un ancien client satisfait de Sousse.",
];

const RELANCE_COMMENTAIRES: readonly string[] = [
  "Client joint, toujours intéressé, rappel prévu la semaine prochaine.",
  "Message vocal laissé, pas de retour pour l'instant.",
  "Discussion sur le budget, attend la version révisée du devis.",
  "RDV showroom confirmé pour samedi matin.",
  "Numéro injoignable, réessayer en soirée.",
  "Échange WhatsApp : demande des photos de réalisations récentes.",
  "Client en déplacement, à rappeler début de mois.",
];

/* ================= main ================= */

interface PdvRow {
  id: string;
  nom: string;
}

interface ProfileSeeded extends UserSeed {
  id: string;
  pdvId: string | null;
}

interface FicheSpec {
  client_nom: string;
  stage: StageOrPerdu;
  /** For 'perdu' fiches: last real stage reached before losing the deal. */
  reachedStage: Stage;
  motif_perte: MotifPerte | null;
  conseiller: ProfileSeeded;
  pdvId: string;
  ville: string;
  tel_mobile: string;
  budget: number;
  created_at: string;
}

interface FicheRow {
  id: string;
  client_nom: string;
}

async function wipe(): Promise<void> {
  console.log("— Suppression des données existantes…");
  const tables = ["rendez_vous", "taches", "fiche_relances", "fiche_historique", "fiches_contact", "clients"] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq("id", NIL_UUID);
    check(error, `delete ${table}`);
  }

  const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  check(listError, "auth.admin.listUsers");
  const seeded = userList.users.filter((u) => (u.email ?? "").endsWith("@cuisina.tn"));
  for (const user of seeded) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    check(error, `auth.admin.deleteUser ${user.email ?? user.id}`);
  }
  console.log(`  ${seeded.length} utilisateur(s) auth @cuisina.tn supprimé(s)`);

  for (const table of ["profiles", "points_de_vente"] as const) {
    const { error } = await supabase.from(table).delete().neq("id", NIL_UUID);
    check(error, `delete ${table}`);
  }
  console.log("  Tables vidées.");
}

async function seedPointsDeVente(): Promise<PdvRow[]> {
  console.log("— Points de vente…");
  const { data, error } = await supabase
    .from("points_de_vente")
    .insert(PDV_SEED.map((p) => ({ ...p, actif: true })))
    .select("id, nom");
  check(error, "insert points_de_vente");
  const rows = (data ?? []) as PdvRow[];
  if (rows.length !== PDV_SEED.length) throw new Error("points_de_vente: unexpected row count");
  console.log(`  ${rows.length} points de vente créés.`);
  return rows;
}

async function seedUsers(pdvs: PdvRow[]): Promise<ProfileSeeded[]> {
  console.log("— Utilisateurs et profils…");
  const pdvByNom = new Map(pdvs.map((p) => [p.nom, p.id]));
  const profiles: ProfileSeeded[] = [];

  for (const user of USER_SEED) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: "cuisina2026",
      email_confirm: true,
      user_metadata: { prenom: user.prenom, nom: user.nom },
    });
    check(error, `auth.admin.createUser ${user.email}`);
    if (!data.user) throw new Error(`createUser ${user.email}: no user returned`);
    const pdvId = user.pdvNom ? (pdvByNom.get(user.pdvNom) ?? null) : null;
    profiles.push({ ...user, id: data.user.id, pdvId });
  }

  const { error: profileError } = await supabase.from("profiles").insert(
    profiles.map((p) => ({
      id: p.id,
      nom: p.nom,
      prenom: p.prenom,
      role: p.role,
      point_de_vente_id: p.pdvId,
      locale: "fr",
      objectif_mensuel: randInt(12, 24) * 5000, // 60 000 – 120 000 DT
      actif: true,
    })),
  );
  check(profileError, "insert profiles");
  console.log(`  ${profiles.length} utilisateurs créés (mot de passe : cuisina2026).`);
  return profiles;
}

function buildFicheSpecs(profiles: ProfileSeeded[]): FicheSpec[] {
  const conseillers = profiles.filter((p) => p.role === "conseiller");
  const specs: FicheSpec[] = [];

  for (let i = 0; i < CLIENT_NAMES.length; i++) {
    const client_nom = CLIENT_NAMES[i];
    const stage = STAGE_PLAN[i];
    if (client_nom === undefined || stage === undefined) continue;
    const conseiller = conseillers[i % conseillers.length];
    if (conseiller === undefined || conseiller.pdvId === null || conseiller.pdvNom === null) continue;

    const villes = VILLES_PAR_PDV[conseiller.pdvNom] ?? [conseiller.pdvNom];
    const stageIdx = stage === "perdu" ? 5 : STAGE_ORDER.indexOf(stage);
    // Older fiches for later stages, spread over the last 90 days.
    const ageDays = Math.min(90, stageIdx * 9 + randInt(2, 18));
    const reachedStage: Stage =
      stage === "perdu"
        ? pick(["contacte", "rdv_showroom", "conception_devis", "devis_envoye", "negociation"] as const)
        : stage;

    specs.push({
      client_nom,
      stage,
      reachedStage,
      motif_perte: stage === "perdu" ? pick(["prix", "concurrent", "injoignable", "delai", "projet_annule"] as const) : null,
      conseiller,
      pdvId: conseiller.pdvId,
      ville: pick(villes),
      tel_mobile: tunisianMobile(),
      budget: randInt(8, 65) * 1000 + pick([0, 0, 500]),
      created_at: daysAgoIso(ageDays),
    });
  }
  return specs;
}

async function seedFiches(specs: FicheSpec[]): Promise<Map<string, string>> {
  console.log("— Fiches contact…");
  const rows = specs.map((spec, i) => {
    const origine: Origine = pick(["bouche_a_oreille", "site_web", "foire", "publicite", "bouche_a_oreille", "publicite"] as const);
    const details = ORIGINE_DETAILS[origine];
    const origine_detail = details ? pick(details) : null;
    const filled = rand() < 0.63; // ~25 of 40 with detailed exigences
    const stageIdx = spec.stage === "perdu" ? STAGE_ORDER.indexOf(spec.reachedStage) : STAGE_ORDER.indexOf(spec.stage);
    const hasPrevue = stageIdx >= STAGE_ORDER.indexOf("conception_devis");
    const hasEffective = stageIdx >= STAGE_ORDER.indexOf("devis_envoye");
    const nb_cuisines = rand() < 0.9 ? 1 : 2;

    return {
      client_nom: spec.client_nom,
      tel_mobile: spec.tel_mobile,
      tel_domicile: rand() < 0.3 ? `71 ${randInt(200, 899)} ${randInt(100, 999)}` : null,
      email: rand() < 0.45 ? `${slugify(spec.client_nom)}@gmail.com` : null,
      adresse_complete: rand() < 0.5 ? `${randInt(2, 95)} ${pick(["Rue", "Avenue", "Résidence"])} ${pick(["Ibn Khaldoun", "de la Liberté", "El Yasmine", "Habib Bourguiba", "des Oliviers", "Carthage"])}, ${spec.ville}` : null,
      code_postal: rand() < 0.4 ? String(randInt(1000, 8999)) : null,
      ville: spec.ville,
      origine,
      origine_detail,
      nb_cuisines,
      nb_dressings: pick([0, 0, 1, 1, 2]),
      nb_sdb: pick([0, 0, 0, 1, 1]),
      etat_chantier: pick(["en_cours", "fini", null, "en_cours"] as const) as EtatChantier | null,
      budget_estimatif: spec.budget,
      date_livraison_souhaitee: rand() < 0.4 ? dateOnly(randInt(30, 120)) : null,
      observations: i % 3 === 0 ? pick(OBSERVATIONS) : null,
      exigences: filled ? filledExigences() : emptyExigences(),
      stage: spec.stage,
      motif_perte: spec.motif_perte,
      date_prevue_remise_devis: hasPrevue ? dateOnly(-randInt(3, 25)) : null,
      date_effective_remise_devis: hasEffective ? dateOnly(-randInt(1, 15)) : null,
      score_completude: filled ? randInt(60, 100) : randInt(30, 60),
      conseiller_id: spec.conseiller.id,
      point_de_vente_id: spec.pdvId,
      created_at: spec.created_at,
    };
  });

  const { data, error } = await supabase.from("fiches_contact").insert(rows).select("id, client_nom");
  check(error, "insert fiches_contact");
  const inserted = (data ?? []) as FicheRow[];
  if (inserted.length !== specs.length) throw new Error("fiches_contact: unexpected row count");
  console.log(`  ${inserted.length} fiches créées.`);
  return new Map(inserted.map((f) => [f.client_nom, f.id]));
}

async function seedClients(specs: FicheSpec[], ficheIds: Map<string, string>, pdvs: PdvRow[]): Promise<number> {
  console.log("— Clients (fiches signées + divers)…");
  let count = 0;

  for (const spec of specs.filter((s) => s.stage === "signe")) {
    const ficheId = ficheIds.get(spec.client_nom);
    if (!ficheId) continue;
    const { data, error } = await supabase
      .from("clients")
      .insert({
        nom: spec.client_nom,
        tel: spec.tel_mobile,
        ville: spec.ville,
        ca_cumule: spec.budget,
        nb_projets: 1,
        point_de_vente_id: spec.pdvId,
      })
      .select("id")
      .single();
    check(error, `insert client ${spec.client_nom}`);
    const clientRow = data as { id: string } | null;
    if (!clientRow) throw new Error(`insert client ${spec.client_nom}: no row returned`);

    const { error: linkError } = await supabase
      .from("fiches_contact")
      .update({ client_id: clientRow.id })
      .eq("id", ficheId);
    check(linkError, `link fiche ${spec.client_nom} to client`);
    count++;
  }

  const tunisPdv = pdvs.find((p) => p.nom === "Tunis");
  const soussePdv = pdvs.find((p) => p.nom === "Sousse");
  const extras = [
    { nom: "Mounir Beji", tel: tunisianMobile(), ville: "Tunis", ca_cumule: 42000, nb_projets: 2, point_de_vente_id: tunisPdv?.id ?? null },
    { nom: "Samia Louati", tel: tunisianMobile(), ville: "Sousse", ca_cumule: 27500, nb_projets: 1, point_de_vente_id: soussePdv?.id ?? null },
  ];
  const { error: extraError } = await supabase.from("clients").insert(extras);
  check(extraError, "insert extra clients");
  count += extras.length;
  console.log(`  ${count} clients créés.`);
  return count;
}

async function seedHistorique(specs: FicheSpec[], ficheIds: Map<string, string>): Promise<number> {
  console.log("— Historique des étapes…");
  interface HistoriqueRow {
    fiche_id: string;
    stage_from: StageOrPerdu | null;
    stage_to: StageOrPerdu;
    user_id: string;
    created_at: string;
  }
  const rows: HistoriqueRow[] = [];

  for (const spec of specs) {
    const ficheId = ficheIds.get(spec.client_nom);
    if (!ficheId) continue;
    const reachedIdx = STAGE_ORDER.indexOf(spec.reachedStage);
    const path: StageOrPerdu[] = STAGE_ORDER.slice(0, reachedIdx + 1);
    if (spec.stage === "perdu") path.push("perdu");

    const startMs = new Date(spec.created_at).getTime();
    const span = Math.max(now.getTime() - startMs - 3_600_000, 3_600_000);
    const step = span / (path.length + 1);

    for (let k = 0; k < path.length; k++) {
      const stageTo = path[k];
      if (stageTo === undefined) continue;
      rows.push({
        fiche_id: ficheId,
        stage_from: k === 0 ? null : (path[k - 1] ?? null),
        stage_to: stageTo,
        user_id: spec.conseiller.id,
        created_at: new Date(startMs + step * (k + 1)).toISOString(),
      });
    }
  }

  const { error } = await supabase.from("fiche_historique").insert(rows);
  check(error, "insert fiche_historique");
  console.log(`  ${rows.length} entrées d'historique.`);
  return rows.length;
}

async function seedRelances(specs: FicheSpec[], ficheIds: Map<string, string>): Promise<number> {
  console.log("— Relances…");
  const MID_STAGES: readonly StageOrPerdu[] = ["contacte", "rdv_showroom", "metre_releve", "conception_devis", "devis_envoye", "negociation"];
  const targets = specs.filter((s) => MID_STAGES.includes(s.stage)).slice(0, 15);

  interface RelanceRow {
    fiche_id: string;
    numero_contact: number;
    canal: Canal;
    resultat: RelanceResultat;
    commentaire: string | null;
    user_id: string;
    created_at: string;
  }
  const rows: RelanceRow[] = [];

  for (const spec of targets) {
    const ficheId = ficheIds.get(spec.client_nom);
    if (!ficheId) continue;
    const n = randInt(1, 3);
    const startMs = new Date(spec.created_at).getTime();
    const span = Math.max(now.getTime() - startMs - 3_600_000, 3_600_000);
    for (let numero = 1; numero <= n; numero++) {
      rows.push({
        fiche_id: ficheId,
        numero_contact: numero,
        canal: pick(["appel", "whatsapp", "visite"] as const),
        resultat: pick(["joint", "message_laisse", "injoignable", "rdv_pris", "a_rappeler"] as const),
        commentaire: rand() < 0.75 ? pick(RELANCE_COMMENTAIRES) : null,
        user_id: spec.conseiller.id,
        created_at: new Date(startMs + (span / (n + 1)) * numero).toISOString(),
      });
    }
  }

  const { error } = await supabase.from("fiche_relances").insert(rows);
  check(error, "insert fiche_relances");
  console.log(`  ${rows.length} relances sur ${targets.length} fiches.`);
  return rows.length;
}

async function seedTaches(specs: FicheSpec[], ficheIds: Map<string, string>, profiles: ProfileSeeded[]): Promise<number> {
  console.log("— Tâches…");
  const chef = profiles.find((p) => p.role === "chef_showroom");

  interface TacheRow {
    titre: string;
    description: string | null;
    echeance: string | null;
    priorite: Priorite;
    statut: TacheStatut;
    fiche_id: string | null;
    assigne_a: string;
    cree_par: string | null;
    auto_generee: boolean;
    canal: Canal | null;
  }
  const rows: TacheRow[] = [];
  const midSpecs = specs.filter((s) => s.stage !== "signe" && s.stage !== "perdu" && s.stage !== "nouveau_contact");

  // 7 overdue auto-generated relance tasks.
  for (const spec of midSpecs.slice(0, 7)) {
    rows.push({
      titre: `Relance ${spec.client_nom}`,
      description: "Relance automatique : aucun contact récent sur cette fiche.",
      echeance: dateOnly(-randInt(1, 10)),
      priorite: pick(["haute", "normale"] as const),
      statut: "a_faire",
      fiche_id: ficheIds.get(spec.client_nom) ?? null,
      assigne_a: spec.conseiller.id,
      cree_par: null,
      auto_generee: true,
      canal: pick(["appel", "whatsapp"] as const),
    });
  }

  // 4 due today.
  const todayTitles = [
    "Confirmer le RDV showroom de demain",
    "Envoyer le devis révisé par email",
    "Préparer le plan 3D pour la présentation",
    "Appeler le client pour le choix des façades",
  ];
  midSpecs.slice(7, 11).forEach((spec, i) => {
    rows.push({
      titre: todayTitles[i] ?? `Suivi ${spec.client_nom}`,
      description: `Fiche ${spec.client_nom} — ${spec.ville}.`,
      echeance: dateOnly(0),
      priorite: pick(["haute", "normale", "normale"] as const),
      statut: "a_faire",
      fiche_id: ficheIds.get(spec.client_nom) ?? null,
      assigne_a: spec.conseiller.id,
      cree_par: chef?.id ?? spec.conseiller.id,
      auto_generee: false,
      canal: null,
    });
  });

  // 4 this week.
  const weekTitles = [
    "Planifier le métré chez le client",
    "Relancer sur la validation du devis",
    "Vérifier la disponibilité de l'électroménager",
    "Envoyer le catalogue des finitions laquées",
  ];
  midSpecs.slice(11, 15).forEach((spec, i) => {
    rows.push({
      titre: weekTitles[i] ?? `Suivi ${spec.client_nom}`,
      description: null,
      echeance: dateOnly(randInt(1, 5)),
      priorite: pick(["normale", "basse", "haute"] as const),
      statut: "a_faire",
      fiche_id: ficheIds.get(spec.client_nom) ?? null,
      assigne_a: spec.conseiller.id,
      cree_par: spec.conseiller.id,
      auto_generee: false,
      canal: null,
    });
  });

  // 3 later.
  const laterTitles = [
    "Préparer le dossier de commande usine",
    "Mettre à jour le suivi mensuel du showroom",
    "Organiser la visite de l'appartement témoin",
  ];
  midSpecs.slice(15, 18).forEach((spec, i) => {
    rows.push({
      titre: laterTitles[i] ?? `Suivi ${spec.client_nom}`,
      description: null,
      echeance: dateOnly(randInt(7, 20)),
      priorite: "basse",
      statut: "a_faire",
      fiche_id: ficheIds.get(spec.client_nom) ?? null,
      assigne_a: spec.conseiller.id,
      cree_par: spec.conseiller.id,
      auto_generee: false,
      canal: null,
    });
  });

  // 2 completed tasks.
  const doneSpecs = specs.filter((s) => s.stage === "signe").slice(0, 2);
  const doneTitles = ["Envoyer le contrat signé à la direction", "Confirmer l'acompte reçu"];
  doneSpecs.forEach((spec, i) => {
    rows.push({
      titre: doneTitles[i] ?? `Suivi ${spec.client_nom}`,
      description: null,
      echeance: dateOnly(-randInt(2, 8)),
      priorite: "normale",
      statut: "fait",
      fiche_id: ficheIds.get(spec.client_nom) ?? null,
      assigne_a: spec.conseiller.id,
      cree_par: chef?.id ?? spec.conseiller.id,
      auto_generee: false,
      canal: null,
    });
  });

  const { error } = await supabase.from("taches").insert(rows);
  check(error, "insert taches");
  console.log(`  ${rows.length} tâches créées.`);
  return rows.length;
}

async function seedRendezVous(specs: FicheSpec[], ficheIds: Map<string, string>): Promise<number> {
  console.log("— Rendez-vous…");
  const ACTIVE_STAGES: readonly StageOrPerdu[] = ["rdv_showroom", "metre_releve", "conception_devis", "devis_envoye", "negociation", "signe"];
  const targets = specs.filter((s) => ACTIVE_STAGES.includes(s.stage)).slice(0, 10);

  interface RdvRow {
    titre: string;
    type: RdvType;
    debut: string;
    fin: string;
    fiche_id: string | null;
    conseiller_id: string;
    point_de_vente_id: string;
    lieu: string | null;
    notes: string | null;
  }
  const rows: RdvRow[] = [];
  // First 4 today, the rest spread over the next 7 days.
  const slots: ReadonlyArray<readonly [number, number]> = [
    [0, 9], [0, 11], [0, 14], [0, 16],
    [1, 10], [2, 15], [3, 9], [4, 14], [5, 11], [7, 10],
  ];

  targets.forEach((spec, i) => {
    const slot = slots[i] ?? ([randInt(1, 7), 10] as const);
    const [offset, hour] = slot;
    const type: RdvType =
      spec.stage === "metre_releve" ? "metre" : spec.stage === "signe" ? "livraison" : "showroom";
    const titre =
      type === "metre"
        ? `Métré chez ${spec.client_nom}`
        : type === "livraison"
          ? `Livraison cuisine — ${spec.client_nom}`
          : `RDV showroom — ${spec.client_nom}`;
    rows.push({
      titre,
      type,
      debut: atHourIso(offset, hour, pick([0, 30])),
      fin: atHourIso(offset, hour + (type === "metre" ? 2 : 1), 0),
      fiche_id: ficheIds.get(spec.client_nom) ?? null,
      conseiller_id: spec.conseiller.id,
      point_de_vente_id: spec.pdvId,
      lieu: type === "showroom" ? `Showroom ${spec.conseiller.pdvNom ?? ""}`.trim() : `${spec.ville} — domicile client`,
      notes: rand() < 0.4 ? "Prévoir le catalogue des finitions et la tablette de présentation." : null,
    });
  });

  const { error } = await supabase.from("rendez_vous").insert(rows);
  check(error, "insert rendez_vous");
  console.log(`  ${rows.length} rendez-vous créés (dont 4 aujourd'hui).`);
  return rows.length;
}

async function main(): Promise<void> {
  console.log(`CUISINA CRM — seed (${SUPABASE_URL})`);

  await wipe();
  const pdvs = await seedPointsDeVente();
  const profiles = await seedUsers(pdvs);
  const specs = buildFicheSpecs(profiles);
  const ficheIds = await seedFiches(specs);
  const clientCount = await seedClients(specs, ficheIds, pdvs);
  const historiqueCount = await seedHistorique(specs, ficheIds);
  const relanceCount = await seedRelances(specs, ficheIds);
  const tacheCount = await seedTaches(specs, ficheIds, profiles);
  const rdvCount = await seedRendezVous(specs, ficheIds);

  console.log("\n=== Résumé du seed ===");
  console.log(`  Points de vente : ${pdvs.length}`);
  console.log(`  Utilisateurs    : ${profiles.length} (mot de passe : cuisina2026)`);
  console.log(`  Fiches contact  : ${ficheIds.size}`);
  console.log(`  Clients         : ${clientCount}`);
  console.log(`  Historique      : ${historiqueCount}`);
  console.log(`  Relances        : ${relanceCount}`);
  console.log(`  Tâches          : ${tacheCount}`);
  console.log(`  Rendez-vous     : ${rdvCount}`);
  console.log("Seed terminé avec succès.");
}

main().catch((err: unknown) => {
  console.error("Seed échoué :", err instanceof Error ? err.message : err);
  process.exit(1);
});
