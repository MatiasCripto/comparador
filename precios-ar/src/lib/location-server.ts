import { cookies } from "next/headers";

const PROVINCE_COOKIE = "user_province";
const CITY_COOKIE = "user_city";

// Las cookies se guardan URL-encoded (encodeURIComponent) desde el cliente;
// el valor crudo de la cookie no viene decodificado al servidor.
function decodeCookie(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function getUserLocation(): Promise<{
  province: string | null;
  city: string | null;
}> {
  const cookieStore = await cookies();
  return {
    province: decodeCookie(cookieStore.get(PROVINCE_COOKIE)?.value),
    city: decodeCookie(cookieStore.get(CITY_COOKIE)?.value),
  };
}
