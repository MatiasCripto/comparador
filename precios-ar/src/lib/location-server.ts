import { cookies } from "next/headers";

const PROVINCE_COOKIE = "user_province";
const CITY_COOKIE = "user_city";

export async function getUserLocation(): Promise<{
  province: string | null;
  city: string | null;
}> {
  const cookieStore = await cookies();
  return {
    province: cookieStore.get(PROVINCE_COOKIE)?.value ?? null,
    city: cookieStore.get(CITY_COOKIE)?.value ?? null,
  };
}
