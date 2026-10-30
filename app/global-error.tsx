"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error.message, error.digest);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="es">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#dc2626" }}>
            Error inesperado
          </h1>
          <p style={{ color: "#666", maxWidth: "400px" }}>
            {isDev && error.message
              ? error.message
              : "Ha ocurrido un error inesperado. Por favor, inténtalo de nuevo."}
          </p>
          {error.digest && (
            <p style={{ fontSize: "12px", color: "#999" }}>
              Referencia: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
