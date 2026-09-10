-- Run once in the Supabase SQL editor. The anon key is public, so RLS below is
-- the only thing keeping one person's decks away from another's.

create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique not null,
  -- The library, in the same shape the app already writes to disk.
  decks      jsonb not null default '{"version": 1, "decks": []}'::jsonb,
  -- Appearance, pushed and pulled only while the device has theme sync on.
  settings   jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- One policy covers every verb: you may touch your own row and no other.
drop policy if exists "own row" on public.profiles;
create policy "own row" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- RLS narrows access, it never grants it: without this every request fails with
-- "permission denied for table profiles".
grant select, update on public.profiles to authenticated;

-- Usernames are case insensitive, so reserve them lowercased.
create unique index if not exists profiles_username_lower
  on public.profiles (lower(username));

-- In a trigger so signup is atomic: a taken username raises on the unique index
-- and rolls auth.users back with it, leaving no orphaned account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data->>'username'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Definer because RLS hides other rows, so a plain select cannot answer this.
create or replace function public.username_available(name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- Required by App Store guideline 5.1.1(v). Definer because the anon key cannot
-- touch auth.users. Deletes only the caller; the profile goes with the cascade.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_account() from anon;
grant execute on function public.delete_account() to authenticated;

-- ------------------------------------------------------------------ sharing

-- One row per deck sent. Nothing here reaches a library until the recipient
-- accepts it, which is the content filtering App Store guideline 1.2 asks for.
create table if not exists public.deck_shares (
  id            uuid primary key default gen_random_uuid(),
  to_id         uuid not null references auth.users on delete cascade,
  from_id       uuid not null references auth.users on delete cascade,
  from_username text not null,
  deck_name     text not null,
  card_count    int  not null,
  deck          jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists deck_shares_to_id on public.deck_shares (to_id, created_at desc);

alter table public.deck_shares enable row level security;

-- Recipients only. Senders never read the row back, and inserts happen through
-- send_deck below, so no insert policy is wanted here.
drop policy if exists "recipient reads" on public.deck_shares;
create policy "recipient reads" on public.deck_shares
  for select using (auth.uid() = to_id);

drop policy if exists "recipient clears" on public.deck_shares;
create policy "recipient clears" on public.deck_shares
  for delete using (auth.uid() = to_id);

grant select, delete on public.deck_shares to authenticated;

-- Blocking, required by guideline 1.2. Held by username so a block survives the
-- other account being deleted and recreated.
create table if not exists public.blocks (
  owner_id         uuid not null references auth.users on delete cascade,
  blocked_username text not null,
  created_at       timestamptz not null default now(),
  primary key (owner_id, blocked_username)
);

alter table public.blocks enable row level security;

drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

grant select, insert, delete on public.blocks to authenticated;

-- Reports, required by guideline 1.2. Write only from the app: the snapshot is
-- kept because the recipient may reject the deck before it can be looked at.
create table if not exists public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid references auth.users on delete set null,
  reported_username text not null,
  deck_snapshot     jsonb,
  created_at        timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists "file a report" on public.reports;
create policy "file a report" on public.reports
  for insert with check (auth.uid() = reporter_id);

grant insert on public.reports to authenticated;

-- Definer so the sender never learns the recipient's id, and so the block check
-- can read a table the sender has no business reading. Returns a status rather
-- than raising, since every outcome here is something the UI reports plainly.
create or replace function public.send_deck(
  to_username text,
  deck_name text,
  card_count int,
  deck jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sender   text;
  target   uuid;
  waiting  int;
begin
  select username into sender from public.profiles where id = auth.uid();
  if sender is null then return 'not_signed_in'; end if;

  select id into target from public.profiles where lower(username) = lower(to_username);
  if target is null then return 'no_such_user'; end if;
  if target = auth.uid() then return 'self'; end if;

  if exists (
    select 1 from public.blocks
    where owner_id = target and lower(blocked_username) = lower(sender)
  ) then
    -- Reported as sent, so a block cannot be probed by watching for an error.
    return 'ok';
  end if;

  -- Keeps one sender from flooding an inbox.
  select count(*) into waiting from public.deck_shares where to_id = target;
  if waiting >= 50 then return 'inbox_full'; end if;

  insert into public.deck_shares (to_id, from_id, from_username, deck_name, card_count, deck)
  values (target, auth.uid(), sender, deck_name, card_count, deck);
  return 'ok';
end;
$$;

revoke execute on function public.send_deck(text, text, int, jsonb) from anon;
grant execute on function public.send_deck(text, text, int, jsonb) to authenticated;
