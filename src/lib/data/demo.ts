import type {
  ClientActifRow,
  ClientRow,
  FicheHistoriqueRow,
  FicheRelanceRow,
  FicheRow,
  FournisseurRow,
  MessageEnvoyeRow,
  ModeleMessageRow,
  PointDeVenteRow,
  ProfileRow,
  RendezVousRow,
  SequenceEtapeRow,
  SequenceRow,
  TacheRow,
} from "@/lib/database.types";
import { EXIGENCES_VIDES } from "@/lib/schemas/fiche";
import { ETAPES_PRODUCTION, STAGES, type StageOrPerdu } from "@/lib/domain";

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
  { nom: "Mohamed Ben Romdhane", ville: "La Marsa", stage: "nouveau_lead", budget: 32000, cuisines: 1, dressings: 0, conseiller: 0, age: 1, score: 45, origine: "site_web" },
  { nom: "Aïcha Belhadj", ville: "Carthage", stage: "nouveau_lead", budget: null, cuisines: 1, dressings: 1, conseiller: 1, age: 2, score: 30, origine: "foire" },
  { nom: "Slim Karoui", ville: "Tunis", stage: "releve_preliminaire", budget: 18500, cuisines: 1, dressings: 0, conseiller: 0, age: 5, score: 62, origine: "bouche_a_oreille", origineDetail: "ami" },
  { nom: "Fatma Cherif", ville: "Le Bardo", stage: "releve_preliminaire", budget: 24000, cuisines: 1, dressings: 0, conseiller: 1, age: 8, score: 55, origine: "publicite", origineDetail: "instagram" },
  { nom: "Youssef Mansouri", ville: "La Soukra", stage: "rdv_showroom", budget: 41000, cuisines: 1, dressings: 2, conseiller: 2, age: 9, score: 78, origine: "site_web" },
  { nom: "Salwa Ben Amor", ville: "Ariana", stage: "rdv_showroom", budget: 27500, cuisines: 1, dressings: 0, conseiller: 2, age: 12, score: 70, origine: "bouche_a_oreille", origineDetail: "architecte_decorateur" },
  { nom: "Hichem Baccouche", ville: "Hammamet", stage: "releve_preliminaire", budget: 52000, cuisines: 1, dressings: 1, conseiller: 3, age: 15, score: 85, origine: "publicite", origineDetail: "facebook", devisPrevu: 4 },
  { nom: "Meriem Zouari", ville: "Nabeul", stage: "releve_preliminaire", budget: 36000, cuisines: 1, dressings: 1, conseiller: 3, age: 22, score: 80, origine: "foire", devisPrevu: -2 },
  { nom: "Tarek Sfar", ville: "Sousse", stage: "conception_devis", budget: 45000, cuisines: 1, dressings: 0, conseiller: 4, age: 18, score: 90, origine: "bouche_a_oreille", origineDetail: "promoteur_entrepreneur", devisPrevu: 2 },
  { nom: "Leïla Kammoun", ville: "Monastir", stage: "conception_devis", budget: 29000, cuisines: 1, dressings: 1, conseiller: 5, age: 14, score: 74, origine: "site_web", devisPrevu: 1 },
  { nom: "Nizar Ben Ayed", ville: "Sfax", stage: "conception_devis", budget: 61000, cuisines: 2, dressings: 1, conseiller: 6, age: 25, score: 95, origine: "bouche_a_oreille", origineDetail: "prospection", devisPrevu: -8, devisEffectif: -7 },
  { nom: "Rania Masmoudi", ville: "Sfax", stage: "conception_devis", budget: 33500, cuisines: 1, dressings: 0, conseiller: 6, age: 16, score: 82, origine: "publicite", origineDetail: "tiktok", devisPrevu: -6, devisEffectif: -6 },
  { nom: "Khaled Gargouri", ville: "Djerba", stage: "cloture", budget: 48500, cuisines: 1, dressings: 2, conseiller: 6, age: 30, score: 88, origine: "foire", devisPrevu: -12, devisEffectif: -11 },
  { nom: "Sonia Mejri", ville: "Tunis", stage: "cloture", budget: 38000, cuisines: 1, dressings: 1, conseiller: 0, age: 28, score: 92, origine: "site_web", devisPrevu: -10, devisEffectif: -9 },
  { nom: "Walid Chatti", ville: "La Marsa", stage: "signe", budget: 54000, cuisines: 1, dressings: 1, conseiller: 0, age: 40, score: 100, origine: "bouche_a_oreille", origineDetail: "ami", devisPrevu: -30, devisEffectif: -28 },
  { nom: "Amel Dridi", ville: "Gammarth", stage: "signe", budget: 47000, cuisines: 1, dressings: 0, conseiller: 1, age: 35, score: 96, origine: "publicite", origineDetail: "instagram", devisPrevu: -25, devisEffectif: -24 },
  { nom: "Bassem Ayari", ville: "Sousse", stage: "releve_definitif", budget: 25500, cuisines: 1, dressings: 0, conseiller: 4, age: 20, score: 90, origine: "foire", devisPrevu: -14, devisEffectif: -12 },
  { nom: "Nadia Trabelsi", ville: "Ariana", stage: "releve_definitif", budget: 43000, cuisines: 1, dressings: 1, conseiller: 2, age: 38, score: 94, origine: "site_web", devisPrevu: -22, devisEffectif: -21 },
  { nom: "Ridha Jlassi", ville: "Tunis", stage: "dossier_envoye", budget: 58000, cuisines: 1, dressings: 2, conseiller: 0, age: 52, score: 100, origine: "bouche_a_oreille", origineDetail: "architecte_decorateur", devisPrevu: -40, devisEffectif: -38 },
  { nom: "Sarra Hamdi", ville: "Sfax", stage: "dossier_envoye", budget: 36500, cuisines: 1, dressings: 0, conseiller: 6, age: 47, score: 98, origine: "foire", devisPrevu: -33, devisEffectif: -32 },
  { nom: "Imen Sassi", ville: "Hammamet", stage: "perdu", budget: 22000, cuisines: 1, dressings: 0, conseiller: 3, age: 45, score: 68, origine: "site_web", motifPerte: "prix" },
  { nom: "Anis Bouslimi", ville: "Nabeul", stage: "perdu", budget: 31000, cuisines: 1, dressings: 1, conseiller: 3, age: 50, score: 74, origine: "bouche_a_oreille", origineDetail: "prospection", motifPerte: "concurrent" },
  { nom: "Hela Ben Youssef", ville: "Tunis", stage: "releve_preliminaire", budget: 15500, cuisines: 0, dressings: 1, conseiller: 0, age: 4, score: 40, origine: "publicite", origineDetail: "instagram" },
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
    whatsapp: i % 2 === 0,
    signature: null,
    signature_le: null,
    // Ce qu'une fiche née d'une demande en ligne porte : une fiche sur trois
    // ici, pour que l'écran montre les deux cas.
    type_projet: i % 3 === 0 ? "cuisine" : null,
    modele: i % 3 === 0 ? "roma" : null,
    facade: i % 3 === 0 ? "laque_mat" : null,
    couleurs: i % 3 === 0 ? ["gris_perle", "blanc_pur"] : [],
    croquis_client: null,
    photos_client: [],
    commentaire_client:
      i % 3 === 0 ? "Souhaite garder l'emplacement actuel de l'évier." : null,
    email: i % 2 === 0 ? `${s.nom.toLowerCase().replace(/[^a-z]+/g, ".")}@gmail.com` : null,
    adresse_complete: `${10 + i} rue des Jasmins, ${s.ville}`,
    code_postal: `${2000 + i * 10}`,
    ville: s.ville,
    origine: s.origine,
    origine_detail: s.origineDetail ?? null,
    nb_cuisines: s.cuisines,
    nb_dressings: s.dressings,
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
    // Un VIP sur trois en démo : de quoi voir le filtre faire son travail.
    vip: i % 3 === 0,
    point_de_vente_id: f.point_de_vente_id,
    created_at: f.updated_at,
  }));

