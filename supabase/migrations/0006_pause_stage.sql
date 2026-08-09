-- 0006: the "en pause" stage — a lead that is neither advancing nor lost.
-- Must be its own migration: Postgres forbids using a new enum value in the
-- same transaction that adds it.

alter type fiche_stage add value if not exists 'en_pause' before 'signe';
