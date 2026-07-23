import { createAdminClient } from "@/lib/supabase/service";
import ListaClient from "@/components/lista/ListaClient";

export default async function ListaPage() {
  const supabase = createAdminClient();

  const { data: storeRows } = await supabase
    .from("stores")
    .select("category")
    .not("category", "is", null);

  const categories = [...new Set(
    (storeRows ?? []).map(r => r.category).filter(Boolean) as string[]
  )].sort();

  return <ListaClient initialCategories={categories} />;
}