demoFiches.forEach((f) => {
  const client = demoClients.find((c) => c.nom === f.client_nom);
  if (client) f.client_id = client.id;
});

/** Le parcours dans l'ordre — sert à rejouer l'historique d'une fiche. */
const STAGE_ORDER: StageOrPerdu[] = [...STAGES];

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

/**
 * Les deux liens de collecte semés par la migration 0011, reproduits ici pour
 * que le formulaire client soit visible sans base — c'est le seul écran que
 * le mode démo laissait autrement inaccessible.
 */
export const demoLiensPublics: Record<
  string,
  {
    libelle: string;
    audience: "client" | "equipe";
    locale: "fr" | "ar" | "en";
    pdv_nom: string;
    pdv_ville: string;
  }
> = {
  "fiche-contact": {
    libelle: "Fiche Contact — Client",
    audience: "client",
    locale: "fr",
    pdv_nom: demoPdvs[0].nom,
    pdv_ville: demoPdvs[0].ville,
  },
  "fiche-equipe": {
    libelle: "Fiche Contact — Équipe",
    audience: "equipe",
    locale: "fr",
    pdv_nom: demoPdvs[0].nom,
    pdv_ville: demoPdvs[0].ville,
  },
};

/**
 * Client actif — les dossiers envoyés, répartis sur les premières étapes de
 * production. En vrai c'est un trigger Postgres qui les crée ; ici on
 * reproduit son résultat pour que l'écran ait quelque chose à montrer.
 */
