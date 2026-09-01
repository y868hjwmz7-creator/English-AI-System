-- ============================================================================
-- Supabase 環境の最小の再現(検証専用。本番では実行しない)
--
-- Supabase の本物のデータベースには、はじめから auth スキーマや
-- storage スキーマ、authenticated ロールなどが用意されている。
-- 手元の素の PostgreSQL にはそれが無いため、
-- 0001_init.sql を実行する前に、必要な最小限だけを作る。
--
-- 目的は「0001_init.sql が構文・順序ともに通るか」を確かめること。
-- 実際の権限の挙動まで再現するものではない。
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- ログイン中の利用者の ID。Supabase では JWT から取り出す。
-- 検証では set local request.jwt.claim.sub = '...' で差し替えられるようにする。
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text not null,
  owner     uuid
);
alter table storage.objects enable row level security;

-- Supabase の storage.foldername() は、置き場の中の道を「/」で切って
-- **最後のファイル名を落とした**配列を返す。
--   'abc-123/report.pdf' → {abc-123}
-- 0031 の置き場のポリシーが、先頭([1])だけを見て持ち主を確かめている。
-- 手元でも同じものが無いとポリシーそのものを作れないので、ここに置く。
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)];
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;

-- Supabase では、public スキーマに作られたテーブルへの権限が
-- 自動で anon / authenticated / service_role に付く。
-- (実際のアクセス可否は、そのうえで RLS が決める)
-- 検証でも同じ状態にしないと、権限の絞り込みを確かめられない。
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
