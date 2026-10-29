-- =====================================================================
-- CYBERDYNE SPELPORTAL – gemensam databas för alla spel (Supabase), version 3
--
-- Ett konto per barn som gäller i alla spel. Varje spel har ett namn
-- (t.ex. 'kristallgruvan') och sparar sina framsteg och poäng i spelstatus.
--
-- Klistra in hela filen i Supabase: SQL Editor -> New query -> Run.
-- Filen kan köras flera gånger. Konton och framsteg från Kristallgruvan
-- version 2 (tabellen players) flyttas automatiskt hit första gången.
--
-- Lärarlösenord (körs separat, bara av dig):
--     select public.set_teacher_password('ditt-lärarlösenord');
-- Dölj ett testkonto från topplistor och statistik:
--     update public.konton set hidden = true where lower(name) = lower('Testare');
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

/* ---------- tabeller ---------- */
create table if not exists public.konton (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null check (char_length(name) between 2 and 16),
  grade        smallint    not null default 4 check (grade between 3 and 6),
  pass_hash    text,
  fail_count   int         not null default 0,
  locked_until timestamptz,
  hidden       boolean     not null default false,
  created_at   timestamptz not null default now()
);
create unique index if not exists konton_name_lower on public.konton (lower(name));

create table if not exists public.konto_sessioner (
  token      uuid primary key default gen_random_uuid(),
  konto_id   uuid not null references public.konton(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '90 days'
);

-- framsteg och poäng per konto och spel
create table if not exists public.spelstatus (
  konto_id     uuid        not null references public.konton(id) on delete cascade,
  spel         text        not null,
  state        jsonb       not null default '{}'::jsonb,
  week_key     text        not null default '',
  week_points  integer     not null default 0,
  total_points integer     not null default 0,
  best         integer     not null default 0,   -- spelets rekord, t.ex. vagnrace
  last_save    timestamptz not null default now(),
  primary key (konto_id, spel)
);

-- anonym statistik: ingen kolumn pekar på ett konto
create table if not exists public.answer_stats (
  spel     text     not null default 'kristallgruvan',
  day      date     not null,
  grade    smallint not null,
  area     text     not null,
  skill    text     not null,
  level    smallint not null,
  attempts integer  not null default 0,
  wrong    integer  not null default 0
);
alter table public.answer_stats add column if not exists spel text not null default 'kristallgruvan';
alter table public.answer_stats drop constraint if exists answer_stats_pkey;
alter table public.answer_stats add constraint answer_stats_pkey primary key (spel, day, grade, area, skill, level);

create table if not exists public.mistakes (
  id       bigserial primary key,
  spel     text     not null default 'kristallgruvan',
  day      date     not null,
  grade    smallint not null,
  area     text     not null,
  skill    text     not null,
  level    smallint not null,
  question text     not null,
  given    text     not null,
  correct  text     not null
);
alter table public.mistakes add column if not exists spel text not null default 'kristallgruvan';
create index if not exists mistakes_day on public.mistakes (day);

create table if not exists public.teacher_config (
  id           int primary key default 1 check (id = 1),
  pass_hash    text,
  fail_count   int not null default 0,
  locked_until timestamptz
);
insert into public.teacher_config (id) values (1) on conflict do nothing;
create table if not exists public.teacher_sessions (
  token      uuid primary key default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

/* ---------- flytt från Kristallgruvan version 2 (tabellen players) ---------- */
do $$
begin
  if to_regclass('public.players') is not null then
    insert into public.konton (id, name, grade, pass_hash, fail_count, locked_until, hidden, created_at)
    select p.id, p.name, p.grade, p.pass_hash, p.fail_count, p.locked_until,
           coalesce(p.hidden, false), p.created_at
    from public.players p
    where p.pass_hash is not null
      and not exists (select 1 from public.konton k where k.id = p.id or lower(k.name) = lower(p.name));

    insert into public.spelstatus (konto_id, spel, state, week_key, week_points, total_points, best, last_save)
    select p.id, 'kristallgruvan', p.state, p.week_key, p.week_points, p.total_points, p.race_best, p.last_save
    from public.players p
    where exists (select 1 from public.konton k where k.id = p.id)
    on conflict (konto_id, spel) do nothing;
  end if;
end $$;

-- Ingen får läsa eller skriva tabellerna direkt. Allt går via funktionerna.
alter table public.konton           enable row level security;
alter table public.konto_sessioner  enable row level security;
alter table public.spelstatus       enable row level security;
alter table public.answer_stats     enable row level security;
alter table public.mistakes         enable row level security;
alter table public.teacher_config   enable row level security;
alter table public.teacher_sessions enable row level security;
revoke all on public.konton, public.konto_sessioner, public.spelstatus, public.answer_stats,
              public.mistakes, public.teacher_config, public.teacher_sessions from anon, authenticated;
do $$ begin
  if to_regclass('public.players') is not null then
    execute 'alter table public.players enable row level security';
    execute 'revoke all on public.players from anon, authenticated';
  end if;
  if to_regclass('public.player_sessions') is not null then
    execute 'revoke all on public.player_sessions from anon, authenticated';
  end if;
end $$;

-- gamla funktioner från Kristallgruvan version 1 och 2 tas bort
drop function if exists public.load_player(uuid);
drop function if exists public.save_player(uuid, text, int, jsonb, int, int);
drop function if exists public.save_player(uuid, int, jsonb, int, int, jsonb);
drop function if exists public.get_leaderboard(text, uuid);
drop function if exists public.delete_player(uuid);
drop function if exists public.claim_player(uuid, text);
drop function if exists public.kg_player(uuid);
drop function if exists public.kg_new_session(uuid);
drop function if exists public.teacher_stats(uuid, int, int);

/* ---------- hjälpfunktioner ---------- */
create or replace function public.kg_week() returns text
language sql stable as $$ select to_char(now() at time zone 'Europe/Stockholm', 'IYYY-"v"IW') $$;
create or replace function public.kg_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Stockholm')::date $$;

create or replace function public.kg_name_ok(n text) returns boolean
language plpgsql immutable as $$
declare
  l text := lower(coalesce(n, ''));
  bad text[] := array['kuk','fitt','jävl','javl','hora','neger','nazi','hitler','fuck','shit',
                      'bitch','cunt','dick','porn','penis','slyna','bög','knull','rasist'];
  w text;
begin
  if n is null or n !~ '^[A-Za-zÅÄÖåäöÉéÜü0-9 _-]{2,16}$' then return false; end if;
  foreach w in array bad loop
    if position(w in l) > 0 then return false; end if;
  end loop;
  if l ~ '(^|[^a-zåäö])(sex|fan|skit|arsle)([^a-zåäö]|$)' then return false; end if;
  return true;
end $$;

create or replace function public.kg_pass_ok(p text) returns boolean
language sql immutable as $$ select p is not null and char_length(p) between 4 and 64 $$;

create or replace function public.kg_spel_ok(s text) returns boolean
language sql immutable as $$ select s ~ '^[a-z0-9-]{2,30}$' $$;

create or replace function public.kg_konto(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare kid uuid;
begin
  select konto_id into kid from public.konto_sessioner where token = p_token and expires_at > now();
  if kid is null then raise exception 'not_logged_in'; end if;
  return kid;
end $$;

create or replace function public.kg_new_session(kid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  delete from public.konto_sessioner where expires_at < now();
  insert into public.konto_sessioner (konto_id) values (kid) returning token into t;
  return t;
end $$;

/* ---------- konto (gemensamt för alla spel) ---------- */
create or replace function public.register_player(p_name text, p_password text, p_grade int)
returns table(r_id uuid, r_token uuid)
language plpgsql security definer set search_path = public, extensions as $$
declare kid uuid := gen_random_uuid();
begin
  p_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  if not public.kg_name_ok(p_name) then raise exception 'invalid_name'; end if;
  if not public.kg_pass_ok(p_password) then raise exception 'weak_password'; end if;
  if exists (select 1 from public.konton where lower(name) = lower(p_name)) then raise exception 'name_taken'; end if;
  insert into public.konton (id, name, grade, pass_hash)
  values (kid, p_name, greatest(3, least(6, coalesce(p_grade, 4))), crypt(p_password, gen_salt('bf')));
  return query select kid, public.kg_new_session(kid);
end $$;

-- Fel lösenord ger r_error = 'wrong_login' (inget undantag, så att räknaren sparas).
-- Efter 8 fel i rad låses kontot i 10 minuter.
drop function if exists public.login_player(text, text);
create or replace function public.login_player(p_name text, p_password text)
returns table(r_id uuid, r_token uuid, r_name text, r_grade int, r_error text)
language plpgsql security definer set search_path = public, extensions as $$
declare r public.konton;
begin
  select * into r from public.konton where lower(name) = lower(btrim(p_name)) for update;
  if not found or r.pass_hash is null then
    return query select null::uuid, null::uuid, null::text, null::int, 'wrong_login'::text; return;
  end if;
  if r.locked_until is not null and r.locked_until > now() then
    return query select null::uuid, null::uuid, null::text, null::int, 'locked'::text; return;
  end if;
  if r.pass_hash <> crypt(p_password, r.pass_hash) then
    update public.konton set
      fail_count = case when locked_until is not null then 1 else fail_count + 1 end,
      locked_until = case when (case when locked_until is not null then 1 else fail_count + 1 end) >= 8
                          then now() + interval '10 minutes' else null end
    where id = r.id;
    return query select null::uuid, null::uuid, null::text, null::int, 'wrong_login'::text; return;
  end if;
  update public.konton set fail_count = 0, locked_until = null where id = r.id;
  return query select r.id, public.kg_new_session(r.id), r.name, r.grade::int, null::text;
end $$;

-- Vem är inloggad? (används av portalen)
create or replace function public.konto_info(p_token uuid)
returns table(r_id uuid, r_name text, r_grade int)
language plpgsql security definer set search_path = public as $$
declare kid uuid := public.kg_konto(p_token);
begin
  update public.konto_sessioner set expires_at = now() + interval '90 days' where token = p_token;
  return query select k.id, k.name, k.grade::int from public.konton k where k.id = kid;
end $$;

create or replace function public.change_password(p_token uuid, p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare kid uuid := public.kg_konto(p_token); h text;
begin
  if not public.kg_pass_ok(p_new) then raise exception 'weak_password'; end if;
  select pass_hash into h from public.konton where id = kid;
  if h <> crypt(p_old, h) then raise exception 'wrong_login'; end if;
  update public.konton set pass_hash = crypt(p_new, gen_salt('bf')) where id = kid;
  delete from public.konto_sessioner where konto_id = kid and token <> p_token;
end $$;

create or replace function public.logout_player(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.konto_sessioner where token = p_token
$$;

-- Raderar kontot och allt det har sparat i alla spel
create or replace function public.delete_player(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare kid uuid := public.kg_konto(p_token);
begin
  delete from public.konton where id = kid;
  if to_regclass('public.players') is not null then execute 'delete from public.players where id = $1' using kid; end if;
end $$;

/* ---------- spel ---------- */
create or replace function public.load_game(p_token uuid, p_spel text)
returns table(r_id uuid, r_name text, r_grade int, r_state jsonb, r_week int, r_total int, r_best int)
language plpgsql security definer set search_path = public as $$
declare kid uuid := public.kg_konto(p_token);
begin
  if not public.kg_spel_ok(p_spel) then raise exception 'invalid_game'; end if;
  update public.konto_sessioner set expires_at = now() + interval '90 days' where token = p_token;
  return query
    select k.id, k.name, k.grade::int, coalesce(s.state, '{}'::jsonb),
           case when s.week_key = public.kg_week() then s.week_points else 0 end,
           coalesce(s.total_points, 0), coalesce(s.best, 0)
    from public.konton k
    left join public.spelstatus s on s.konto_id = k.id and s.spel = p_spel
    where k.id = kid;
end $$;

-- p_answers: [{area, skill, level, ok, q, given, correct}], högst 40 per anrop.
-- Svaren sparas anonymt i answer_stats och mistakes (utan konto).
-- Servern godtar högst cirka 240 poäng per minut och spel.
create or replace function public.save_game(
  p_token uuid, p_spel text, p_grade int, p_state jsonb, p_add_points int, p_best int, p_answers jsonb default '[]'::jsonb)
returns table(out_week int, out_total int, out_best int, out_week_key text)
language plpgsql security definer set search_path = public as $$
declare
  kid uuid := public.kg_konto(p_token);
  k public.konton;
  s public.spelstatus;
  wk text := public.kg_week();
  today date := public.kg_today();
  allowed int; addp int; a jsonb; g smallint; lv smallint;
begin
  if not public.kg_spel_ok(p_spel) then raise exception 'invalid_game'; end if;
  if p_state is null or pg_column_size(p_state) > 200000 then raise exception 'invalid_state'; end if;
  select * into k from public.konton where id = kid for update;
  g := greatest(3, least(6, coalesce(p_grade, k.grade)));
  if g <> k.grade then update public.konton set grade = g where id = kid; end if;

  insert into public.spelstatus (konto_id, spel, week_key, last_save)
  values (kid, p_spel, wk, now() - interval '2 minutes') on conflict do nothing;
  select * into s from public.spelstatus where konto_id = kid and spel = p_spel for update;

  allowed := least(5000, 300 + floor(extract(epoch from (now() - s.last_save)) * 4)::int);
  addp := greatest(0, least(coalesce(p_add_points, 0), allowed));
  if s.week_key <> wk then s.week_points := 0; end if;

  update public.spelstatus set state = p_state, week_key = wk,
    week_points = s.week_points + addp, total_points = s.total_points + addp,
    best = greatest(s.best, least(coalesce(p_best, 0), 1000000)), last_save = now()
  where konto_id = kid and spel = p_spel;

  if jsonb_typeof(p_answers) = 'array' and not k.hidden then
    for a in select value from jsonb_array_elements(p_answers) with ordinality where ordinality <= 40 loop
      lv := greatest(1, least(6, coalesce((a->>'level')::int, 1)));
      insert into public.answer_stats as st (spel, day, grade, area, skill, level, attempts, wrong)
      values (p_spel, today, g, left(coalesce(a->>'area', '?'), 20), left(coalesce(a->>'skill', '?'), 60), lv, 1,
              case when (a->>'ok')::boolean then 0 else 1 end)
      on conflict (spel, day, grade, area, skill, level)
      do update set attempts = st.attempts + 1, wrong = st.wrong + excluded.wrong;
      if not coalesce((a->>'ok')::boolean, false) then
        insert into public.mistakes (spel, day, grade, area, skill, level, question, given, correct)
        values (p_spel, today, g, left(coalesce(a->>'area', '?'), 20), left(coalesce(a->>'skill', '?'), 60), lv,
                left(coalesce(a->>'q', ''), 240), left(coalesce(a->>'given', ''), 40), left(coalesce(a->>'correct', ''), 40));
      end if;
    end loop;
    delete from public.mistakes where day < today - 180;
  end if;

  return query select x.week_points, x.total_points, x.best, x.week_key
    from public.spelstatus x where x.konto_id = kid and x.spel = p_spel;
end $$;

-- Topplista för ett spel: p_kind = 'week' | 'best' | 'total'.
-- p_spel = 'alla' ger summan av alla spels poäng (för portalen).
create or replace function public.get_leaderboard(p_spel text, p_kind text, p_token uuid default null)
returns table(r_rank bigint, r_name text, r_score int, r_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select konto_id from public.konto_sessioner where token = p_token and expires_at > now()
  ), s as (
    select k.id, k.name,
      sum(case p_kind
            when 'week' then case when x.week_key = public.kg_week() then x.week_points else 0 end
            when 'best' then x.best
            else x.total_points end)::int as score
    from public.konton k join public.spelstatus x on x.konto_id = k.id
    where (p_spel = 'alla' or x.spel = p_spel)
      and (not k.hidden or k.id = (select konto_id from me))
    group by k.id, k.name
  ), ranked as (
    select id, name, score, rank() over (order by score desc) as rk from s where score > 0
  )
  select rk, name, score, coalesce(id = (select konto_id from me), false)
  from ranked where rk <= 20 or id = (select konto_id from me)
  order by rk, name
  limit 21
$$;

/* ---------- lärare ---------- */
create or replace function public.set_teacher_password(p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(coalesce(p_password, '')) < 8 then raise exception 'Lärarlösenordet ska ha minst 8 tecken'; end if;
  update public.teacher_config set pass_hash = crypt(p_password, gen_salt('bf')), fail_count = 0, locked_until = null where id = 1;
  delete from public.teacher_sessions;
  return 'Lärarlösenordet är sparat';
end $$;

drop function if exists public.teacher_login(text);
create or replace function public.teacher_login(p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c public.teacher_config; t uuid;
begin
  select * into c from public.teacher_config where id = 1 for update;
  if c.pass_hash is null then return jsonb_build_object('error', 'no_teacher_password'); end if;
  if c.locked_until is not null and c.locked_until > now() then return jsonb_build_object('error', 'locked'); end if;
  if c.pass_hash <> crypt(coalesce(p_password, ''), c.pass_hash) then
    update public.teacher_config set
      fail_count = case when locked_until is not null then 1 else fail_count + 1 end,
      locked_until = case when (case when locked_until is not null then 1 else fail_count + 1 end) >= 5
                          then now() + interval '15 minutes' else null end
    where id = 1;
    return jsonb_build_object('error', 'wrong_login');
  end if;
  update public.teacher_config set fail_count = 0, locked_until = null where id = 1;
  delete from public.teacher_sessions where expires_at < now();
  insert into public.teacher_sessions default values returning token into t;
  return jsonb_build_object('token', t);
end $$;

create or replace function public.kg_teacher(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.teacher_sessions where token = p_token and expires_at > now())
  then raise exception 'not_logged_in'; end if;
end $$;

create or replace function public.teacher_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.teacher_sessions where token = p_token
$$;

-- Anonym statistik för ett spel, de senaste p_days dagarna, valfritt för en årskurs
create or replace function public.teacher_stats(p_token uuid, p_spel text, p_days int default 30, p_grade int default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare since date; res jsonb;
begin
  perform public.kg_teacher(p_token);
  since := public.kg_today() - greatest(1, least(366, coalesce(p_days, 30))) + 1;
  with st as (
    select * from public.answer_stats where spel = p_spel and day >= since and (p_grade is null or grade = p_grade)
  ), mk as (
    select * from public.mistakes where spel = p_spel and day >= since and (p_grade is null or grade = p_grade)
  ), skills as (
    select area, skill, sum(attempts)::int as attempts, sum(wrong)::int as wrong from st group by area, skill
  ), topskills as (
    select * from skills where attempts >= 5 order by (wrong::numeric / attempts) desc, wrong desc limit 15
  )
  select jsonb_build_object(
    'since', since,
    'totals', (select jsonb_build_object('attempts', coalesce(sum(attempts), 0), 'wrong', coalesce(sum(wrong), 0)) from st),
    'areas', coalesce((select jsonb_agg(x order by x.wrong::numeric / nullif(x.attempts, 0) desc nulls last) from (
        select area, sum(attempts)::int as attempts, sum(wrong)::int as wrong from st group by area) x), '[]'::jsonb),
    'levels', coalesce((select jsonb_agg(x order by x.level) from (
        select level, sum(attempts)::int as attempts, sum(wrong)::int as wrong from st group by level) x), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(x order by x.day) from (
        select day, sum(attempts)::int as attempts, sum(wrong)::int as wrong from st group by day) x), '[]'::jsonb),
    'skills', coalesce((select jsonb_agg(jsonb_build_object(
        'area', t.area, 'skill', t.skill, 'attempts', t.attempts, 'wrong', t.wrong,
        'examples', coalesce((select jsonb_agg(e) from (
            select m.question, m.given, m.correct, m.level from mk m
            where m.area = t.area and m.skill = t.skill order by m.id desc limit 5) e), '[]'::jsonb),
        'common_given', coalesce((select jsonb_agg(c) from (
            select m.given, count(*)::int as n from mk m
            where m.area = t.area and m.skill = t.skill and m.given <> '(vet inte)'
            group by m.given having count(*) > 1 order by count(*) desc limit 3) c), '[]'::jsonb),
        'dunno', (select count(*)::int from mk m where m.area = t.area and m.skill = t.skill and m.given = '(vet inte)')
      ) order by (t.wrong::numeric / t.attempts) desc, t.wrong desc) from topskills t), '[]'::jsonb)
  ) into res;
  return res;
end $$;

create or replace function public.teacher_reset_password(p_token uuid, p_name text, p_new text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare kid uuid;
begin
  perform public.kg_teacher(p_token);
  if not public.kg_pass_ok(p_new) then raise exception 'weak_password'; end if;
  select id into kid from public.konton where lower(name) = lower(btrim(p_name));
  if kid is null then raise exception 'not_found'; end if;
  update public.konton set pass_hash = crypt(p_new, gen_salt('bf')), fail_count = 0, locked_until = null where id = kid;
  delete from public.konto_sessioner where konto_id = kid;
  return 'ok';
end $$;

/* ---------- behörigheter ---------- */
revoke all on function public.kg_name_ok(text), public.kg_pass_ok(text), public.kg_spel_ok(text), public.kg_konto(uuid),
  public.kg_new_session(uuid), public.kg_teacher(uuid), public.set_teacher_password(text)
  from public, anon, authenticated;
grant execute on function public.kg_week(), public.kg_today() to anon, authenticated;
grant execute on function
  public.register_player(text, text, int),
  public.login_player(text, text),
  public.konto_info(uuid),
  public.change_password(uuid, text, text),
  public.logout_player(uuid),
  public.delete_player(uuid),
  public.load_game(uuid, text),
  public.save_game(uuid, text, int, jsonb, int, int, jsonb),
  public.get_leaderboard(text, text, uuid),
  public.teacher_login(text),
  public.teacher_logout(uuid),
  public.teacher_stats(uuid, text, int, int),
  public.teacher_reset_password(uuid, text, text)
to anon, authenticated;