export const demoClientsActifs: ClientActifRow[] = demoFiches
  .filter((f) => f.stage === "dossier_envoye" || f.stage === "releve_definitif")
  .map((f, i) => ({
    id: `${f.id.slice(0, -4)}ca01`,
    fiche_id: f.id,
    etape: ETAPES_PRODUCTION[i % 4],
    point_de_vente_id: f.point_de_vente_id,
    conseiller_id: f.conseiller_id,
    remarques: i === 0 ? "Façades en attente de validation client." : null,
    entre_le: daysAgo(10 + i * 3),
    updated_at: daysAgo(2 + i),
  }));

export const demoRelances: FicheRelanceRow[] = demoFiches
  .filter((f) => ["releve_preliminaire", "conception_devis", "cloture"].includes(f.stage))
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
    .filter((f) => ["releve_preliminaire", "conception_devis"].includes(f.stage))
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

/**
 * A month of showroom activity: client appointments across the four client
 * types plus the team's own internal meetings, spread over several advisors so
 * the agendas have something to show before Supabase is connected.
 */
interface RdvSeed {
  /** Days from today — negative is the recent past. */
  jour: number;
  heure: number;
  duree: number;
  type: RendezVousRow['type'];
  titre: string;
  fiche?: number;
  conseiller?: number;
  lieu?: string;
  notes?: string;
}

