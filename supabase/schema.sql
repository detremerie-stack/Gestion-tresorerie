-- Moni — schéma Supabase (à exécuter une seule fois dans Supabase › SQL Editor)
-- Un « foyer » (household) partage toutes ses données entre ses membres.
-- Toutes les données sont stockées dans une table générique `records` (jsonb),
-- ce qui permet d'ajouter des fonctionnalités sans migration.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Foyer',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.records (
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null,
  id text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (household_id, kind, id)
);

create index if not exists records_sync_idx on public.records (household_id, updated_at);

-- L'horodatage serveur fait foi (évite les décalages d'horloge entre téléphones).
create or replace function public.touch_record() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_record();

-- Appartenance au foyer (security definer pour éviter la récursion RLS).
create or replace function public.is_member(hid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.records enable row level security;

drop policy if exists "membres lisent leur foyer" on public.households;
create policy "membres lisent leur foyer" on public.households for select using (public.is_member(id));

drop policy if exists "membres voient les membres" on public.household_members;
create policy "membres voient les membres" on public.household_members for select using (public.is_member(household_id));

drop policy if exists "membres lisent" on public.records;
create policy "membres lisent" on public.records for select using (public.is_member(household_id));
drop policy if exists "membres écrivent" on public.records;
create policy "membres écrivent" on public.records for insert with check (public.is_member(household_id));
drop policy if exists "membres modifient" on public.records;
create policy "membres modifient" on public.records for update using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Créer un foyer et en devenir membre.
create or replace function public.create_household(p_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  insert into households(name) values (coalesce(nullif(trim(p_name), ''), 'Foyer')) returning * into h;
  insert into household_members(household_id, user_id) values (h.id, auth.uid());
  return h;
end $$;

-- Rejoindre un foyer avec son code d'invitation.
create or replace function public.join_household(p_code text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into h from households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'Code d''invitation inconnu'; end if;
  insert into household_members(household_id, user_id) values (h.id, auth.uid()) on conflict do nothing;
  return h;
end $$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- Temps réel : diffuser les modifications de `records`.
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;
