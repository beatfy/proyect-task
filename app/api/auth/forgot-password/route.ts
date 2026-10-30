import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { Resend } from "resend";
import { brand } from "@/lib/branding";
import { rateLimit } from "@/lib/rate-limit";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed: ipAllowed } = await rateLimit(`forgot-pw-ip:${ip}`);
    if (!ipAllowed) {
      return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
    }

    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ success: true });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { allowed: emailAllowed } = await rateLimit(`forgot-pw-email:${normalizedEmail}`);
    if (!emailAllowed) {
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
      const domainName = brand.name.toLowerCase().replace(/\s+/g, "");

      await getResend().emails.send({
        from: `${brand.name} <noreply@${domainName}.app>`,
        to: user.email,
        subject: `Reset your ${brand.name} password`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Reset your password</h2>
            <p>We received a request to reset your ${brand.name} password.</p>
            <p>Click the button below to set a new password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    }

    // Always return success to avoid revealing if email exists
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ success: true });
  }
}
