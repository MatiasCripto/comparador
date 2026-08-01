-- Geocodificación de tiendas (OpenCage)
-- Agrega coordenadas y dirección opcional a stores.

alter table stores add column if not exists address text;
alter table stores add column if not exists lat double precision;
alter table stores add column if not exists lng double precision;
alter table stores add column if not exists geocode_type text; -- building|city|county|state|country...
create index if not exists idx_stores_lat on stores (lat);
