-- CUISINA CRM — 0016 : la fiche contact allégée
--
-- Quatre champs quittent la saisie (code postal, état du chantier, budget,
-- observations) et trois arrivent (WhatsApp, signature, pièces jointes).
--
-- Les colonnes retirées de l'écran ne sont PAS supprimées : les fiches déjà
-- saisies les ont remplies, le budget alimente encore la valeur du pipeline,
-- et une colonne qu'on laisse dormir ne coûte rien. Ce qui change est qu'on
-- ne les demande plus.

-- ============ NOUVEAUX CHAMPS ============

alter table fiches_contact
  -- Le mobile est joignable sur WhatsApp. Un booléen suffit : le numéro est
  -- déjà là, le dupliquer inviterait les deux à diverger.
  add column if not exists whatsapp boolean not null default false,
  -- Signature du client, en data URL PNG. Stockée avec la fiche plutôt que
  -- dans le bucket : elle ne vit jamais sans elle.
  add column if not exists signature text,
  add column if not exists signature_le timestamptz;

-- ============ PIÈCES JOINTES ============
-- Une table plutôt qu'un tableau de chemins : on veut le nom d'origine, la
-- taille et qui a déposé quoi. Le fichier lui-même part dans le bucket.

create table if not exists fiche_pieces_jointes (
  id uuid primary key default gen_random_uuid(),
  fiche_id uuid not null references fiches_contact (id) on delete cascade,
  chemin text not null,
  nom_fichier text not null,
  type_mime text,
  taille_octets integer,
  ajoute_par uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pieces_jointes_fiche
  on fiche_pieces_jointes (fiche_id, created_at desc);

alter table fiche_pieces_jointes enable row level security;

drop policy if exists pieces_jointes_select on fiche_pieces_jointes;
create policy pieces_jointes_select on fiche_pieces_jointes
  for select to authenticated
  using (
    exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

drop policy if exists pieces_jointes_insert on fiche_pieces_jointes;
create policy pieces_jointes_insert on fiche_pieces_jointes
  for insert to authenticated
  with check (
    ajoute_par = auth.uid()
    and exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

drop policy if exists pieces_jointes_delete on fiche_pieces_jointes;
create policy pieces_jointes_delete on fiche_pieces_jointes
  for delete to authenticated
  using (
    exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

-- Le bucket : mêmes règles que les photos de fiche papier, dossier par uid.
insert into storage.buckets (id, name, public)
values ('fiches-pieces', 'fiches-pieces', false)
on conflict (id) do nothing;

drop policy if exists pieces_read on storage.objects;
create policy pieces_read on storage.objects
  for select to authenticated
  using (bucket_id = 'fiches-pieces');

drop policy if exists pieces_insert on storage.objects;
create policy pieces_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fiches-pieces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pieces_delete on storage.objects;
create policy pieces_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fiches-pieces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