const rdvSeeds: RdvSeed[] = [
  { jour: -9, heure: 9, duree: 1.5, type: 'showroom', titre: 'Découverte projet', fiche: 2, lieu: 'Showroom Tunis' },
  { jour: -7, heure: 14, duree: 2, type: 'metre', titre: 'Métré appartement', fiche: 3, lieu: 'Ariana', conseiller: 1 },
  { jour: -5, heure: 10, duree: 1, type: 'showroom', titre: 'Présentation plan 3D', fiche: 5, lieu: 'Showroom Tunis' },
  { jour: -4, heure: 8, duree: 1, type: 'interne', titre: 'Point hebdo équipe', lieu: 'Salle de réunion' },
  { jour: -2, heure: 15, duree: 3, type: 'pose', titre: 'Pose cuisine', fiche: 7, lieu: 'La Marsa', conseiller: 2 },
  { jour: -1, heure: 11, duree: 1, type: 'showroom', titre: 'Choix des façades', fiche: 8, lieu: 'Showroom Tunis' },
  { jour: 0, heure: 10, duree: 1, type: 'showroom', titre: 'RDV showroom', fiche: 0, lieu: 'Showroom Tunis', notes: 'Apporter le nuancier laqué.' },
  { jour: 0, heure: 14, duree: 1.5, type: 'metre', titre: 'Métré sur site', fiche: 4, lieu: 'La Soukra', notes: 'Prendre le laser et les catalogues laqué.' },
  { jour: 0, heure: 17, duree: 1, type: 'interne', titre: 'Débrief journée', lieu: 'Showroom Tunis' },
  { jour: 1, heure: 9, duree: 2, type: 'livraison', titre: 'Livraison caissons', fiche: 6, lieu: 'Menzah 6', conseiller: 1 },
  { jour: 1, heure: 15, duree: 1, type: 'showroom', titre: 'Signature devis', fiche: 9, lieu: 'Showroom Tunis' },
  { jour: 2, heure: 9, duree: 3, type: 'livraison', titre: 'Livraison cuisine complète', fiche: 14, lieu: 'La Marsa' },
  { jour: 2, heure: 16, duree: 1, type: 'metre', titre: 'Contre-métré', fiche: 10, lieu: 'Le Bardo', conseiller: 2 },
  { jour: 3, heure: 8, duree: 1, type: 'interne', titre: 'Réunion commerciale mensuelle', lieu: 'Salle de réunion' },
  { jour: 3, heure: 11, duree: 1.5, type: 'showroom', titre: 'Visite clients Sousse', fiche: 11, lieu: 'Showroom Sousse', conseiller: 1 },
  { jour: 4, heure: 9, duree: 4, type: 'pose', titre: 'Pose dressing', fiche: 12, lieu: 'Carthage', conseiller: 2 },
  { jour: 5, heure: 10, duree: 1, type: 'showroom', titre: 'Présentation budget', fiche: 13, lieu: 'Showroom Tunis' },
  { jour: 7, heure: 14, duree: 2, type: 'metre', titre: 'Métré villa', fiche: 15, lieu: 'Gammarth' },
  { jour: 8, heure: 9, duree: 1, type: 'interne', titre: 'Formation nouveau catalogue', lieu: 'Salle de réunion' },
  { jour: 9, heure: 10, duree: 3, type: 'pose', titre: 'Pose plan de travail', fiche: 16, lieu: 'Ennasr', conseiller: 1 },
  { jour: 11, heure: 15, duree: 1, type: 'showroom', titre: 'Remise des clés', fiche: 17, lieu: 'Showroom Tunis' },
  { jour: 14, heure: 9, duree: 2, type: 'livraison', titre: 'Livraison électroménager', fiche: 18, lieu: 'Manouba', conseiller: 2 },
  { jour: 17, heure: 8, duree: 1, type: 'interne', titre: 'Point hebdo équipe', lieu: 'Salle de réunion' },
];

export const demoRdv: RendezVousRow[] = rdvSeeds.map((s, i) => {
  const fiche = s.fiche === undefined ? null : demoFiches[s.fiche % demoFiches.length];
  const conseiller = demoProfiles[s.conseiller ?? 0];
  const debut = new Date(daysAhead(s.jour, s.heure));
  return {
    id: `00000000-0000-4000-8000-0000000006${String(i).padStart(2, "0")}`,
    titre: fiche ? `${s.titre} — ${fiche.client_nom}` : s.titre,
    type: s.type,
    debut: debut.toISOString(),
    fin: new Date(debut.getTime() + s.duree * 3_600_000).toISOString(),
    fiche_id: fiche?.id ?? null,
    client_id: fiche?.client_id ?? null,
    conseiller_id: conseiller.id,
    point_de_vente_id: conseiller.point_de_vente_id ?? demoPdvs[0].id,
    lieu: s.lieu ?? null,
    notes: s.notes ?? null,
    created_at: daysAgo(Math.max(1, 10 - i)),
  };
});

