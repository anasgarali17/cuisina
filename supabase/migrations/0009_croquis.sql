-- 0009: the métré sketch.
--
-- A conseiller measuring a kitchen draws the room: rectangles for the walls
-- and units, lines, handwritten notes and the dimensions beside them. Stored
-- as vector shapes (not a flattened image) so it stays editable, tiny, and
-- readable by later phases.

alter table fiches_contact
  add column if not exists croquis jsonb;

comment on column fiches_contact.croquis is
  'Métré sketch: { v: 1, shapes: [...] } in a 1000x700 logical canvas.';
