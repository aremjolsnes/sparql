-- Førstegangsinnlogging: be brukeren sette sitt eget passord.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Nye brukere opprettes av admin med et midlertidig passord -> må byttes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, must_change_password)
  values (
    new.id,
    new.email,
    case
      when new.email = 'aremjolsnes@gmail.com' then 'admin'
      when coalesce(new.raw_user_meta_data ->> 'role', '') = 'admin' then 'admin'
      else 'member'
    end,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Klienten kaller denne etter et vellykket passordbytte. security definer, så den
-- kan oppdatere profil-raden uten en vid update-policy på tabellen.
create or replace function public.mark_password_changed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

grant execute on function public.mark_password_changed() to authenticated;

-- Rydd opp for eventuelle brukere som allerede finnes: la den manuelt opprettede
-- admin-brukeren slippe, men be øvrige om å bytte.
update public.profiles set must_change_password = false where email = 'aremjolsnes@gmail.com';
