"use client";

import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function BuscarError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <SearchX className="h-16 w-16 text-gray-300 mx-auto mb-6" />
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        Algo salió mal
      </h1>
      <p className="text-gray-500 max-w-md mb-8">
        Hubo un error al buscar los productos. Puede ser un problema temporal con
        la conexión a la base de datos.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => reset()}>
          Reintentar
        </Button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
