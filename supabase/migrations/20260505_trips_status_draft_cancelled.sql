-- ============================================================================
-- Extend trips.status with 'draft' and 'cancelled' to support the wizard
-- redesign (docs/trips-wizard-redesign-spec-2026-05-05.md).
--
-- Existing constraint (from 005_trips.sql:19):
--   check (status in ('planning', 'upcoming', 'active', 'completed'))
--
-- New constraint:
--   check (status in
--     ('draft', 'planning', 'upcoming', 'active', 'completed', 'cancelled'))
--
-- 'draft'     — creator-only visibility, no invitations fired. Save-as-draft path.
-- 'cancelled' — explicitly cancelled trips. Reserved for future use; out of scope
--               for the wizard redesign itself.
--
-- RLS note: no policy changes required. The existing trips_select_members
-- policy (005_trips.sql:101) gates select to trip members OR the organizer.
-- A fresh draft has only the organizer as a trip_member, so the existing
-- policy already enforces creator-only visibility for drafts.
-- ============================================================================

alter table public.trips
  drop constraint if exists trips_status_check;

alter table public.trips
  add constraint trips_status_check
  check (status in ('draft', 'planning', 'upcoming', 'active', 'completed', 'cancelled'));
