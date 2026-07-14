-- Category photography.
--
-- The category row on the homepage is the first thing a customer looks at, and
-- it has been sixteen little drawings. A marketplace is sold by its pictures —
-- a decorated hall, a cake, a DJ booth under lights.
--
-- No column for it, deliberately. The photo lives at a path named after the
-- category's own slug ('catering', 'cakes'), so the file *is* the record and
-- there is nothing to keep in step: no column that can point at a deleted file,
-- no file orphaned by a deleted row. Admin uploads with upsert, so replacing a
-- photo is the same act as adding one.
--
-- The bucket is public, unlike provider-media, which holds vendors' NINs and
-- passports and must never be world-readable. Two buckets, not one, so that no
-- single wrong policy can ever put a customer's category tile and a vendor's ID
-- in the same place.
--
-- This bucket already exists on the live project — it was created through the
-- storage API. This migration is here so a fresh environment gets it too.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'category-media', 'category-media', true,
  10485760,  -- 10 MB; these are tiles, not raw camera files
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do nothing;
