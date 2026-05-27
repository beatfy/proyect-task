"use client";

import { useState, useEffect } from "react";
import { UserPlus, Check, X, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  project: {
    id: string;
    name: string;
    description: string | null;
    color: string;
  };
  inviter: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function InvitationsList() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setError(null);
      const res = await fetch("/api/invitations");
      const data = await res.json();
      
      // Si es un array, usarlo; si es un objeto con error, mostrar vacío
      if (Array.isArray(data)) {
        setInvitations(data);
      } else {
        setInvitations([]);
        if (data.error) {
          setError(data.error);
        }
      }
    } catch (err) {
      console.error("Error fetching invitations:", err);
      setInvitations([]);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleInvitation = async (id: string, action: "accept" | "reject") => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Error al procesar invitación");
        return;
      }

      // Remove from list
      setInvitations((prev) => prev.filter((i) => i.id !== id));

      if (action === "accept" && data.projectId) {
        // Redirect to project
        window.location.href = `/projects/${data.projectId}`;
      }
    } catch (err) {
      console.error("Error handling invitation:", err);
      alert("Error de conexión");
    } finally {
      setProcessingId(null);
    }
  };

  const getDaysLeft = (expiresAt: string) => {
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expires.getTime() - now.getTime()) / 86400000);
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchInvitations}>Reintentar</Button>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center p-8">
        <Mail className="h-12 w-12 mx-auto mb-3 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          No tienes invitaciones pendientes
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Cuando alguien te invite a un proyecto, aparecerá aquí
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold mb-4">
        Invitaciones pendientes ({invitations.length})
      </h2>

      {invitations.map((invitation) => {
        const daysLeft = getDaysLeft(invitation.expiresAt);
        const isProcessing = processingId === invitation.id;

        return (
          <div
            key={invitation.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-start gap-4">
              {/* Project icon */}
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: invitation.project.color }}
              >
                {invitation.project.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {invitation.project.name}
                </h3>
                {invitation.project.description && (
                  <p className="text-sm text-gray-500 mt-1">
                    {invitation.project.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <UserPlus className="h-3 w-3" />
                  <span>
                    Invitado por {invitation.inviter.name || invitation.inviter.email}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <Clock className="h-3 w-3" />
                  <span>
                    {daysLeft > 0 ? `${daysLeft} días` : "Expira hoy"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleInvitation(invitation.id, "accept")}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Aceptar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInvitation(invitation.id, "reject")}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4 mr-1" />
                  Rechazar
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}