import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { Resend } from "resend";
import { brand } from "@/lib/branding";

const CRON_SECRET = process.env.CRON_SECRET;

const resend = new Resend(process.env.RESEND_API_KEY);

function getPriorityLabel(priority: string) {
  switch (priority) {
    case "NONE": return { text: "Ninguna", color: "#6b7280", bg: "#f3f4f6" };
    case "LOW": return { text: "Baja", color: "#1e3a8a", bg: "#dbeafe" };
    case "MEDIUM": return { text: "Media", color: "#78350f", bg: "#fef3c7" };
    case "HIGH": return { text: "Alta", color: "#7c2d12", bg: "#ffedd5" };
    case "URGENT": return { text: "Urgente", color: "#7f1d1d", bg: "#fee2e2" };
    default: return { text: priority, color: "#374151", bg: "#e5e7eb" };
  }
}

function formatDate(date: Date) {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Madrid"
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid"
  });
}

// Helper to send email and catch error
async function sendEmailSafely({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const fromAddress =
      process.env.RESEND_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      `${brand.name} <onboarding@resend.dev>`;

    const res = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    });
    if (res.error) {
      console.error(`Resend error sending to ${to}:`, res.error);
      return { success: false, error: res.error.message || JSON.stringify(res.error) };
    }
    return { success: true };
  } catch (err: any) {
    console.error(`Resend catch error sending to ${to}:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const forceNearExpiry = searchParams.get("forceNearExpiry") === "true";
  const forceDailySummary = searchParams.get("forceDailySummary") === "true";
  const skipDailySummary = searchParams.get("skipDailySummary") === "true";
  const testEmail = searchParams.get("testEmail");

  const results = {
    nearExpiryEmailsSent: 0,
    dailySummaryEmailsSent: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    
    // ==========================================
    // 1) NEAR EXPIRY REMINDERS
    // ==========================================
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Find all tasks that are due in the next 24 hours and not completed
    const tasksNearExpiry = await prisma.task.findMany({
      where: {
        status: { not: "DONE" },
        dueDate: {
          gt: now,
          lte: twentyFourHoursLater,
        },
      },
      include: {
        project: true,
        taskAssignees: {
          include: {
            user: true,
          },
        },
        creator: true,
        assignee: true,
      },
    });

    for (const task of tasksNearExpiry) {
      // Collect recipient users: main assignee, multiple assignees, fallback to creator
      const recipients = new Map<string, { email: string; name: string | null }>();
      
      if (task.assignee) {
        recipients.set(task.assignee.id, { email: task.assignee.email, name: task.assignee.name });
      }
      
      if (task.taskAssignees && task.taskAssignees.length > 0) {
        for (const ta of task.taskAssignees) {
          if (ta.user) {
            recipients.set(ta.user.id, { email: ta.user.email, name: ta.user.name });
          }
        }
      }
      
      // If no assignees, notify the creator
      if (recipients.size === 0 && task.creator) {
        recipients.set(task.creator.id, { email: task.creator.email, name: task.creator.name });
      }

      const priority = getPriorityLabel(task.priority);
      const projectColor = task.project?.color || "#6366f1";
      const formattedDueDate = task.dueDate ? `${formatDate(task.dueDate)} a las ${formatTime(task.dueDate)}` : "Sin fecha";

      for (const [userId, userInfo] of recipients.entries()) {
        // Check if already notified for near expiry of this task
        const alreadyNotified = await prisma.notification.findFirst({
          where: {
            userId,
            type: "TASK_NEAR_EXPIRY_EMAIL",
            data: { path: ["taskId"], equals: task.id },
          },
        });

        if (alreadyNotified && !forceNearExpiry) continue;

        // Build HTML template
        const emailHtml = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e5e7eb;">
              <!-- Header -->
              <div style="background-color: ${brand.primaryColor || "#6366f1"}; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">⏰ Recordatorio de Vencimiento</h1>
                <p style="color: #e0e7ff; margin: 5px 0 0 0; font-size: 14px;">Tienes una tarea próxima a vencer en las próximas horas.</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <p style="font-size: 16px; line-height: 1.5; color: #4b5563; margin-top: 0;">
                  Hola <strong>${userInfo.name || "Usuario"}</strong>,
                </p>
                <p style="font-size: 16px; line-height: 1.5; color: #4b5563;">
                  Te recordamos que la siguiente tarea está cerca de expirar:
                </p>
                
                <!-- Task Details Card -->
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid ${projectColor};">
                  <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #111827; font-weight: 600;">${task.title}</h3>
                  
                  ${task.description ? `<p style="margin: 0 0 15px 0; font-size: 14px; color: #6b7280; line-height: 1.4;">${task.description}</p>` : ""}
                  
                  <table style="width: 100%; font-size: 14px; color: #4b5563; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600; width: 120px;">Vencimiento:</td>
                      <td style="padding: 4px 0; color: #ef4444; font-weight: 600;">${formattedDueDate}</td>
                    </tr>
                    ${task.project ? `
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600;">Proyecto:</td>
                      <td style="padding: 4px 0;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${projectColor}; margin-right: 6px;"></span>
                        ${task.project.name}
                      </td>
                    </tr>
                    ` : ""}
                    <tr>
                      <td style="padding: 4px 0; font-weight: 600;">Prioridad:</td>
                      <td style="padding: 4px 0;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; background-color: ${priority.bg}; color: ${priority.color};">
                          ${priority.text}
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Call to Action -->
                <div style="text-align: center; margin: 30px 0 10px 0;">
                  <a href="${brand.appUrl}/tasks?taskId=${task.id}" style="background-color: ${brand.primaryColor || "#6366f1"}; color: #ffffff; padding: 12px 30px; font-weight: bold; border-radius: 6px; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(99,102,241,0.2);">
                    Ir al tablero de tareas
                  </a>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
                Este es un correo automático enviado por ${brand.name}. Por favor no respondas a este mensaje.
              </div>
            </div>
          </div>
        `;

        const sentResult = await sendEmailSafely({
          to: testEmail || userInfo.email,
          subject: `⚠️ Tarea cerca de vencer: ${task.title}`,
          html: emailHtml,
        });

        if (sentResult.success) {
          await prisma.notification.create({
            data: {
              id: cuid(),
              userId,
              type: "TASK_NEAR_EXPIRY_EMAIL",
              title: `Email sent: Task close to expiry`,
              content: `Se envió un correo electrónico de recordatorio para la tarea "${task.title}"`,
              data: { taskId: task.id },
            },
          });
          results.nearExpiryEmailsSent++;
        } else {
          results.errors.push(
            `Failed to send near-expiry email to ${userInfo.email} for task ${task.id}: ${sentResult.error}`
          );
        }
      }
    }

    // ==========================================
    // 2) DAILY SUMMARY
    // ==========================================
    // Run daily summary unless explicitly skipped (each user only gets 1 email per day due to notification check)
    if (!skipDailySummary || forceDailySummary) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Fetch all active users
      const users = await prisma.user.findMany();

      // Fetch all tasks due today or overdue, not done
      const allPendingTasks = await prisma.task.findMany({
        where: {
          status: { not: "DONE" },
          dueDate: {
            lte: todayEnd,
          },
        },
        include: {
          project: true,
          taskAssignees: true,
        },
      });

      const formattedToday = new Date().toLocaleDateString("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Europe/Madrid",
      });

      for (const user of users) {
        // Check if daily summary has already been sent to this user today
        const alreadySent = await prisma.notification.findFirst({
          where: {
            userId: user.id,
            type: "DAILY_SUMMARY_EMAIL",
            createdAt: {
              gte: todayStart,
            },
          },
        });

        if (alreadySent && !forceDailySummary) continue;

        // Find user's tasks from the pending list
        // Include tasks where:
        // - user.id is the main assignee (assigneeId)
        // - user.id is in taskAssignees
        // - user.id is the creator (creatorId)
        const userTasks = allPendingTasks.filter((task) => {
          const isMainAssignee = task.assigneeId === user.id;
          const isCoAssignee = task.taskAssignees?.some((ta) => ta.userId === user.id) || false;
          const isCreator = task.creatorId === user.id;
          return isMainAssignee || isCoAssignee || isCreator;
        });

        // Filter into due today vs overdue
        const dueToday = userTasks.filter(
          (t) => t.dueDate && t.dueDate >= todayStart && t.dueDate <= todayEnd
        );
        const overdue = userTasks.filter((t) => t.dueDate && t.dueDate < todayStart);

        // Build HTML template
        let tasksHtml = "";

        if (userTasks.length === 0) {
          tasksHtml = `
            <div style="text-align: center; padding: 30px; background-color: #f0fdf4; border-radius: 8px; border: 1px dashed #bbf7d0;">
              <span style="font-size: 32px;">🎉</span>
              <h3 style="margin: 10px 0 5px 0; color: #166534; font-size: 18px;">¡Estás al día!</h3>
              <p style="margin: 0; color: #15803d; font-size: 14px;">No tienes ninguna tarea pendiente o atrasada para hoy.</p>
            </div>
          `;
        } else {
          if (dueToday.length > 0) {
            tasksHtml += `
              <h3 style="color: #374151; font-size: 16px; margin: 25px 0 10px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">📅 Para Hoy (${dueToday.length})</h3>
              <div style="margin-bottom: 20px;">
            `;
            for (const t of dueToday) {
              const priority = getPriorityLabel(t.priority);
              const projColor = t.project?.color || "#6366f1";
              tasksHtml += `
                <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 10px; display: table; width: 100%; box-sizing: border-box;">
                  <div style="display: table-cell; vertical-align: middle;">
                    <div style="font-weight: 600; color: #111827; font-size: 15px;">${t.title}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                      ${t.project ? `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${projColor}; margin-right: 4px;"></span> ${t.project.name} &bull; ` : ""}
                      Vence hoy a las ${formatTime(t.dueDate!)}
                    </div>
                  </div>
                  <div style="display: table-cell; text-align: right; vertical-align: middle; width: 80px;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background-color: ${priority.bg}; color: ${priority.color};">
                      ${priority.text}
                    </span>
                  </div>
                </div>
              `;
            }
            tasksHtml += `</div>`;
          }

          if (overdue.length > 0) {
            tasksHtml += `
              <h3 style="color: #ef4444; font-size: 16px; margin: 25px 0 10px 0; border-bottom: 1px solid #fee2e2; padding-bottom: 5px;">🚨 Atrasadas (${overdue.length})</h3>
              <div style="margin-bottom: 20px;">
            `;
            for (const t of overdue) {
              const priority = getPriorityLabel(t.priority);
              const projColor = t.project?.color || "#6366f1";
              tasksHtml += `
                <div style="background-color: #ffffff; border: 1px solid #fee2e2; border-radius: 8px; padding: 15px; margin-bottom: 10px; display: table; width: 100%; box-sizing: border-box;">
                  <div style="display: table-cell; vertical-align: middle;">
                    <div style="font-weight: 600; color: #991b1b; font-size: 15px;">${t.title}</div>
                    <div style="font-size: 12px; color: #ef4444; margin-top: 4px; font-weight: 500;">
                      ${t.project ? `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${projColor}; margin-right: 4px;"></span> ${t.project.name} &bull; ` : ""}
                      Venció el ${formatDate(t.dueDate!)}
                    </div>
                  </div>
                  <div style="display: table-cell; text-align: right; vertical-align: middle; width: 80px;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background-color: ${priority.bg}; color: ${priority.color};">
                      ${priority.text}
                    </span>
                  </div>
                </div>
              `;
            }
            tasksHtml += `</div>`;
          }
        }

        const emailHtml = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; color: #1f2937;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e5e7eb;">
              <!-- Header -->
              <div style="background-color: ${brand.primaryColor || "#6366f1"}; padding: 35px 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: -0.5px;">📋 Resumen Diario de Tareas</h1>
                <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 15px; font-weight: 500;">${formattedToday}</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px; background-color: #fafbfa;">
                <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-top: 0;">
                  Hola <strong>${user.name || "Usuario"}</strong>,
                </p>
                <p style="font-size: 16px; line-height: 1.5; color: #4b5563; margin-bottom: 25px;">
                  Este es tu resumen diario de tareas pendientes y atrasadas para hoy en <strong>${brand.name}</strong>.
                </p>
                
                ${tasksHtml}

                <!-- Call to Action -->
                <div style="text-align: center; margin: 35px 0 10px 0;">
                  <a href="${brand.appUrl}/tasks" style="background-color: ${brand.primaryColor || "#6366f1"}; color: #ffffff; padding: 12px 30px; font-weight: bold; border-radius: 6px; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(99,102,241,0.2);">
                    Ir a mis tareas
                  </a>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
                Este correo fue enviado de forma automática por ${brand.name} a ${user.email}. Por favor no respondas a este mensaje.
              </div>
            </div>
          </div>
        `;

        const sentResult = await sendEmailSafely({
          to: testEmail || user.email,
          subject: `📅 Resumen de tus tareas para hoy - ${brand.name}`,
          html: emailHtml,
        });

        if (sentResult.success) {
          await prisma.notification.create({
            data: {
              id: cuid(),
              userId: user.id,
              type: "DAILY_SUMMARY_EMAIL",
              title: `Email sent: Daily task summary`,
              content: `Se envió el correo resumen diario de tareas`,
              data: { taskCount: userTasks.length },
            },
          });
          results.dailySummaryEmailsSent++;
        } else {
          results.errors.push(
            `Failed to send daily summary email to ${user.email}: ${sentResult.error}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[cron/email-reminders] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
