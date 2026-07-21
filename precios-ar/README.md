# PreciosAR

Comparador de precios online para Argentina. Buscá productos, compará precios entre tiendas, y recibí alertas cuando bajen de precio.

## Stack técnico

| Tecnología | Versión |
|---|---|
| Next.js | 16.2 (App Router) |
| React | 19 |
| TypeScript | ~5.x |
| Tailwind CSS | 4.x |
| shadcn/ui | canary (Base UI) |
| Supabase | PostgreSQL + API |
| n8n | Workflows de scraping |

## Variables de entorno

```env
# Supabase (obligatorio)
NEXT_PUBLIC_SUPABASE_URL=https://ygqfbbkjdiryilwjrpzh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# n8n (opcional, para forzar scraping desde el panel admin)
N8N_WEBHOOK_URL=<url-del-webhook-wf1>
```

## Cómo correr localmente

```bash
# 1. Instalar dependencias
cd precios-ar
npm install

# 2. Configurar .env.local con las variables de entorno

# 3. Iniciar dev server
npm run dev

# 4. Abrir http://localhost:3000
```

## Cómo agregar una nueva tienda

1. Ir a **/admin/tiendas**
2. Click en **"Nueva tienda"**
3. Completar:
   - **Nombre**: ej. "Coto Digital"
   - **URL**: debe empezar con `https://`
   - **Categoría**: Supermercado, Pinturería, Corralón, etc.
   - **Provincia** y **Ciudad** (opcional)
   - Activar **Scraping habilitado**
4. Configurar selectores de scraping (opcional, según la estructura HTML de la tienda):
   - `product_selector`: selector CSS del contenedor de cada producto
   - `name_selector`: selector CSS del nombre del producto
   - `price_selector`: selector CSS del precio
   - `pagination`: activar si la tienda tiene paginación
   - `pagination_selector`: selector CSS del botón "siguiente página"
5. Click en **"Crear tienda"**
6. Una vez creada, usar el botón **"Forzar scraping"** para iniciar la primera recolección

> El scraping se ejecuta a través de n8n (Workflow 1). La URL del webhook debe estar configurada en `N8N_WEBHOOK_URL`.

## Páginas principales

| Ruta | Descripción |
|---|---|
| `/` | Landing page con buscador y categorías |
| `/buscar?q=...` | Resultados de búsqueda con filtros |
| `/alertas` | Alertas de precio y notificaciones |
| `/admin/tiendas` | Panel de administración de tiendas |

## Arquitectura

- **Server Components** para fetching de datos (Supabase service role)
- **Client Components** para interactividad (filtros, modal de alertas, admin panel)
- **Route Handlers** para APIs internas (`/api/alerts`, `/api/admin/stores`, etc.)
- **Sin autenticación** en esta versión — acceso directo por URL

## Bases de datos (Supabase)

### Tablas principales

- `stores` — tiendas con configuración de scraping
- `products` — productos indexados
- `prices` — histórico de precios
- `price_alerts` — alertas de usuarios
- `notifications` — notificaciones generadas
- `scraping_logs` — registro de ejecuciones de scraping

### Vista

- `latest_prices` — precios más recientes con datos de tienda y producto
