/** Producto seleccionado por el usuario mediante autocomplete */
export interface SelectedProduct {
  product_id: string;
  canonical_name: string;
  raw_name: string | null;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  unit: string | null;
  quantity: number | null;
  /** true cuando el usuario ingresó texto libre sin seleccionar del autocomplete */
  isFallback?: boolean;
}

/** Producto con precio, devuelto por la API de sugerencias */
export interface SelectedProductWithPrice extends SelectedProduct {
  price: number;
  store_name: string;
  store_id: string;
  product_url: string | null;
}
