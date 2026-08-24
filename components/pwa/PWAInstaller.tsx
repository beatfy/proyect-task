"use client";

import React, { useEffect, useState } from "react";
import { Download, X, Smartphone, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already installed as standalone PWA
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isStandaloneMode);

    // 2. Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.log("PWA Service Worker registration skipped/failed:", err);
        });
    }

    // 3. Listen for Android / Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      toast.success("¡taskProject se ha instalado en tu dispositivo!");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info(
        "Para instalar en Android: pulsa el menú de 3 puntos de Chrome (⋮) y selecciona 'Instalar aplicación' o 'Añadir a pantalla de inicio'."
      );
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === "accepted") {
        toast.success("Instalando taskProject en tu móvil...");
      } else {
        toast.info("Instalación pospuesta");
      }
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (err) {
      console.error("Error al instalar PWA:", err);
    }
  };

  if (isStandalone || !isInstallable || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-5">
      <div className="bg-card/95 backdrop-blur-xl border border-primary/30 p-4 rounded-2xl shadow-2xl text-card-foreground flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                Instalar taskProject App
                <Sparkles className="w-3 h-3 text-amber-400" />
              </h4>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                Descarga la app en tu Android para acceder rápido y a pantalla completa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="w-full h-8 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar en mi móvil</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDismissed(true)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-xl"
          >
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  );
}
