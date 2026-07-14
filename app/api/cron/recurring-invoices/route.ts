import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { generateInvoicePDFBuffer } from "@/lib/invoice-pdf";

const CRON_SECRET = process.env.CRON_SECRET;

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export async function GET(request: NextRequest) {
  // 1. Verify cron secret if configured
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  try {
    const now = new Date();
    const todayDay = now.getDate();
    
    // Check if today is the last day of the month
    const isLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();

    // Fetch all active projects with recurring invoices enabled, including organization settings
    const allRecurringProjects = await prisma.project.findMany({
      where: {
        recurringInvoice: true,
        monthlyFee: { gt: 0 },
        status: "ACTIVE",
      },
      include: {
        organization: true,
      },
    });

    // Filter projects whose billing day matches today, or if they are scheduled for the last day and it's today
    const projectsToBill = allRecurringProjects.filter((project) => {
      if (force) return true;
      if (project.billingDay === todayDay) return true;
      // 31 means "last day of the month"
      if (project.billingDay >= 31 && isLastDay) return true;
      return false;
    });

    let invoicesCreated = 0;
    let emailsSent = 0;

    // Calculate billing month (previous month)
    let month = now.getMonth(); // 0-indexed → previous month
    let year = now.getFullYear();
    if (month === 0) {
      month = 12;
      year--;
    }

    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    for (const project of projectsToBill) {
      // Check if invoice already exists for this project + month + year
      const existing = await prisma.invoice.findUnique({
        where: {
          projectId_month_year: {
            projectId: project.id,
            month,
            year,
          },
        },
      });

      if (existing) continue;

      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          id: cuid(),
          projectId: project.id,
          month,
          year,
          amount: project.monthlyFee,
          dueDate,
        },
      });
      invoicesCreated++;

      // Send email if client email is configured
      if (project.clientEmail) {
        if (RESEND_API_KEY) {
          const organization = project.organization;
          const attachments: any[] = [];
          
          if (organization) {
            try {
              const pdfBuffer = await generateInvoicePDFBuffer(invoice, organization);
              attachments.push({
                filename: `factura-${invoice.id.substring(0, 8).toUpperCase()}.pdf`,
                content: pdfBuffer.toString("base64"),
              });
            } catch (pdfErr) {
              console.error(`Failed to generate PDF for project ${project.name}:`, pdfErr);
            }
          }

          const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
              <h2 style="color: #6366f1; margin-top: 0;">Factura Emitida</h2>
              <p>Estimado cliente de <strong>${project.name}</strong>,</p>
              <p style="white-space: pre-line; color: #334155; line-height: 1.5;">${
                project.invoiceEmailMsg ||
                "Le informamos que se ha generado su factura mensual. Encontrará el documento PDF oficial adjunto a este correo electrónico con el desglose correspondiente."
              }</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Concepto:</td>
                    <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #0f172a;">Cuota mensual - ${monthNames[month - 1]} ${year}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Importe:</td>
                    <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #16a34a; font-size: 16px;">${project.monthlyFee.toLocaleString("es-ES", {
                      style: "currency",
                      currency: "EUR",
                    })}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Fecha de Vencimiento:</td>
                    <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #0f172a;">${dueDate.toLocaleDateString("es-ES")}</td>
                  </tr>
                </table>
              </div>
              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
                Esta es una notificación automática de facturación de ${
                  process.env.NEXT_PUBLIC_BRAND_NAME || "Leadfy"
                }. Por favor no responda a este correo.
              </p>
            </div>
          `;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `${process.env.NEXT_PUBLIC_BRAND_NAME || "Leadfy"} Facturación <onboarding@resend.dev>`,
              to: project.clientEmail,
              subject: `Factura mensual - ${project.name} (${monthNames[month - 1]} ${year})`,
              html: emailHtml,
              attachments,
            }),
          })
            .then(async (res) => {
              if (res.ok) {
                emailsSent++;
              } else {
                const errText = await res.text();
                console.error(`Resend API returned error for project ${project.name}:`, errText);
              }
            })
            .catch((err) => {
              console.error(`Failed to send email via Resend for project ${project.name}:`, err);
            });
        } else {
          console.warn(`Resend API key is missing. Skipped sending invoice email for project ${project.name}.`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      invoicesCreated,
      emailsSent,
      processedProjectsCount: projectsToBill.length,
    });
  } catch (error) {
    console.error("[cron/recurring-invoices] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
