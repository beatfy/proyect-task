"use client";

import React, { useEffect, useState } from "react";
import { Download, X, Smartphone, Monitor, Laptop, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type OS = "windows" | "mac" | "linux" | "android" | "ios" | "unknown";

function detectOS(): OS {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent || "";
  const platform =
    (window.navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    window.navigator.platform ||
    "";

  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/win/i.test(platform) || /windows/i.test(ua)) return "windows";
  if (/mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) return "mac";
  if (/linux/i.test(platform) || /linux/i.test(ua)) return "linux";
  return "unknown";
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [os, setOs] = useState<OS>("unknown");

  useEffect(() => {
    // 1. Detect operating system
    const detected = detectOS();
    setOs(detected);

    // 2. Check persistent dismissal in localStorage
    try {
      const installed = localStorage.getItem("taskproject_pwa_installed");
      if (installed === "true") {
        setIsDismissed(true);
        return;
      }
      const dismissedAt = localStorage.getItem("taskproject_pwa_dismissed_at");
      if (dismissedAt) {
        const days = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
        if (days < 30) {
          setIsDismissed(true);
          return;
        }
      }
    } catch {
      // Ignore localStorage errors (private browsing, etc.)
    }

    // 3. Check if already installed as standalone PWA
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isStandaloneMode);

    // 4. Register Service Worker
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

    // 5. Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      try {
        localStorage.setItem("taskproject_pwa_installed", "true");
      } catch {}
      toast.success("¡TaskProject se ha instalado en tu dispositivo!");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem("taskproject_pwa_dismissed_at", Date.now().toString());
    } catch {}
  };

  const handleInstallClick = async () => {
    if (os === "ios") {
      toast.info(
        "Para instalar en iPhone/iPad: pulsa el icono Compartir de Safari y selecciona 'Añadir a pantalla de inicio'."
      );
      return;
    }

    if (!deferredPrompt) {
      if (os === "windows" || os === "mac" || os === "linux") {
        toast.info(
          "Para instalar en tu navegador: haz clic en el icono de instalación en la barra de direcciones (a la derecha de la URL) o en el menú del navegador > 'Instalar TaskProject'."
        );
      } else {
        toast.info(
          "Para instalar en Android: pulsa el menú de 3 puntos de Chrome (⋮) y selecciona 'Instalar aplicación' o 'Añadir a pantalla de inicio'."
        );
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === "accepted") {
        try {
          localStorage.setItem("taskproject_pwa_installed", "true");
        } catch {}
        toast.success(
          os === "windows" || os === "mac" || os === "linux"
            ? "Instalando TaskProject en tu equipo..."
            : "Instalando TaskProject en tu móvil..."
        );
      } else {
        toast.info("Instalación pospuesta");
        handleDismiss();
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

  // OS-specific content configuration
  const config = (() => {
    switch (os) {
      case "windows":
        return {
          icon: <Monitor className="w-5 h-5" />,
          title: "Instalar TaskProject en Windows",
          description: "Instala la app en tu PC para abrirla desde el menú Inicio o la barra de tareas a pantalla completa.",
          buttonText: "Instalar en este PC",
        };
      case "mac":
        return {
          icon: <Laptop className="w-5 h-5" />,
          title: "Instalar TaskProject en Mac",
          description: "Instala la app en tu Mac para abrirla desde el Dock o Launchpad a pantalla completa.",
          buttonText: "Instalar en mi Mac",
        };
      case "linux":
        return {
          icon: <Monitor className="w-5 h-5" />,
          title: "Instalar TaskProject en Linux",
          description: "Instala la app en tu equipo para una experiencia nativa y fluida a pantalla completa.",
          buttonText: "Instalar en este equipo",
        };
      case "ios":
        return {
          icon: <Smartphone className="w-5 h-5" />,
          title: "Instalar TaskProject en iPhone",
          description: "Accede a pantalla completa añadiendo TaskProject a tu pantalla de inicio en Safari.",
          buttonText: "Cómo instalar",
        };
      case "android":
      default:
        return {
          icon: <Smartphone className="w-5 h-5" />,
          title: "Instalar TaskProject App",
          description: "Descarga la app en tu Android para acceder rápido y a pantalla completa.",
          buttonText: "Instalar en mi móvil",
        };
    }
  })();

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-5">
      <div className="bg-card/95 backdrop-blur-xl border border-primary/30 p-4 rounded-2xl shadow-2xl text-card-foreground flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d95d39] to-[#e27d5f] flex items-center justify-center text-white shadow-md shrink-0">
              {config.icon}
            </div>
            <div>
              <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                {config.title}
                <Sparkles className="w-3 h-3 text-amber-400" />
              </h4>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {config.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
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
            <span>{config.buttonText}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-xl"
          >
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  );
}
