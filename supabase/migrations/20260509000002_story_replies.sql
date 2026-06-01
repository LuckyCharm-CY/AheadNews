-- ════════════════════════════════════════════════════════════════
-- Story replies in group chat
-- Run in Supabase SQL Editor after 20260509000001_groups.sql
-- ════════════════════════════════════════════════════════════════

-- Add parent_id so text messages can be replies to story messages
alter table public.group_messages
  add column if not exists parent_id uuid
    references public.group_messages(id) on delete cascade;

-- Index for fast reply lookups
create index if not exists group_messages_parent_id_idx
  on public.group_messages(parent_id)
  where parent_id is not null;
