-- Enriquecimiento con Open Food Facts
-- Agrega columnas de enriquecimiento a products y la tabla de cola de enriquecimiento.

alter table products add column if not exists ean text;
alter table products add column if not exists off_category text;
alter table products add column if not exists nutriscore text;
alter table products add column if not exists ean_verificado boolean default false;
alter table products add column if not exists off_last_sync timestamptz;
create index if not exists idx_products_ean on products (ean);

create table if not exists off_enrich_queue (
  id bigint generated always as identity primary key,
  product_id uuid not null references products(id) on delete cascade,
  status text not null default 'pending', -- pending | enriched | no_match | error
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  attempted_at timestamptz,
  unique (product_id)
);
create index if not exists idx_off_queue_pending on off_enrich_queue (status, created_at);