/**
 * Fournisseurs de démonstration — de quoi remplir la couche « fournisseurs »
 * de la carte du réseau tant que la table est vide. Noms fictifs, villes
 * réelles : ce sont les villes qui portent l'information ici.
 */
const fournisseurSeeds: Array<
  [string, FournisseurRow["categorie"], string, number]
> = [
  ["Atelier Bois du Nord", "caisson", "Menzel Bourguiba", 21],
  ["Menuiserie El Amine", "caisson", "Sfax", 18],
  ["Cuisines Concept Sousse", "caisson", "Msaken", 15],
  ["Marbrerie Thala Stone", "plan_travail", "Kasserine", 25],
  ["Quartz & Granit Tunisie", "plan_travail", "Ben Arous", 12],
  ["Plans de Travail Sahel", "plan_travail", "Monastir", 14],
  ["Électro Distribution", "electromenager", "Tunis", 7],
  ["Sud Électroménager", "electromenager", "Gabès", 10],
  ["Ferrures & Charnières SA", "quincaillerie", "La Soukra", 5],
  ["Accessoires Cuisine Import", "quincaillerie", "Radès", 6],
  ["Équipe Pose Grand Tunis", "pose", "Ariana", 3],
  ["Poseurs du Cap Bon", "pose", "Nabeul", 4],
  ["Pose Sfax Sud", "pose", "Sfax", 4],
  ["Transport Djerba Express", "transport", "Houmt Souk", 2],
  ["Logistique Centre", "transport", "Kairouan", 3],
];

export const demoFournisseurs: FournisseurRow[] = fournisseurSeeds.map(
  ([nom, categorie, ville, delai], i) => ({
    id: `00000000-0000-4000-8000-0000000007${String(i).padStart(2, "0")}`,
    nom,
    categorie,
    ville,
    adresse: `Zone industrielle, ${ville}`,
    telephone: `+216 7${i % 6} ${300 + i} ${400 + i}`,
    email: null,
    contact_nom: null,
    delai_jours: delai,
    notes: null,
    actif: true,
    created_at: daysAgo(300 - i * 4),
  }),
);

/* — Séquences WhatsApp — miroir de la migration 0014 — */

const modeleSeeds: Array<
  [string, string, ModeleMessageRow["categorie"], string]
> = [
  [
    "accueil-j0",
    "Accueil — premier contact",
    "relance",
    "Bonjour {{client}}, ici {{conseiller}} de CUISINA {{showroom}}.\nMerci pour votre demande — je m'occupe personnellement de votre projet.\nQuand seriez-vous disponible pour en parler quelques minutes ?",
  ],
  [
    "relance-sans-nouvelle",
    "Relance — sans nouvelle",
    "relance",
    "Bonjour {{client}}, {{conseiller}} de CUISINA {{showroom}}.\nJe n'ai pas réussi à vous joindre. Souhaitez-vous qu'on reprenne votre projet cette semaine, ou préférez-vous que je vous rappelle plus tard ?",
  ],
  [
    "invitation-showroom",
    "Invitation showroom",
    "rdv",
    "Bonjour {{client}}, rien ne remplace le fait de toucher les matières.\nNotre showroom de {{showroom}} vous accueille du lundi au samedi. Je peux vous réserver un créneau — quel jour vous arrange ?\n{{conseiller}}",
  ],
  [
    "rappel-rdv-veille",
    "Rappel de rendez-vous — la veille",
    "rdv",
    "Bonjour {{client}}, petit rappel pour notre rendez-vous du {{date_rdv}} à {{heure_rdv}} — {{lieu_rdv}}.\nÀ demain !\n{{conseiller}}, CUISINA {{showroom}}",
  ],
  [
    "devis-suivi",
    "Devis — suivi à J+3",
    "devis",
    "Bonjour {{client}}, avez-vous pu prendre connaissance du devis {{reference}} ?\nJe reste disponible pour l'ajuster avec vous — sur les finitions comme sur le budget.\n{{conseiller}}",
  ],
  [
    "devis-relance-finale",
    "Devis — dernière relance",
    "devis",
    "Bonjour {{client}}, je ne veux pas insister davantage sur le devis {{reference}}.\nDites-moi simplement si le projet est reporté : je garde votre dossier au chaud et je vous recontacte au bon moment.\n{{conseiller}}",
  ],
  [
    "merci-signature",
    "Merci — après signature",
    "apres_vente",
    "Merci pour votre confiance, {{client}} 🙏\nVotre projet est lancé. Je reste votre interlocuteur unique jusqu'à la pose — vous pouvez m'écrire ici à tout moment.\n{{conseiller}}, CUISINA {{showroom}}",
  ],
  [
    "nouvelles-apres-pose",
    "Des nouvelles après la pose",
    "apres_vente",
    "Bonjour {{client}}, quelques semaines après la pose : tout se passe bien dans votre cuisine ?\nSi un détail vous chiffonne, c'est le bon moment pour le dire.\n{{conseiller}}",
  ],
  [
    "reprise-apres-pause",
    "Reprise — après une pause",
    "courtoisie",
    "Bonjour {{client}}, on s'était donné rendez-vous à cette période pour reparler de votre projet.\nOù en êtes-vous ? Je peux vous refaire un point sans engagement.\n{{conseiller}}, CUISINA {{showroom}}",
  ],
];

