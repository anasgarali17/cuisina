/**
 * CUISINA CRM — les comptes autorisés, et eux seuls.
 *
 *   npx tsx scripts/provision-acces.ts            (aperçu, n'écrit rien)
 *   npx tsx scripts/provision-acces.ts --appliquer
 *
 * Quatre comptes : deux administrateurs qui voient tout le réseau, deux
 * commerciaux rattachés au showroom de Nabeul qui ne voient que le leur.
 *
 * Le script est idempotent — on peut le rejouer sans rien casser. Il crée le
 * compte s'il manque, corrige rôle et showroom s'ils ont dérivé, et
 * **désactive** tout autre profil au lieu de le supprimer : les fiches, les
 * rendez-vous et l'historique portent l'identifiant de leur auteur, et
 * effacer l'auteur emporterait son travail avec lui. Un profil `actif = false`
 * ne passe plus la porte, et le passé reste lisible.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

/* ================= env (.env.local, sans dotenv) ================= */

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
    "Variables manquantes. NEXT_PUBLIC_SUPABASE_URL et " +
      "SUPABASE_SERVICE_ROLE_KEY doivent être définies (.env.local ou " +
      "environnement).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const APPLIQUER = process.argv.includes("--appliquer");

/* ================= les comptes ================= */

type Role = "conseiller" | "chef_showroom" | "direction" | "admin";

interface CompteVoulu {
  email: string;
  prenom: string;
  nom: string;
  role: Role;
  /** La ville du showroom, ou `null` pour un compte hors showroom. */
  showroom: string | null;
}

/**
 * La liste fait autorité : ce qui n'y est pas n'entre pas.
 *
 * Les administrateurs n'ont pas de showroom — ils les ont tous. Les
 * commerciaux sont à Nabeul, et n'en sortent pas.
 */
const COMPTES: CompteVoulu[] = [
  {
    email: "sofiene@cuisina.com",
    prenom: "Sofiene",
    nom: "Saadallah",
    role: "admin",
    showroom: null,
  },
  {
    email: "haythem.issa@cuisina.com",
    prenom: "Haythem",
    nom: "Issa",
    role: "admin",
    showroom: null,
  },
  {
    email: "rabaa.trabelsi@cuisina.com",
    prenom: "Rabaa",
    nom: "Trabelsi",
    role: "conseiller",
    showroom: "Nabeul",
  },
  {
    email: "commercial.nabeul@cuisina.com",
    prenom: "Commercial",
    nom: "Nabeul",
    role: "conseiller",
    showroom: "Nabeul",
  },
];

/**
 * Le mot de passe posé à la création. Il n'est **pas** réappliqué aux comptes
 * existants : rejouer le script ne doit pas réinitialiser le mot de passe que
 * quelqu'un a déjà changé.
 */
const MOT_DE_PASSE_INITIAL =
  process.env.CUISINA_MOT_DE_PASSE_INITIAL ?? "Cuisina2026!";

/* ================= helpers ================= */

function check(error: { message: string } | null, contexte: string): void {
  if (error) throw new Error(`${contexte}: ${error.message}`);
}

const actions: string[] = [];

function journal(ligne: string): void {
  actions.push(ligne);
  console.log(`  ${ligne}`);
}

/* ================= exécution ================= */

