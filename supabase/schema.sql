-- ============================================================================
-- COPA HOSTERÍA · CONFIGURACIÓN RÁPIDA EN SUPABASE
-- Copiá y pegá este bloque en Supabase -> SQL Editor -> Run
-- ============================================================================

-- 1. Tabla principal de estado del torneo (persistencia en tiempo real)
create table if not exists tournament_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Bucket público para fotos de jugadores
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do update set public = true;

-- 3. Política de lectura pública para las fotos de jugadores
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read player photos'
  ) then
    create policy "Public read player photos"
      on storage.objects for select
      using (bucket_id = 'player-photos');
  end if;
end $$;
