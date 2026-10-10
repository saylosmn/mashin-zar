-- Supabase-ийн auth/storage/realtime/net-ийн хамгийн бага орлуулга (зөвхөн CI-д SQL шалгахад)
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema storage; create schema realtime; create schema net; create schema extensions;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
create table auth.identities (id uuid default gen_random_uuid(), user_id uuid, provider text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create table realtime.messages (id bigserial, topic text, extension text, payload jsonb);
alter table realtime.messages enable row level security;
create or replace function realtime.topic() returns text language sql stable as $$ select '' $$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean) returns void language sql as $$ select $$;
create or replace function net.http_post(url text, body jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$ select 1::bigint $$;
create publication supabase_realtime;
grant usage on schema auth, storage, realtime to anon, authenticated;
