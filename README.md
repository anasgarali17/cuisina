# CUISINA CRM — Outil interne (Phase 1)

Internal sales tool for CUISINA (PROMOCUISINE) replacing the paper **FO-COM-02 « Fiche Contact »**.
Next.js 16 App Router · TypeScript strict · Tailwind v4 · Supabase · next-intl (fr / ar RTL / en).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase credentials
```

### 1. Database

Run the migrations against the Supabase project — either paste
[`supabase/setup.sql`](supabase/setup.sql) into the **SQL editor** (one file,
all three migrations in order), or apply `supabase/migrations/*.sql` with the
Supabase CLI.

### 2. Seed

```bash
npm run seed
```

Creates the 9 points de vente, 10 users (password `cuisina2026`, e.g.
`direction@cuisina.tn`), ~40 fiches across the pipeline, clients, tasks and
rendez-vous. Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### 3. Run

```bash
npm run dev
```

**Demo mode** — with no Supabase env vars the app boots on an in-memory
dataset (read-only) so the UI can be reviewed without a database.

## Structure

| Path | What |
|---|---|
| `src/app/[locale]/(app)/` | authenticated app (shell: rail, top bar, mobile tabs) |
| `src/components/fiches/` | Fiche Contact wizard, paper sheet, PDF export |
| `src/lib/data/queries.ts` | read layer (RLS-scoped; demo fallback) |
| `src/lib/actions/` | Server Actions (zod-validated writes) |
| `src/lib/geo/` | Tunisia map: governorate shapes, city gazetteer, marker builder |
| `supabase/migrations/` | schema, RLS policies, storage bucket |
| `messages/` | fr (reference) / ar / en |

## Carte du réseau

`/equipe` plots showrooms, clients, leads and suppliers on the 24 Tunisian
governorates and their 264 delegations (معتمدية), filterable by layer and by
area, with free wheel-zoom and drag-pan.

`src/lib/geo/tunisia-shapes.ts`, `tunisia-delegations.ts` and
`tunisia-place-delegations.ts` are **generated** — outlines come from
[geoBoundaries](https://www.geoboundaries.org/) gbOpen TUN ADM1/ADM2 and
delegation names (ar + fr) from OpenStreetMap `admin_level=5` relations,
matched by geometry (both ODbL 1.0). Everything is projected to SVG
coordinates and simplified at build time so the browser ships path strings
and no geo library; the delegation module is `import()`ed only below the
country view:

```bash
node scripts/build-tunisia-map.mjs       # governorates + delegations (downloads + caches)
npx tsx scripts/build-tunisia-places.ts  # validates the gazetteer, assigns delegations
```

Rows carry a free-text `ville`, never coordinates: `resolveVille` in
`src/lib/geo/tunisia.ts` maps it to one of ~106 localities (accents, articles
and spelling variants absorbed). Anything it cannot resolve is **counted and
reported on screen**, not dropped and not placed at a guess. Add a missing
locality to `PLACES`, then re-run `build-tunisia-places.ts`.

## Roles

`conseiller` sees own data · `chef_showroom` sees their showroom ·
`direction`/`admin` see everything — enforced by RLS, mirrored in demo mode.
