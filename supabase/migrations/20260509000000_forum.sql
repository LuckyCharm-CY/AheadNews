-- ════════════════════════════════════════════════════════════════
-- AheadNews – Forum schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ════════════════════════════════════════════════════════════════

-- ── Profiles ──────────────────────────────────────────────────────────────────
-- One row per auth user. Auto-created via trigger on sign-up.

create table if not exists public.profiles (
  id       uuid primary key references auth.users on delete cascade,
  username text not null,
  role     text not null default 'member'
    constraint profiles_role_check check (role in ('member', 'mod'))
);

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Posts ──────────────────────────────────────────────────────────────────────

create table if not exists public.posts (
  id            uuid        primary key default gen_random_uuid(),
  author_id     uuid        not null references public.profiles(id) on delete cascade,
  title         text        not null,
  content       text        not null,
  category      text        not null,
  votes         integer     not null default 1,
  comment_count integer     not null default 0,
  is_stickied   boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- ── Comments ───────────────────────────────────────────────────────────────────
-- parent_id = null  → top-level comment
-- parent_id = uuid  → reply to that comment

create table if not exists public.comments (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references public.posts(id)    on delete cascade,
  author_id  uuid        not null references public.profiles(id) on delete cascade,
  parent_id  uuid                 references public.comments(id) on delete cascade,
  content    text        not null,
  votes      integer     not null default 1,
  created_at timestamptz not null default now()
);

-- ── Vote ledger ────────────────────────────────────────────────────────────────

create table if not exists public.post_votes (
  post_id   uuid     not null references public.posts(id)    on delete cascade,
  user_id   uuid     not null references public.profiles(id) on delete cascade,
  direction smallint not null constraint post_votes_dir_check check (direction in (1, -1)),
  primary key (post_id, user_id)
);

create table if not exists public.comment_votes (
  comment_id uuid     not null references public.comments(id) on delete cascade,
  user_id    uuid     not null references public.profiles(id) on delete cascade,
  direction  smallint not null constraint comment_votes_dir_check check (direction in (1, -1)),
  primary key (comment_id, user_id)
);

-- ── Atomic vote RPCs ───────────────────────────────────────────────────────────
-- Toggle: same direction → remove vote. Switch: opposite → flip.

create or replace function public.cast_post_vote(p_post_id uuid, p_direction smallint)
returns void
language plpgsql
security definer
as $$
declare
  v_user  uuid     := auth.uid();
  v_old   smallint;
  v_delta smallint;
begin
  select direction into v_old
    from public.post_votes
   where post_id = p_post_id and user_id = v_user;

  if v_old is null then
    insert into public.post_votes (post_id, user_id, direction)
    values (p_post_id, v_user, p_direction);
    v_delta := p_direction;
  elsif v_old = p_direction then
    delete from public.post_votes where post_id = p_post_id and user_id = v_user;
    v_delta := -p_direction;
  else
    update public.post_votes set direction = p_direction
     where post_id = p_post_id and user_id = v_user;
    v_delta := p_direction * 2;
  end if;

  update public.posts set votes = votes + v_delta where id = p_post_id;
end;
$$;

create or replace function public.cast_comment_vote(p_comment_id uuid, p_direction smallint)
returns void
language plpgsql
security definer
as $$
declare
  v_user  uuid     := auth.uid();
  v_old   smallint;
  v_delta smallint;
begin
  select direction into v_old
    from public.comment_votes
   where comment_id = p_comment_id and user_id = v_user;

  if v_old is null then
    insert into public.comment_votes (comment_id, user_id, direction)
    values (p_comment_id, v_user, p_direction);
    v_delta := p_direction;
  elsif v_old = p_direction then
    delete from public.comment_votes where comment_id = p_comment_id and user_id = v_user;
    v_delta := -p_direction;
  else
    update public.comment_votes set direction = p_direction
     where comment_id = p_comment_id and user_id = v_user;
    v_delta := p_direction * 2;
  end if;

  update public.comments set votes = votes + v_delta where id = p_comment_id;
end;
$$;

-- ── Row Level Security ─────────────────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.posts         enable row level security;
alter table public.comments      enable row level security;
alter table public.post_votes    enable row level security;
alter table public.comment_votes enable row level security;

-- profiles: anyone can read; users update only their own row
drop policy if exists "profiles_select"     on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select"     on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- posts: anyone reads; authenticated users insert (must own the row); author or mod can delete
drop policy if exists "posts_select" on public.posts;
drop policy if exists "posts_insert" on public.posts;
drop policy if exists "posts_delete" on public.posts;
create policy "posts_select" on public.posts for select using (true);
create policy "posts_insert" on public.posts for insert
  with check (auth.uid() = author_id);
create policy "posts_delete" on public.posts for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'mod')
  );

-- comments: same pattern
drop policy if exists "comments_select" on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_delete" on public.comments;
create policy "comments_select" on public.comments for select using (true);
create policy "comments_insert" on public.comments for insert
  with check (auth.uid() = author_id);
create policy "comments_delete" on public.comments for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'mod')
  );

-- votes: each user manages only their own rows
drop policy if exists "post_votes_own"    on public.post_votes;
drop policy if exists "comment_votes_own" on public.comment_votes;
create policy "post_votes_own"    on public.post_votes    for all using (auth.uid() = user_id);
create policy "comment_votes_own" on public.comment_votes for all using (auth.uid() = user_id);
