-- 0007: pause reasons, free-text loss reasons, reusable custom reasons,
-- and the indexes the pipeline/dashboard queries actually rely on.

-- Why a lead is parked rather than lost.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'motif_pause') then
    create type motif_pause as enum (
      'chantier_en_cours',   -- waiting on the client's building works
      'budget_non_pret',     -- funds not ready yet
      'reflexion',           -- undecided, "je verrai"
      'autre'
    );
  end if;
end $$;

alter table fiches_contact
  add column if not exists motif_pause motif_pause,
  add column if not exists motif_pause_detail text,
  -- WhatsApp re-check cadence in days (7 / 14 / 30 / 60 / 90)
  add column if not exists pause_cadence_jours integer
    check (pause_cadence_jours is null or pause_cadence_jours between 1 and 365),
  add column if not exists pause_reprise_le date,
  -- free-text loss reason when none of the presets fit
  add column if not exists motif_perte_libre text;

-- A paused fiche must carry a reason, exactly like a lost one.
alter table fiches_contact drop constraint if exists pause_requires_motif;
alter table fiches_contact
  add constraint pause_requires_motif
  check (stage <> 'en_pause' or motif_pause is not null);

-- ============ REUSABLE CUSTOM REASONS ============
-- A conseiller can type a reason that is not in the preset list and choose to
-- keep it, so it shows up for everyone next time.

create table if not exists motifs_personnalises (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('perte', 'pause')),
  libelle text not null,
  point_de_vente_id uuid references points_de_vente (id) on delete cascade,
  cree_par uuid references profiles (id),
  utilisations integer not null default 1,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (type, libelle)
);

alter table motifs_personnalises enable row level security;

drop policy if exists motifs_select on motifs_personnalises;
create policy motifs_select on motifs_personnalises
  for select to authenticated using (actif);

drop policy if exists motifs_insert on motifs_personnalises;
create policy motifs_insert on motifs_personnalises
  for insert to authenticated with check (cree_par = auth.uid());

drop policy if exists motifs_update on motifs_personnalises;
create policy motifs_update on motifs_personnalises
  for update to authenticated
  using (cree_par = auth.uid() or is_direction())
  with check (cree_par = auth.uid() or is_direction());

-- ============ PERFORMANCE ============
-- The read layer filters/sorts on these; without them every list is a seq scan.

create index if not exists idx_fiches_updated_at
  on fiches_contact (updated_at desc);
create index if not exists idx_fiches_pause_reprise
  on fiches_contact (pause_reprise_le)
  where stage = 'en_pause';
create index if not exists idx_historique_created_at
  on fiche_historique (created_at desc);
create index if not exists idx_relances_fiche_created
  on fiche_relances (fiche_id, created_at desc);
create index if not exists idx_taches_open_echeance
  on taches (assigne_a, echeance)
  where statut = 'a_faire';
create index if not exists idx_taches_fiche
  on taches (fiche_id)
  where fiche_id is not null;
create index if not exists idx_rdv_debut on rendez_vous (debut);
create index if not exists idx_clients_ca on clients (ca_cumule desc);
