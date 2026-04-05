import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const { invitationId, orgName, inviterName } = await request.json();

    if (!invitationId) {
      return NextResponse.json({ error: "invitationId requerido" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://task-x-2.vercel.app";
    const inviteUrl = `${appUrl}/join/${invitationId}`;

    const targetName = orgName || "TaskX";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Has sido invitado a ${targetName}</h1>
        </div>
        <div style="padding: 32px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            <strong>${inviterName}</strong> te ha invitado a unirte a la organización <strong>${targetName}</strong> en TaskX.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}" style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
              Aceptar invitación
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            O copia este enlace en tu navegador:<br/>
            <a href="${inviteUrl}" style="color: #6366f1; word-break: break-all;">${inviteUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Esta invitación expira en 7 días. Si no esperabas este email, ignóralo.
          </p>
        </div>
      </div>
    `;

    // Try Resend first, then fall back to just logging
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (RESEND_API_KEY) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TaskX <noreply@task-x-2.vercel.app>",
          to: [invitation.email],
          subject: `${inviterName} te ha invitado a ${targetName}`,
          html,
        }),
      });

      if (!resendRes.ok) {
        const err = await resendRes.text();
        console.error("Resend error:", err);
        return NextResponse.json({ error: "Error enviando email", details: err }, { status: 500 });
      }

      return NextResponse.json({ success: true, sent: true });
    }

    // No email service configured — return invite URL for manual sharing
    console.log(`[INVITE] No RESEND_API_KEY. Invite URL for ${invitation.email}: ${inviteUrl}`);
    return NextResponse.json({ success: true, sent: false, inviteUrl, message: "Email no configurado. Comparte el enlace manualmente." });
  } catch (error) {
    console.error("Send invite email error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
