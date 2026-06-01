-- ════════════════════════════════════════════════════════════════
-- AheadNews – Groups / Group Chat schema
-- Run in Supabase SQL Editor after 20260509000000_forum.sql
-- ════════════════════════════════════════════════════════════════

-- ── Add email to profiles (needed for invite-by-email) ────────────────────────

alter table public.profiles
  add column if not exists email text;

-- Re-create trigger so it also stores email going forward
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

-- Backfill email for any existing profiles (run once)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- ── Groups ────────────────────────────────────────────────────────────────────

create table if not exists public.groups (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_by uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ── Group members ──────────────────────────────────────────────────────────────

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id)   on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member'
    constraint group_members_role_check check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ── Group messages ─────────────────────────────────────────────────────────────
-- message_type = 'text'  → plain chat
-- message_type = 'story' → shared news card (headline, source, url, summary)

create table if not exists public.group_messages (
  id             uuid        primary key default gen_random_uuid(),
  group_id       uuid        not null references public.groups(id)   on delete cascade,
  author_id      uuid        not null references public.profiles(id) on delete cascade,
  content        text,
  message_type   text        not null default 'text'
    constraint group_messages_type_check check (message_type in ('text', 'story')),
  story_headline text,
  story_source   text,
  story_url      text,
  story_summary  text,
  created_at     timestamptz not null default now()
);

-- ── Helper functions (avoid self-referential RLS issues) ───────────────────────

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ── Row Level Security ─────────────────────────────────────────────────────────

alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.group_messages enable row level security;

-- Groups: only members can see their own groups
drop policy if exists "groups_select" on public.groups;
drop policy if exists "groups_insert" on public.groups;
drop policy if exists "groups_delete" on public.groups;

-- Creator can see the group immediately (before they're added as a member).
-- Members can see groups they're in.
create policy "groups_select" on public.groups
  for select using (auth.uid() = created_by OR is_group_member(id));

create policy "groups_insert" on public.groups
  for insert with check (auth.uid() = created_by);

create policy "groups_delete" on public.groups
  for delete using (auth.uid() = created_by);

-- Group members: members of the group can see each other
drop policy if exists "group_members_select" on public.group_members;
drop policy if exists "group_members_insert" on public.group_members;
drop policy if exists "group_members_delete" on public.group_members;

create policy "group_members_select" on public.group_members
  for select using (is_group_member(group_id));

-- Owner can add others; anyone can add themselves (for direct invites)
create policy "group_members_insert" on public.group_members
  for insert with check (
    auth.uid() = user_id
    or is_group_owner(group_id)
  );

create policy "group_members_delete" on public.group_members
  for delete using (
    auth.uid() = user_id           -- leave group
    or is_group_owner(group_id)    -- owner removes member
  );

-- Messages: group members can read and write
drop policy if exists "group_messages_select" on public.group_messages;
drop policy if exists "group_messages_insert" on public.group_messages;

create policy "group_messages_select" on public.group_messages
  for select using (is_group_member(group_id));

create policy "group_messages_insert" on public.group_messages
  for insert with check (
    auth.uid() = author_id
    and is_group_member(group_id)
  );
