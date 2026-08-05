-- MediTrack — Migration 05: Auth bridge. On auth.users insert, seed the profiles
-- row from JWT metadata so RLS has role + clinic_id to work with. Guarded so a
-- claimless signup (e.g. a bare patient OTP before provisioning) does NOT error —
-- the profile is simply created later by the provisioning step.

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only bridge users that already carry tenant + role in app_metadata.
  if (new.raw_app_meta_data ? 'role') and (new.raw_app_meta_data ? 'clinic_id') then
    insert into public.profiles (id, clinic_id, role, full_name)
    values (
      new.id,
      nullif(new.raw_app_meta_data ->> 'clinic_id', '')::uuid,
      new.raw_app_meta_data ->> 'role',
      new.raw_user_meta_data ->> 'full_name'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();
