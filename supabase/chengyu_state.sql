-- 成语记忆云同步表（与 CET-4 的 study_state 分离）。
-- 项目：https://sfairjuuslgvllzurkqx.supabase.co
-- 在 Supabase SQL Editor 或 migrate 工具中执行；anon key 可放网页，勿提交 service_role。

create table if not exists public.chengyu_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  idioms jsonb not null default '[]'::jsonb,
  groups jsonb not null default '[]'::jsonb,
  tombstones jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.chengyu_state enable row level security;

drop policy if exists "chengyu_state_select_own" on public.chengyu_state;
drop policy if exists "chengyu_state_insert_own" on public.chengyu_state;
drop policy if exists "chengyu_state_update_own" on public.chengyu_state;

create policy "chengyu_state_select_own"
  on public.chengyu_state
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "chengyu_state_insert_own"
  on public.chengyu_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "chengyu_state_update_own"
  on public.chengyu_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);