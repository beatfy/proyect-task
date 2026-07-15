import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/api-auth";
import nodemailer from "nodemailer";

// POST /api/mail/send - Send an email via SMTP
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { to, subject, body: textBody, html } = body;

    if (!to || (!textBody && !html)) {
      return NextResponse.json(
        { error: "El destinatario (to) y el cuerpo del mensaje son requeridos" },
        { status: 400 }
      );
    }

    // Load email config
    const config = await prisma.emailConfig.findUnique({
      where: { userId: authResult.userId },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Correo electrónico no configurado. Ve a Configuración de Mail para conectar tu cuenta." },
        { status: 400 }
      );
    }

    // Decrypt password
    const { decrypt } = await import("@/lib/email-crypto");
    let password = "";
    try {
      password = decrypt(config.encryptedPassword);
    } catch (cryptoErr) {
      console.error("[mail/send] Decryption error:", cryptoErr);
      return NextResponse.json(
        { error: "Error de configuración de seguridad. Vuelve a guardar tus credenciales de correo." },
        { status: 500 }
      );
    }

    // Resolve SMTP settings
    let smtpHost = config.smtpHost;
    if (!smtpHost) {
      // Guess SMTP host based on IMAP host
      smtpHost = config.host.replace(/^imap\./i, "smtp.");
      if (config.host.includes("outlook") || config.host.includes("office365")) {
        smtpHost = "smtp.office365.com";
      }
    }

    const smtpPort = config.smtpPort || 587;
    const smtpSecure = config.smtpSecure !== null ? config.smtpSecure : (smtpPort === 465);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: config.email,
        pass: password,
      },
      tls: {
        rejectUnauthorized: false, // Prevents certificate verification errors
      },
    });

    // Send mail
    const mailOptions = {
      from: config.email,
      to,
      subject: subject || "(Sin asunto)",
      text: textBody || "",
      html: html || undefined,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: "Correo enviado exitosamente" });
  } catch (err: any) {
    console.error("[mail/send] SMTP send error:", err);
    return NextResponse.json(
      { error: err.message || "Error al enviar el correo vía SMTP. Verifica tu configuración." },
      { status: 500 }
    );
  }
}
