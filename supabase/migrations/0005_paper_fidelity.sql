-- 0005: fields present on the paper FO-COM-02 that were missing digitally
alter table fiches_contact
  add column if not exists tel_bureau text,
  add column if not exists date_prete_devis date,
  add column if not exists remarques_client text;
