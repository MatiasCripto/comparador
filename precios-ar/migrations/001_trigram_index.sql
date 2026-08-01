-- 001: Índice trigram para búsqueda ILIKE en productos
--
-- La vista latest_prices consulta products.canonical_name con ILIKE '%query%'.
-- Sin índice trigram, cada búsqueda escanea toda la tabla (~600k filas).
--
-- Ejecutar en el SQL Editor de Supabase (una sola vez).

-- 1. Habilitar la extensión pg_trgm (si no está)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índice GIN trigram sobre canonical_name en la tabla base products
--    El planner de PostgreSQL puede usar este índice incluso cuando la
--    consulta va contra la vista latest_prices, porque el ILIKE se
--    "pushdea" a la tabla base.
CREATE INDEX IF NOT EXISTS idx_products_canonical_name_trgm
  ON products
  USING gin (canonical_name gin_trgm_ops);
