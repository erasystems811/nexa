-- Makeup & Styling off the marketplace, at the owner's call.
--
-- Deactivated, not deleted: a category is referenced by provider_categories and
-- by listings, and deleting one would either fail on the foreign key or take a
-- vendor's chosen category out from under them. is_active = false is the honest
-- removal — it disappears from the homepage, the search filters, the apply form
-- and the admin list at once, and every query already filters on it. Nothing was
-- using it (no providers, no listings) when this was applied.

update public.categories
  set is_active = false
  where slug = 'makeup-styling';
