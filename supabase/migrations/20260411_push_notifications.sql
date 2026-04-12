-- ============================================================================
-- Push notifications: token + preferences
-- ============================================================================

alter table public.users
  add column if not exists push_token text,
  add column if not exists notification_preferences jsonb default '{
    "lead_changes": true,
    "position_changes": true,
    "match_updates": true,
    "birdies_eagles_aces": true,
    "friend_joined": true,
    "season_reminders": true,
    "digest_weekly": true,
    "quiet_hours": { "enabled": false, "start": "22:00", "end": "07:00" }
  }'::jsonb;

create index if not exists idx_users_push_token on public.users(push_token) where push_token is not null;
