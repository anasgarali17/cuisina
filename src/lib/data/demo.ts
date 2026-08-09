import type {
  ClientRow,
  FicheHistoriqueRow,
  FicheRelanceRow,
  FicheRow,
  PointDeVenteRow,
  ProfileRow,
  RendezVousRow,
  TacheRow,
} from "@/lib/database.types";
import { EXIGENCES_VIDES } from "@/lib/schemas/fiche";
import type { StageOrPerdu } from "@/lib/domain";

/**
 * In-memory dataset used while Supabase credentials are not configured.
 * Mirrors what scripts/seed.ts loads into the real database.
 */

const now = () => new Date();

function daysAgo(n: number, hour = 10): string {
  const d = now();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function daysAhead(n: number, hour = 10): string {
  const d = now();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

const pdvNames: Array<[string, string]> = [
  ["Cuisina Tunis", "Tunis"],
  ["Cuisina La Marsa", "La Marsa"],
  ["Cuisina Soukra", "Soukra"],
  ["Cuisina Hammamet", "Hammamet"],
  ["Cuisina Nabeul", "Nabeul"],
  ["Cuisina Sousse", "Sousse"],
  ["Cuisina Djerba", "Djerba"],
  ["Cuisina Sfax", "Sfax"],
  ["Cuisina Gabès", "Gabès"],
];

export const demoPdvs: PointDeVenteRow[] = pdvNames.map(([nom, ville], i) => ({
  id: `00000000-0000-4000-8000-00000000010${i}`,
  nom,
  ville,
  adresse: `Avenue Habib Bourguiba, ${ville}`,
  telephone: `+216 71 ${100 + i} ${200 + i}${i}`,
  actif: true,
  created_at: daysAgo(400),
}));

const conseillerDefs: Array<[string, string, number]> = [
  ["Ben Salah", "Amine", 0],
  ["Trabelsi", "Rym", 0],
  ["Gharbi", "Sami", 1],
  ["Bouazizi", "Ines", 2],
  ["Maalej", "Karim", 5],
  ["Chaabane", "Salma", 5],
  ["Jlassi", "Mehdi", 7],
  ["Ammar", "Nour", 3],
];

export const demoProfiles: ProfileRow[] = [
  ...conseillerDefs.map(([nom, prenom, pdv], i) => ({
    id: `00000000-0000-4000-8000-00000000020${i}`,
    nom,
    prenom,
    role: "conseiller" as const,
    point_de_vente_id: demoPdvs[pdv].id,
    locale: "fr" as const,
    objectif_mensuel: 80_000 + i * 5_000,
    avatar_url: null,
    actif: true,
    created_at: daysAgo(300),
  })),
  {
    id: "00000000-0000-4000-8000-000000000290",
    nom: "Haddad",
    prenom: "Leila",
    role: "chef_showroom",
    point_de_vente_id: demoPdvs[0].id,
    locale: "fr",
    objectif_mensuel: 0,
    avatar_url: null,
    actif: true,
    created_at: daysAgo(300),
  },
  {
    id: "00000000-0000-4000-8000-000000000299",
    nom: "Direction",
    prenom: "Cuisina",
    role: "direction",
    point_de_vente_id: null,
    locale: "fr",
    objectif_mensuel: 0,
    avatar_url: null,
    actif: true,
    created_at: daysAgo(300),
  },
];

/** The signed-in persona in demo mode. */
export const demoCurrentProfile: ProfileRow = demoProfiles[0];

interface FicheSeed {
  nom: string;
  ville: string;
  stage: StageOrPerdu;
  budget: number | null;
  cuisines: number;
  dressings: number;
  sdb: number;
  conseiller: number;
  age: number;
  score: number;
  origine: FicheRow["origine"];
  origineDetail?: string;
  motifPerte?: FicheRow["motif_perte"];
  devisPrevu?: number;
  devisEffectif?: number;
}

const ficheSeeds: FicheSeed[] = [
  { nom: "Mohamed Ben Romdhane", ville: "La Marsa", stage: "nouveau_contact", budget: 32000, cuisines: 1, dressings: 0, sdb: 0, conseiller: 0, age: 1, score: 45, origine: "site_web" },
  { nom: "Aïcha Belhadj", ville: "Carthage", stage: "nouveau_contact", budget: null, cuisines: 1, dressings: 1, sdb: 0, conseiller: 1, age: 2, score: 30, origine: "foire" },
  { nom: "Slim Karoui", ville: "Tunis", stage: "contacte", budget: 18500, cuisines: 1, dressings: 0, sdb: 0, conseiller: 0, age: 5, score: 62, origine: "bouche_a_oreille", origineDetail: "ami" },
  { nom: "Fatma Cherif", ville: "Le Bardo", stage: "contacte", budget: 24000, cuisines: 1, dressings: 0, sdb: 1, conseiller: 1, age: 8, score: 55, origine: "publicite", origineDetail: "affiche_enseigne" },
  { nom: "Youssef Mansouri", ville: "La Soukra", stage: "rdv_showroom", budget: 41000, cuisines: 1, dressings: 2, sdb: 1, conseiller: 2, age: 9, score: 78, origine: "site_web" },
  { nom: "Salwa Ben Amor", ville: "Ariana", stage: "rdv_showroom", budget: 27500, cuisines: 1, dressings: 0, sdb: 0, conseiller: 2, age: 12, score: 70, origine: "bouche_a_oreille", origineDetail: "architecte_decorateur" },
  { nom: "Hichem Baccouche", ville: "Hammamet", stage: "metre_releve", budget: 52000, cuisines: 1, dressings: 1, sdb: 2, conseiller: 3, age: 15, score: 85, origine: "publicite", origineDetail: "spot_publicitaire", devisPrevu: 4 },
  { nom: "Meriem Zouari", ville: "Nabeul", stage: "metre_releve", budget: 36000, cuisines: 1, dressings: 1, sdb: 0, conseiller: 3, age: 22, score: 80, origine: "foire", devisPrevu: -2 },
  { nom: "Tarek Sfar", ville: "Sousse", stage: "conception_devis", budget: 45000, cuisines: 1, dressings: 0, sdb: 1, conseiller: 4, age: 18, score: 90, origine: "bouche_a_oreille", origineDetail: "promoteur_entrepreneur", devisPrevu: 2 },
  { nom: "Leïla Kammoun", ville: "Monastir", stage: "conception_devis", budget: 29000, cuisines: 1, dressings: 1, sdb: 0, conseiller: 5, age: 14, score: 74, origine: "site_web", devisPrevu: 1 },
  { nom: "Nizar Ben Ayed", ville: "Sfax", stage: "devis_envoye", budget: 61000, cuisines: 2, dressings: 1, sdb: 1, conseiller: 6, age: 25, score: 95, origine: "bouche_a_oreille", origineDetail: "prospection", devisPrevu: -8, devisEffectif: -7 },
  { nom: "Rania Masmoudi", ville: "Sfax", stage: "devis_envoye", budget: 33500, cuisines: 1, dressings: 0, sdb: 0, conseiller: 6, age: 16, score: 82, origine: "publicite", origineDetail: "catalogue", devisPrevu: -6, devisEffectif: -6 },
  { nom: "Khaled Gargouri", ville: "Djerba", stage: "negociation", budget: 48500, cuisines: 1, dressings: 2, sdb: 1, conseiller: 6, age: 30, score: 88, origine: "foire", devisPrevu: -12, devisEffectif: -11 },
  { nom: "Sonia Mejri", ville: "Tunis", stage: "negociation", budget: 38000, cuisines: 1, dressings: 1, sdb: 0, conseiller: 0, age: 28, score: 92, origine: "site_web", devisPrevu: -10, devisEffectif: -9 },
  { nom: "Walid Chatti", ville: "La Marsa", stage: "signe", budget: 54000, cuisines: 1, dressings: 1, sdb: 1, conseiller: 0, age: 40, score: 100, origine: "bouche_a_oreille", origineDetail: "ami", devisPrevu: -30, devisEffectif: -28 },
  { nom: "Amel Dridi", ville: "Gammarth", stage: "signe", budget: 47000, cuisines: 1, dressings: 0, sdb: 1, conseiller: 1, age: 35, score: 96, origine: "publicite", origineDetail: "magasine", devisPrevu: -25, devisEffectif: -24 },
  { nom: "Bassem Ayari", ville: "Sousse", stage: "signe", budget: 25500, cuisines: 1, dressings: 0, sdb: 0, conseiller: 4, age: 20, score: 90, origine: "foire", devisPrevu: -14, devisEffectif: -12 },
  { nom: "Imen Sassi", ville: "Hammamet", stage: "perdu", budget: 22000, cuisines: 1, dressings: 0, sdb: 0, conseiller: 3, age: 45, score: 68, origine: "site_web", motifPerte: "prix" },
  { nom: "Anis Bouslimi", ville: "Nabeul", stage: "perdu", budget: 31000, cuisines: 1, dressings: 1, sdb: 0, conseiller: 3, age: 50, score: 74, origine: "bouche_a_oreille", origineDetail: "prospection", motifPerte: "concurrent" },
  { nom: "Hela Ben Youssef", ville: "Tunis", stage: "contacte", budget: 15500, cuisines: 0, dressings: 1, sdb: 0, conseiller: 0, age: 4, score: 40, origine: "publicite", origineDetail: "affiche_enseigne" },
];

export const demoFiches: FicheRow[] = ficheSeeds.map((s, i) => {
  const conseiller = demoProfiles[s.conseiller];
  return {
    id: `00000000-0000-4000-8000-0000000003${String(i).padStart(2, "0")}`,
    reference: `FC-2026-${String(120 + i).padStart(4, "0")}`,
    client_nom: s.nom,
    tel_domicile: i % 3 === 0 ? `71 ${400 + i} ${300 + i}` : null,
    tel_bureau: null,
    tel_mobile: `98 ${100 + i * 7} ${200 + i * 3}`,
    email: i % 2 === 0 ? `${s.nom.toLowerCase().replace(/[^a-z]+/g, ".")}@gmail.com` : null,
    adresse_complete: `${10 + i} rue des Jasmins, ${s.ville}`,
    code_postal: `${2000 + i * 10}`,
    ville: s.ville,
    origine: s.origine,
    origine_detail: s.origineDetail ?? null,
    nb_cuisines: s.cuisines,
    nb_dressings: s.dressings,
    nb_sdb: s.sdb,
    etat_chantier: i % 2 === 0 ? "en_cours" : "fini",
    budget_estimatif: s.budget,
    date_livraison_souhaitee: dateOnly(daysAhead(60 + i * 5)),
    observations:
      i % 4 === 0
        ? "Client pressé, chantier en finition. Préfère être appelé après 17h."
        : null,
    exigences:
      s.score >= 70
        ? {
            finition_facade: {
              type: i % 2 === 0 ? "laque" : "bois_massif",
              type_detail: i % 2 === 0 ? "Laqué mat blanc cassé" : "Chêne clair",
              caisson: "Hydrofuge blanc",
              decor_facade: "Poignées intégrées",
            },
            electromenager: {
              evier: "2_bac",
              plaque: "4F",
              hotte: "90",
              four: "encastrable",
              four_taille: "60",
              micro_onde: "encastrable",
              frigo: i % 2 === 0 ? "encastrable" : "non_encastrable",
              frigo_autres: "",
              lave_vaisselle: "encastrable",
              electro_autres: "",
            },
            details_cuisine: {
              avec_retour: i % 2 === 0,
              ilot_central: i % 3 === 0,
              autres_details: "",
            },
          }
        : (EXIGENCES_VIDES as unknown as FicheRow["exigences"]),
    stage: s.stage,
    motif_perte: s.motifPerte ?? null,
    motif_perte_libre: null,
    motif_pause: null,
    motif_pause_detail: null,
    pause_cadence_jours: null,
    pause_reprise_le: null,
    date_prevue_remise_devis:
      s.devisPrevu != null ? dateOnly(daysAhead(s.devisPrevu)) : null,
    date_effective_remise_devis:
      s.devisEffectif != null ? dateOnly(daysAhead(s.devisEffectif)) : null,
    date_prete_devis: null,
    remarques_client: null,
    score_completude: s.score,
    photo_fiche_url: null,
    croquis: null,
    conseiller_id: conseiller.id,
    point_de_vente_id: conseiller.point_de_vente_id ?? demoPdvs[0].id,
    client_id: null,
    created_at: daysAgo(s.age),
    updated_at: daysAgo(Math.max(0, s.age - 3)),
  };
});

export const demoClients: ClientRow[] = demoFiches
  .filter((f) => f.stage === "signe")
  .map((f, i) => ({
    id: `00000000-0000-4000-8000-0000000004${String(i).padStart(2, "0")}`,
    nom: f.client_nom,
    tel: f.tel_mobile,
    email: f.email,
    adresse: f.adresse_complete,
    ville: f.ville,
    ca_cumule: f.budget_estimatif ?? 0,
    nb_projets: 1,
    point_de_vente_id: f.point_de_vente_id,
    created_at: f.updated_at,
  }));

demoFiches.forEach((f) => {
  const client = demoClients.find((c) => c.nom === f.client_nom);
  if (client) f.client_id = client.id;
});

const STAGE_ORDER: StageOrPerdu[] = [
  "nouveau_contact",
  "contacte",
  "rdv_showroom",
  "metre_releve",
  "conception_devis",
  "devis_envoye",
  "negociation",
  "signe",
];

export const demoHistorique: FicheHistoriqueRow[] = demoFiches.flatMap((f) => {
  const target =
    f.stage === "perdu" ? 2 : STAGE_ORDER.indexOf(f.stage as StageOrPerdu);
  const steps: FicheHistoriqueRow[] = [];
  const ageDays = Math.max(
    1,
    Math.round((Date.now() - new Date(f.created_at).getTime()) / 86_400_000),
  );
  for (let i = 1; i <= target; i++) {
    steps.push({
      id: `${f.id.slice(0, -4)}h${String(i).padStart(3, "0")}`,
      fiche_id: f.id,
      stage_from: STAGE_ORDER[i - 1],
      stage_to: STAGE_ORDER[i],
      user_id: f.conseiller_id,
      created_at: daysAgo(Math.max(0, ageDays - i * 3)),
    });
  }
  if (f.stage === "perdu") {
    steps.push({
      id: `${f.id.slice(0, -4)}hper`,
      fiche_id: f.id,
      stage_from: STAGE_ORDER[target],
      stage_to: "perdu",
      user_id: f.conseiller_id,
      created_at: daysAgo(Math.max(0, ageDays - 12)),
    });
  }
  return steps;
});

export const demoRelances: FicheRelanceRow[] = demoFiches
  .filter((f) => ["contacte", "devis_envoye", "negociation"].includes(f.stage))
  .flatMap((f, i) => {
    const count = (i % 2) + 1;
    return Array.from({ length: count }, (_, n) => ({
      id: `${f.id.slice(0, -4)}r${String(n).padStart(3, "0")}`,
      fiche_id: f.id,
      numero_contact: n + 1,
      canal: (n === 0 ? "appel" : "whatsapp") as FicheRelanceRow["canal"],
      resultat: n === 0 ? "joint" : "message_laisse",
      commentaire: n === 0 ? "Client intéressé, rappeler la semaine prochaine." : null,
      user_id: f.conseiller_id,
      created_at: daysAgo(3 + n * 4),
    }));
  });

export const demoTaches: TacheRow[] = [
  ...demoFiches
    .filter((f) => ["contacte", "devis_envoye"].includes(f.stage))
    .slice(0, 6)
    .map((f, i) => ({
      id: `00000000-0000-4000-8000-0000000005${String(i).padStart(2, "0")}`,
      titre: `Relance ${f.client_nom}`,
      description: null,
      echeance: dateOnly(i < 3 ? daysAgo(2 + i) : daysAhead(i - 2)),
      priorite: (i < 3 ? "haute" : "normale") as TacheRow["priorite"],
      statut: "a_faire" as const,
      fiche_id: f.id,
      assigne_a: f.conseiller_id,
      cree_par: null,
      auto_generee: true,
      canal: (i % 2 === 0 ? "appel" : "whatsapp") as TacheRow["canal"],
      created_at: daysAgo(6),
    })),
  {
    id: "00000000-0000-4000-8000-000000000590",
    titre: "Préparer le showroom pour la promo d'août",
    description: "Vitrophanie + nouvel îlot d'exposition",
    echeance: dateOnly(daysAhead(0)),
    priorite: "normale",
    statut: "a_faire",
    fiche_id: null,
    assigne_a: demoCurrentProfile.id,
    cree_par: demoCurrentProfile.id,
    auto_generee: false,
    canal: null,
    created_at: daysAgo(3),
  },
  {
    id: "00000000-0000-4000-8000-000000000591",
    titre: "Commander les échantillons laqué mat",
    description: null,
    echeance: dateOnly(daysAhead(4)),
    priorite: "basse",
    statut: "a_faire",
    fiche_id: null,
    assigne_a: demoCurrentProfile.id,
    cree_par: demoCurrentProfile.id,
    auto_generee: false,
    canal: null,
    created_at: daysAgo(1),
  },
];

export const demoRdv: RendezVousRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000600",
    titre: "RDV showroom — Mohamed Ben Romdhane",
    type: "showroom",
    debut: daysAhead(0, 10),
    fin: daysAhead(0, 11),
    fiche_id: demoFiches[0].id,
    client_id: null,
    conseiller_id: demoCurrentProfile.id,
    point_de_vente_id: demoPdvs[0].id,
    lieu: "Showroom Tunis",
    notes: null,
    created_at: daysAgo(2),
  },
  {
    id: "00000000-0000-4000-8000-000000000601",
    titre: "Métré — Youssef Mansouri",
    type: "metre",
    debut: daysAhead(0, 15),
    fin: daysAhead(0, 16),
    fiche_id: demoFiches[4].id,
    client_id: null,
    conseiller_id: demoCurrentProfile.id,
    point_de_vente_id: demoPdvs[0].id,
    lieu: "La Soukra",
    notes: "Prendre le laser et les catalogues laqué.",
    created_at: daysAgo(1),
  },
  {
    id: "00000000-0000-4000-8000-000000000602",
    titre: "Livraison — Walid Chatti",
    type: "livraison",
    debut: daysAhead(2, 9),
    fin: daysAhead(2, 12),
    fiche_id: demoFiches[14].id,
    client_id: demoFiches[14].client_id,
    conseiller_id: demoCurrentProfile.id,
    point_de_vente_id: demoPdvs[0].id,
    lieu: "La Marsa",
    notes: null,
    created_at: daysAgo(5),
  },
];