export const demoModeles: ModeleMessageRow[] = modeleSeeds.map(
  ([code, libelle, categorie, corps], i) => ({
    id: `00000000-0000-4000-8000-0000000008${String(i).padStart(2, "0")}`,
    code,
    libelle,
    categorie,
    locale: "fr" as const,
    corps,
    point_de_vente_id: null,
    actif: true,
    cree_par: null,
    created_at: daysAgo(30),
    updated_at: daysAgo(30 - i),
  }),
);

const modeleParCode = new Map(demoModeles.map((m) => [m.code, m.id]));

interface SequenceSeed {
  nom: string;
  description: string;
  declencheur: SequenceRow["declencheur"];
  seuilJours?: number;
  maxMessages: number;
  actif?: boolean;
  /** [ordre, délai en jours, délai en heures, code du modèle] */
  etapes: Array<[number, number, number, string]>;
}

const sequenceSeeds: SequenceSeed[] = [
  {
    nom: "Nouveau lead — les 72 premières heures",
    description:
      "Un lead qu'on ne rappelle pas dans la journée est un lead à moitié perdu. Trois messages, puis on arrête.",
    declencheur: "fiche_creee",
    maxMessages: 3,
    etapes: [
      [1, 0, 2, "accueil-j0"],
      [2, 1, 0, "relance-sans-nouvelle"],
      [3, 3, 0, "invitation-showroom"],
    ],
  },
  {
    nom: "Devis envoyé — sans réponse",
    description: "Deux relances espacées après la remise du devis, puis on classe.",
    declencheur: "devis_sans_reponse",
    seuilJours: 3,
    maxMessages: 2,
    etapes: [
      [1, 3, 0, "devis-suivi"],
      [2, 10, 0, "devis-relance-finale"],
    ],
  },
  {
    nom: "Rappel de rendez-vous",
    description: "La veille au soir. Divise par deux les rendez-vous manqués.",
    declencheur: "rdv_planifie",
    maxMessages: 1,
    etapes: [[1, -1, 0, "rappel-rdv-veille"]],
  },
  {
    nom: "Après signature",
    description: "Remercier, puis prendre des nouvelles une fois la cuisine posée.",
    declencheur: "apres_signature",
    maxMessages: 2,
    etapes: [
      [1, 0, 1, "merci-signature"],
      [2, 45, 0, "nouvelles-apres-pose"],
    ],
  },
  {
    nom: "Reprise des leads en pause",
    description: "Le jour où la pause arrive à échéance, un message sans pression.",
    declencheur: "pause_reprise",
    maxMessages: 1,
    etapes: [[1, 0, 0, "reprise-apres-pause"]],
  },
];

