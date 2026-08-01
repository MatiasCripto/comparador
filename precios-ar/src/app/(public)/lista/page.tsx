import { createAdminClient } from "@/lib/supabase/service";
import ListaClient from "@/components/lista/ListaClient";

export default async function ListaPage() {
  const supabase = createAdminClient();

  // Use stores.category (21 rubros) instead of products.category (608k rows
  // that hits Supabase's 1000-row cap and returns only the first category).
  const { data: storeCatRows } = await supabase
    .from("stores")
    .select("category")
    .not("category", "is", null);

  const categories = [...new Set(
    (storeCatRows ?? []).map(r => r.category).filter(Boolean) as string[]
  )].sort();

  return <ListaClient initialCategories={categories} />;
}
