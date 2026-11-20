-- Copa Hostería - Supabase PostgreSQL Schema
-- Listo para migrar desde el almacenamiento local JSON a Supabase PostgreSQL

create extension if not exists "pgcrypto";

-- 1. Ediciones del torneo
create table if not exists editions (
  id text primary key,
  name text not null,
  short_name text not null,
  year integer not null,
  date_label text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Padrón de jugadores (activos e históricos)
create table if not exists players (
  id text primary key,
  name text not null,
  stars integer not null default 0,
  goals_2024 integer not null default 0,
  goals_2025 integer not null default 0,
  assists_2025 integer not null default 0,
  yellow_cards_2025 integer not null default 0,
  red_cards_2025 integer not null default 0,
  convocado_actual boolean not null default true,
  photo_url text,
  created_at timestamptz not null default now()
);

-- 3. Equipos por edición
create table if not exists teams (
  id text primary key,
  edition_id text not null references editions(id) on delete cascade,
  name text not null,
  color text not null default '#2563EB',
  created_at timestamptz not null default now()
);

-- 4. Plantel de cada equipo
create table if not exists team_players (
  team_id text not null references teams(id) on delete cascade,
  player_id text not null references players(id) on delete cascade,
  pot_number integer,
  primary key (team_id, player_id)
);

-- 5. Bombos del sorteo FIFA
create table if not exists pots (
  id text primary key,
  edition_id text not null references editions(id) on delete cascade,
  pot_number integer not null,
  name text not null
);

create table if not exists pot_players (
  pot_id text not null references pots(id) on delete cascade,
  player_id text not null references players(id) on delete cascade,
  primary key (pot_id, player_id)
);

-- 6. Partidos
create table if not exists matches (
  id text primary key,
  edition_id text not null references editions(id) on delete cascade,
  round integer not null default 1,
  round_label text not null default 'Fecha 1',
  home_team_id text not null references teams(id) on delete cascade,
  away_team_id text not null references teams(id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_vivo', 'finalizado')),
  created_at timestamptz not null default now()
);

-- 7. Eventos de partido (goles, asistencias, amarillas, rojas)
create table if not exists match_events (
  id text primary key,
  match_id text not null references matches(id) on delete cascade,
  team_id text not null references teams(id) on delete cascade,
  player_id text not null references players(id) on delete cascade,
  assist_player_id text references players(id) on delete set null,
  event_type text not null check (event_type in ('gol', 'amarilla', 'roja')),
  minute integer,
  is_second_yellow boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_matches_edition on matches(edition_id);
create index if not exists idx_match_events_match on match_events(match_id);
create index if not exists idx_match_events_player on match_events(player_id);
