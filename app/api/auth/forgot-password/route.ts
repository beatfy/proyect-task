import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.findUnique({ where: { email } });

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

      await resend.emails.send({
        from: "TaskX <noreply@taskx.app>",
        to: email,
        subject: "Reset your TaskX password",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Reset your password</h2>
            <p>We received a request to reset your TaskX password.</p>
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
