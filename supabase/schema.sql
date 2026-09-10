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
