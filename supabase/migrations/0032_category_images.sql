-- Category photography.
--
-- The category row on the homepage is the first thing a customer looks at, and
-- it has been sixteen little drawings. A marketplace is sold by its pictures —
-- a decorated hall, a cake, a DJ booth under lights — and nowhere in the schema
-- could a category hold one.
--
-- The image is public by definition: it is shown to a visitor who has not signed
-- in and never will until they book. So it goes in a public bucket, unlike
-- provider-media, which holds the vendor's ID and must never be world-readable.
-- Keeping the two apart is the whole point — one wrong bucket policy on a shared
-- bucket would put somebody's NIN on the open internet.

alter table public.categories
  add column if not exists image_path text;

comment on column public.categories.image_path is
  'Path within the public category-media bucket. Null falls back to the line icon.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'category-media', 'category-media', true,
  10485760,  -- 10 MB; these are hero tiles, not raw camera files
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do nothing;

-- Anyone may look. The bucket is public, so this only makes the intent explicit
-- and keeps the object rows readable through the API as well as the CDN.
drop policy if exists category_media_public_read on storage.objects;
create policy category_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'category-media');

-- Only Admin may put one there, change it, or take it away.
drop policy if exists category_media_admin_write on storage.objects;
create policy category_media_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'category-media' and public.is_admin())
  with check (bucket_id = 'category-media' and public.is_admin());

-- categories itself is public-read (0011) and had no write policy at all, which
-- was fine while nothing wrote to it. Admin now does.
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