export const demoSequences: SequenceRow[] = sequenceSeeds.map((s, i) => ({
  id: `00000000-0000-4000-8000-0000000009${String(i).padStart(2, "0")}`,
  nom: s.nom,
  description: s.description,
  declencheur: s.declencheur,
  stage_cible: null,
  seuil_jours: s.seuilJours ?? 0,
  // Toutes en simulation : elles remplissent la file, elles n'envoient rien.
  mode: "simulation" as const,
  actif: s.actif ?? true,
  fenetre_debut: 9,
  fenetre_fin: 19,
  exclure_dimanche: false,
  exclure_vendredi: false,
  stop_si_reponse: true,
  stop_si_stage_change: true,
  max_messages: s.maxMessages,
  point_de_vente_id: null,
  cree_par: null,
  created_at: daysAgo(30),
  updated_at: daysAgo(12 - i),
}));

export const demoSequenceEtapes: SequenceEtapeRow[] = sequenceSeeds.flatMap(
  (s, i) =>
    s.etapes.map(([ordre, jours, heures, code]) => ({
      id: `00000000-0000-4000-8000-00000000a${i}${String(ordre).padStart(2, "0")}`,
      sequence_id: demoSequences[i].id,
      ordre,
      delai_jours: jours,
      delai_heures: heures,
      modele_id: modeleParCode.get(code) ?? demoModeles[0].id,
      actif: true,
      created_at: daysAgo(30),
    })),
);

/**
 * Quelques envois déjà tracés : de quoi voir le journal rempli. Tous marqués
 * `envoye` par un humain — c'est ce que produit la file d'attente
 * aujourd'hui, un conseiller qui appuie lui-même.
 *
 * Le couple (séquence, modèle) est repris de la vraie chaîne plutôt que tiré
 * au hasard : un journal où le libellé de séquence contredit le texte du
 * message ne se lit pas. Les modèles de rendez-vous sont écartés — leurs
 * variables de date n'ont pas de rendez-vous d'où sortir ici.
 */
const chainesJournalisables = demoSequenceEtapes
  .map((etape) => ({
    etape,
    sequence: demoSequences.find((s) => s.id === etape.sequence_id),
    modele: demoModeles.find((m) => m.id === etape.modele_id),
  }))
  .filter(
    (c): c is { etape: SequenceEtapeRow; sequence: SequenceRow; modele: ModeleMessageRow } =>
      Boolean(c.sequence && c.modele && !/\{\{(date|heure|lieu)_rdv\}\}/.test(c.modele.corps)),
  );

export const demoEnvois: MessageEnvoyeRow[] = demoFiches
  .filter(
    (f) =>
      f.tel_mobile && ["releve_preliminaire", "conception_devis", "signe"].includes(f.stage),
  )
  .slice(0, 8)
  .map((f, i) => {
    const { sequence, etape, modele } =
      chainesJournalisables[i % chainesJournalisables.length];
    const conseiller = demoProfiles.find((p) => p.id === f.conseiller_id);
    const pdv = demoPdvs.find((p) => p.id === f.point_de_vente_id);
    const corps = modele.corps
      .replaceAll("{{client}}", f.client_nom)
      .replaceAll("{{conseiller}}", conseiller?.prenom ?? "")
      .replaceAll("{{showroom}}", pdv?.ville ?? "")
      .replaceAll("{{reference}}", f.reference);
    return {
      id: `00000000-0000-4000-8000-00000000b${String(i).padStart(3, "0")}`,
      sequence_id: sequence.id,
      etape_id: etape.id,
      fiche_id: f.id,
      client_id: f.client_id,
      destinataire: `216${(f.tel_mobile ?? "").replace(/\D/g, "").slice(-8)}`,
      corps_rendu: corps,
      statut: (i === 6 ? "repondu" : "envoye") as MessageEnvoyeRow["statut"],
      planifie_le: daysAgo(2 + i, 10),
      envoye_le: daysAgo(2 + i, 10),
      envoye_par: f.conseiller_id,
      erreur: null,
      created_at: daysAgo(2 + i, 10),
    };
  });
