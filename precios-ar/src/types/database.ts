// === TABLES ===

export interface Store {
  id: string
  name: string
  url: string
  category: string | null
  province: string | null
  city: string | null
  logo_url: string | null
  scraping_enabled: boolean
  scraping_config: {
    delivery_type?: 'national' | 'local' | 'both'
    has_physical?: boolean
    [key: string]: unknown
  } | null
  last_scraped_at: string | null
  created_at: string
}

export interface Product {
  id: string
  store_id: string
  canonical_name: string
  raw_name: string | null
  category: string | null
  subcategory: string | null
  brand: string | null
  unit: string | null
  quantity: number | null
  product_url: string | null
  image_url: string | null
  updated_at: string
}

export interface Price {
  id: string
  product_id: string
  store_id: string
  price: number
  scraped_at: string
}

export interface PriceAlert {
  id: string
  user_email: string
  canonical_name: string
  target_price: number
  province: string | null
  is_active: boolean
  last_notified_at: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_email: string
  alert_id: string | null
  canonical_name: string
  cheapest_store: string | null
  cheapest_price: number | null
  target_price: number | null
  price_reached: boolean
  reason: string | null
  all_prices: unknown | null
  read: boolean
  created_at: string
}

export interface ScrapingLog {
  id: string
  store_id: string | null
  status: string
  products_found: number | null
  products_updated: number | null
  error_message: string | null
  error_details: string | null
  scraped_at: string
}

// === VIEWS ===

export interface LatestPrice {
  product_id: string
  store_id: string
  store_name: string
  category: string | null
  province: string | null
  city: string | null
  canonical_name: string
  raw_name: string | null
  brand: string | null
  unit: string | null
  quantity: number | null
  product_url: string | null
  image_url: string | null
  price: number
  price_original: number
  is_offer: boolean
  scraped_at: string
}

// === ENUMS ===

export type ScrapingStatus = 'success' | 'error' | 'running' | 'pending'
