-- Wanelle Tortas - estrutura inicial do banco
create extension if not exists pgcrypto;

create type order_status as enum (
  'novo',
  'aguardando_confirmacao',
  'confirmado',
  'em_producao',
  'pronto',
  'entregue',
  'cancelado'
);

create type fulfillment_type as enum ('retirada', 'entrega');

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'bolo',
  description text,
  active boolean not null default true,
  base_price numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  status order_status not null default 'novo',
  fulfillment fulfillment_type not null default 'retirada',
  order_date date not null default current_date,
  due_at timestamptz,
  delivery_address text,
  customization text,
  notes text,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  flavor text,
  size text,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'un',
  current_quantity numeric(12,3) not null default 0,
  minimum_quantity numeric(12,3) not null default 0,
  unit_cost numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('entrada','saida','ajuste')),
  quantity numeric(12,3) not null,
  unit_cost numeric(12,2),
  reason text,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists financial_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('entrada','saida')),
  category text,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  entry_date date not null default current_date,
  order_id uuid references orders(id) on delete set null,
  payment_method text,
  created_at timestamptz not null default now()
);

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null default 'atividade',
  starts_at timestamptz not null,
  ends_at timestamptz,
  order_id uuid references orders(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_due_at on orders(due_at);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_calendar_events_starts_at on calendar_events(starts_at);
create index if not exists idx_financial_entries_date on financial_entries(entry_date);
