-- A vendor's profile logo and cover photo.
--
-- providers.logo_url / cover_url have existed since 0004, but nothing in the app
-- ever let a vendor set them — Business Studio only ever uploaded LISTING photos.
-- A vendor with listings but no profile photo showed an empty box on their own
-- page. This is the bucket and the policies that let them fix it.
--
-- Public, unlike provider-media (which holds NINs and passports and must never
-- be world-readable): a profile photo is exactly what a customer is supposed to
-- see, so a public URL — no signed-URL round trip — is what keeps the vendor
-- page fast. Same reasoning as category-media (0032).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-profile-media', 'provider-profile-media', true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do nothing;

-- Path convention: provider-profile-media/{provider_id}/{logo|cover}.{ext}
-- upsert on the same path is how "replace my photo" works — one file, not a
-- growing pile of uploads to clean up.
create policy provider_profile_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'provider-profile-media'
    and (storage.foldername(name))[1] = public.my_provider_id()::text
  );

create policy provider_profile_media_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'provider-profile-media'
    and (storage.foldername(name))[1] = public.my_provider_id()::text
  )
  with check (
    bucket_id = 'provider-profile-media'
    and (storage.foldername(name))[1] = public.my_provider_id()::text
  );

create policy provider_profile_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'provider-profile-media'
    and (storage.foldername(name))[1] = public.my_provider_id()::text
  );

create policy provider_profile_media_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'provider-profile-media' and public.is_admin())
  with check (bucket_id = 'provider-profile-media' and public.is_admin());
