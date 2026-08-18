-- Wanelle Tortas - controle de membros e Row-Level Security
-- Esta migração já foi aplicada ao Neon principal.

create table if not exists public.app_members (
  user_id text primary key,
  role text not null check (role in ('admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.app_members enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.financial_entries enable row level security;
alter table public.calendar_events enable row level security;

grant usage on schema public to authenticated;
grant select on public.app_members to authenticated;
grant select, insert, update, delete on public.customers, public.products, public.orders, public.order_items, public.inventory_items, public.inventory_movements, public.financial_entries, public.calendar_events to authenticated;

drop policy if exists app_members_read_self on public.app_members;
create policy app_members_read_self on public.app_members
  for select to authenticated
  using (user_id = (select auth.user_id()));

drop policy if exists wanelle_member_access on public.customers;
create policy wanelle_member_access on public.customers for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active));

drop policy if exists wanelle_member_access on public.products;
create policy wanelle_member_access on public.products for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active));

drop policy if exists wanelle_member_access on public.orders;
create policy wanelle_member_access on public.orders for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active));

drop policy if exists wanelle_member_access on public.order_items;
create policy wanelle_member_access on public.order_items for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active));

drop policy if exists wanelle_member_access on public.inventory_items;
create policy wanelle_member_access on public.inventory_items for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active));

drop policy if exists wanelle_member_access on public.inventory_movements;
create policy wanelle_member_access on public.inventory_movements for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active));

drop policy if exists wanelle_member_access on public.financial_entries;
create policy wanelle_member_access on public.financial_entries for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active));

drop policy if exists wanelle_member_access on public.calendar_events;
create policy wanelle_member_access on public.calendar_events for all to authenticated
  using (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active))
  with check (exists (select 1 from public.app_members m where m.user_id = (select auth.user_id()) and m.active));
