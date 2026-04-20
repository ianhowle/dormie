-- ============================================================================
-- Trip members: guest player support
-- Allow trip_members rows with user_id = NULL + guest_name populated
-- ============================================================================

alter table public.trip_members
  alter column user_id drop not null;

alter table public.trip_members
  add column if not exists guest_name text;

alter table public.trip_members
  add constraint trip_members_user_or_guest
    check ((user_id is not null) or (guest_name is not null));
