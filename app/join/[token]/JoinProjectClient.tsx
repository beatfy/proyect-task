"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Target {
  id: string;
  name: string;
  description: string | null;
  color?: string | null;
  logo?: string | null;
}

interface Inviter {
  id: string;
  name: string | null;
}

interface Props {
  type: "project" | "organization";
  target: Target;
  inviter: Inviter;
  token: string;
}

export default function JoinProjectClient({
  type,
  target,
  inviter,
  token,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrg = type === "organization";
  const label = isOrg ? "organización" : "proyecto";
  const redirectPath = isOrg
    ? `/organizations/${target.id}`
    : `/projects/${target.id}`;

  const handleJoin = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Error al unirse a la ${label}`);
        return;
      }

      // Use the redirect from the API if available
      router.push(data.redirectTo || redirectPath);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {/* Icon / Logo */}
        <div className="text-center mb-6">
          {isOrg && target.logo ? (
            <img
              src={target.logo}
              alt={target.name}
              className="w-16 h-16 rounded-full mx-auto mb-4 object-cover"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: target.color || "#6366f1" }}
            >
              {target.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {target.name}
          </h1>
          {target.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {target.description}
            </p>
          )}
        </div>

        {/* Inviter */}
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          {inviter.name || "Alguien"} te ha invitado a unirte a esta{" "}
          {label}
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-center text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-500 text-white font-medium rounded-lg transition-colors"
        >
          {loading
            ? "Uniéndose..."
            : `Unirse a la ${label.charAt(0).toUpperCase() + label.slice(1)}`}
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="w-full py-3 px-4 mt-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
        >
          Ir al Dashboard
        </button>
      </div>
    </div>
  );
}
