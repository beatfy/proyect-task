"use client";

import { useState } from "react";
import { Music, Download, CheckCircle, Loader2 } from "lucide-react";

export default function DownloadGateClient({ slug, title, description, artistName }: { slug: string; title: string; description: string | null; artistName: string | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ fileUrl: string; fileName: string; alreadyExists?: boolean } | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("Email no válido"); return; }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/download-gate/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || "Error");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-neutral-900 rounded-2xl p-8 border border-neutral-800">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Music className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
            {artistName && <p className="text-neutral-400 text-sm">por {artistName}</p>}
            {description && <p className="text-neutral-500 text-sm mt-2">{description}</p>}
          </div>

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre (opcional)" className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
              <div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Tu email *" required className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="w-full rounded-lg bg-green-500 hover:bg-green-600 text-black font-semibold py-3 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {loading ? "Procesando..." : "Descargar"}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              {result.alreadyExists && <p className="text-neutral-400 text-sm">Ya habías descargado este track. Aquí tienes el link de nuevo:</p>}
              <a href={result.fileUrl} target="_blank" download className="inline-flex items-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 text-black font-semibold px-6 py-3 text-sm transition-colors">
                <Download className="w-4 h-4" /> Descargar {result.fileName}
              </a>
            </div>
          )}

          <div className="text-center mt-6 text-neutral-600 text-xs">
            Powered by Beatfy
          </div>
        </div>
      </div>
    </div>
  );
}