async function main(): Promise<void> {
  console.log(
    APPLIQUER
      ? "— Application des accès —"
      : "— Aperçu (rien ne sera écrit ; ajoutez --appliquer) —",
  );

  /* Les showrooms, pour rattacher les commerciaux au bon. */
  const { data: pdvs, error: pdvError } = await supabase
    .from("points_de_vente")
    .select("id, nom, ville");
  check(pdvError, "select points_de_vente");

  function trouveShowroom(ville: string): { id: string; nom: string } {
    const cible = ville.toLocaleLowerCase();
    const pdv = (pdvs ?? []).find(
      (p) =>
        (p.ville ?? "").toLocaleLowerCase() === cible ||
        p.nom.toLocaleLowerCase().includes(cible),
    );
    if (!pdv) {
      throw new Error(
        `Aucun point de vente pour « ${ville} ». Showrooms trouvés : ` +
          ((pdvs ?? []).map((p) => p.nom).join(", ") || "aucun"),
      );
    }
    return { id: pdv.id, nom: pdv.nom };
  }

  /* Les comptes auth existants. */
  const { data: liste, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  check(listError, "auth.admin.listUsers");
  const parEmail = new Map(
    liste.users.map((u) => [(u.email ?? "").toLocaleLowerCase(), u]),
  );

  const idsAutorises: string[] = [];

  console.log("\n— Comptes autorisés —");
  for (const compte of COMPTES) {
    const showroom = compte.showroom ? trouveShowroom(compte.showroom) : null;
    const existant = parEmail.get(compte.email.toLocaleLowerCase());

    let userId = existant?.id;

    if (!existant) {
      journal(`CRÉER  ${compte.email} (${compte.role})`);
      if (APPLIQUER) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: compte.email,
          password: MOT_DE_PASSE_INITIAL,
          email_confirm: true,
          user_metadata: { prenom: compte.prenom, nom: compte.nom },
        });
        check(error, `auth.admin.createUser ${compte.email}`);
        userId = data.user?.id;
        if (!userId) {
          throw new Error(`createUser ${compte.email} : aucun utilisateur`);
        }
      }
    } else {
      journal(`OK     ${compte.email} existe déjà`);
    }

    if (!userId) continue; // aperçu d'une création : pas encore d'identifiant
    idsAutorises.push(userId);

    /* Le profil : créé ou remis d'aplomb. Un trigger le crée peut-être déjà à
       l'inscription (0004_auto_profile) — d'où l'upsert plutôt qu'un insert. */
    const voulu = {
      id: userId,
      nom: compte.nom,
      prenom: compte.prenom,
      role: compte.role,
      point_de_vente_id: showroom?.id ?? null,
      actif: true,
    };

    const { data: profilActuel } = await supabase
      .from("profiles")
      .select("role, point_de_vente_id, actif")
      .eq("id", userId)
      .maybeSingle();

    const derive =
      !profilActuel ||
      profilActuel.role !== voulu.role ||
      profilActuel.point_de_vente_id !== voulu.point_de_vente_id ||
      profilActuel.actif !== true;

    if (derive) {
      journal(
        `       → rôle ${compte.role}, showroom ${showroom?.nom ?? "— (tous)"}`,
      );
      if (APPLIQUER) {
        const { error } = await supabase
          .from("profiles")
          .upsert(voulu, { onConflict: "id" });
        check(error, `upsert profile ${compte.email}`);
      }
    }
  }

  /* Tout le reste : désactivé, jamais supprimé. */
  console.log("\n— Autres comptes —");
  const { data: autres, error: autresError } = await supabase
    .from("profiles")
    .select("id, nom, prenom, role, actif");
  check(autresError, "select profiles");

  const aDesactiver = (autres ?? []).filter(
    (p) => !idsAutorises.includes(p.id) && p.actif,
  );

  if (aDesactiver.length === 0) {
    console.log("  Aucun autre compte actif.");
  } else {
    for (const p of aDesactiver) {
      journal(`DÉSACTIVER ${p.prenom} ${p.nom} (${p.role})`);
    }
    if (APPLIQUER) {
      const { error } = await supabase
        .from("profiles")
        .update({ actif: false })
        .in(
          "id",
          aDesactiver.map((p) => p.id),
        );
      check(error, "update profiles actif=false");
    }
  }

  console.log(
    APPLIQUER
      ? `\n✓ Terminé — ${actions.length} action(s) appliquée(s).`
      : `\n${actions.length} action(s) en attente. Relancez avec --appliquer.`,
  );
  if (APPLIQUER) {
    console.log(
      "  Les comptes créés utilisent le mot de passe initial ; " +
        "demandez à chacun de le changer à la première connexion.",
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    `\n✗ Échec : ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
