-- Fix "Database error saving new user" on sign-up. Safe to re-run. Run after 20260926001600.
--
-- userProfiles."familyID" was created with a default (e.g. gen_random_uuid()). Since
-- 20260926001600 made it a foreign key to families, the sign-up trigger's insert got a
-- random familyID pointing at no family, violating userProfiles_familyID_fkey and
-- aborting the sign-up. New accounts start without a family; they join or create one.
alter table public."userProfiles" alter column "familyID" drop default;
