-- CUISINA CRM — 0003: storage bucket for paper fiche photos

insert into storage.buckets (id, name, public)
values ('fiches', 'fiches', false)
on conflict (id) do nothing;

-- Authenticated users manage photos inside their own uid folder: {uid}/{fiche_id}.jpg
create policy fiches_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'fiches');

create policy fiches_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fiches'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fiches_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fiches'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fiches_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fiches'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
