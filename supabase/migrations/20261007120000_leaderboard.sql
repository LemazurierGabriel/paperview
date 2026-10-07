-- Classement des joueurs de PaperView.
-- Lecture publique ; écriture uniquement via submit_score, qui vérifie le secret
-- gardé par le navigateur du joueur (seul son empreinte SHA-256 est stockée).

create extension if not exists pgcrypto with schema extensions;

create table public.players (
  id uuid primary key,
  secret_hash text not null,
  name text not null check (char_length(name) between 2 and 20),
  best_points integer not null default 0,
  current_points integer not null default 0,
  partie integer not null default 1,
  equity numeric(14, 2) not null default 10000,
  trades integer not null default 0,
  wins integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index players_name_key on public.players (lower(name));
create index players_best_idx on public.players (best_points desc, updated_at);

alter table public.players enable row level security;
revoke all on public.players from anon, authenticated;
grant select (id, name, best_points, current_points, partie, equity, trades, wins, created_at, updated_at)
  on public.players to anon, authenticated;
create policy "Classement lisible par tous" on public.players
  for select to anon, authenticated using (true);

-- Enregistre (ou met à jour) le score d'un joueur et renvoie son rang
create or replace function public.submit_score(
  p_id uuid, p_secret text, p_name text, p_best integer, p_current integer,
  p_partie integer, p_equity numeric, p_trades integer, p_wins integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex');
  v_name text := btrim(coalesce(p_name, ''));
  v_old text;
begin
  if char_length(coalesce(p_secret, '')) < 32 then
    raise exception 'Identifiant de joueur invalide';
  end if;
  if char_length(v_name) not between 2 and 20 or v_name ~ '[[:cntrl:]<>]' then
    raise exception 'Pseudo invalide : entre 2 et 20 caractères';
  end if;
  if abs(p_best) > 100000000 or abs(p_current) > 100000000 or p_partie < 1
     or p_trades < 0 or p_wins < 0 or p_wins > p_trades or p_equity < 0 or p_equity > 1000000000 then
    raise exception 'Score invalide';
  end if;

  select secret_hash into v_old from public.players where id = p_id;
  if found then
    if v_old <> v_hash then
      raise exception 'Ce joueur appartient à un autre navigateur';
    end if;
    update public.players
       set name = v_name, best_points = greatest(best_points, p_best), current_points = p_current,
           partie = p_partie, equity = p_equity, trades = p_trades, wins = p_wins, updated_at = now()
     where id = p_id;
  else
    insert into public.players (id, secret_hash, name, best_points, current_points, partie, equity, trades, wins)
    values (p_id, v_hash, v_name, p_best, p_current, p_partie, p_equity, p_trades, p_wins);
  end if;

  return (select count(*) + 1 from public.players
           where best_points > (select best_points from public.players where id = p_id))::integer;
exception
  when unique_violation then
    raise exception 'Ce pseudo est déjà pris';
end;
$$;

revoke all on function public.submit_score(uuid, text, text, integer, integer, integer, numeric, integer, integer) from public;
grant execute on function public.submit_score(uuid, text, text, integer, integer, integer, numeric, integer, integer)
  to anon, authenticated;
