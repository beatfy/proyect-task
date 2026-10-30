import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { getUserOrgIds } from "@/lib/tenant";

interface ManualTaskInput {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "NONE";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: dealId } = await params;
    const userOrgIds = await getUserOrgIds(authResult.userId);

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        contact: true,
        stage: true,
        pipeline: true,
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Oportunidad no encontrada" }, { status: 404 });
    }

    const hasAccess =
      deal.ownerId === authResult.userId ||
      (deal.organizationId ? userOrgIds.includes(deal.organizationId) : false);

    if (!hasAccess) {
      return NextResponse.json({ error: "No tienes acceso a esta oportunidad" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    const projectName =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim()
        : deal.title;

    const projectDescription =
      typeof body.description === "string"
        ? body.description.trim() || null
        : deal.notes || null;

    const parsedFee =
      body.monthlyFee !== undefined && body.monthlyFee !== null && body.monthlyFee !== ""
        ? Number(body.monthlyFee)
        : deal.value > 0
          ? deal.value
          : 0;
    const monthlyFee = Number.isFinite(parsedFee) && parsedFee >= 0 ? parsedFee : 0;

    const clientEmail =
      typeof body.clientEmail === "string"
        ? body.clientEmail.trim() || null
        : deal.contact?.email || null;

    const projectColor =
      typeof body.color === "string" && body.color.trim().length > 0
        ? body.color.trim()
        : deal.stage?.color || "#6366f1";

    const manualTasks: ManualTaskInput[] = Array.isArray(body.initialTasks)
      ? body.initialTasks
          .filter(
            (t: unknown): t is ManualTaskInput =>
              Boolean(t && typeof (t as ManualTaskInput).title === "string" && (t as ManualTaskInput).title.trim())
          )
          .map((t: ManualTaskInput) => ({
            title: t.title.trim(),
            description: typeof t.description === "string" ? t.description.trim() : undefined,
            priority: t.priority || "MEDIUM",
          }))
      : [];

    const projectId = cuid();
    const pipelineId = cuid();
    const stageTodoId = cuid();
    const stageInProgressId = cuid();
    const stageReviewId = cuid();
    const stageDoneId = cuid();

    const clientContextLines = [
      `Proyecto creado desde oportunidad CRM: ${deal.title}`,
      deal.contact ? `Cliente: ${deal.contact.name}${deal.contact.company ? ` (${deal.contact.company})` : ""}` : null,
      clientEmail ? `Email de contacto: ${clientEmail}` : null,
      projectDescription ? `\nDescripción / Notas:\n${projectDescription}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          id: projectId,
          name: projectName,
          description: projectDescription,
          color: projectColor,
          status: "ACTIVE",
          monthlyFee,
          clientEmail,
          clientContext: clientContextLines,
          organizationId: deal.organizationId || null,
          members: {
            create: {
              id: cuid(),
              userId: authResult.userId,
              role: "OWNER",
            },
          },
        },
      });

      await tx.taskPipeline.create({
        data: {
          id: pipelineId,
          name: `Tablero ${projectName}`,
          isDefault: true,
          projectId: createdProject.id,
          organizationId: deal.organizationId || null,
          stages: {
            create: [
              { id: stageTodoId, name: "Por hacer", color: "#64748b", position: 0 },
              { id: stageInProgressId, name: "En progreso", color: "#3b82f6", position: 1 },
              { id: stageReviewId, name: "En revisión", color: "#eab308", position: 2 },
              { id: stageDoneId, name: "Hecho", color: "#22c55e", position: 3 },
            ],
          },
        },
      });

      // Only create tasks if the user manually specified them in the dialog
      if (manualTasks.length > 0) {
        await tx.task.createMany({
          data: manualTasks.map((t, idx) => ({
            id: cuid(),
            title: t.title,
            description: t.description || null,
            status: "TODO",
            priority: t.priority || "MEDIUM",
            projectId: createdProject.id,
            creatorId: authResult.userId,
            assigneeId: authResult.userId,
            organizationId: deal.organizationId || null,
            pipelineId,
            stageId: stageTodoId,
            order: idx,
          })),
        });
      }

      if (deal.contactId) {
        await tx.activity.create({
          data: {
            id: cuid(),
            type: "NOTE",
            title: `Convertido en proyecto activo: ${createdProject.name}`,
            description:
              manualTasks.length > 0
                ? `Se creó manualmente el proyecto "${createdProject.name}" con ${manualTasks.length} tarea(s) inicial(es).`
                : `Se creó manualmente el proyecto "${createdProject.name}".`,
            completed: true,
            completedAt: new Date(),
            contactId: deal.contactId,
            dealId: deal.id,
            ownerId: authResult.userId,
            organizationId: deal.organizationId || null,
          },
        });
      }

      return createdProject;
    });

    return NextResponse.json(
      {
        project,
        message: "Proyecto creado manualmente desde la oportunidad con éxito",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error converting deal to project:", error);
    return NextResponse.json(
      { error: "Error al crear el proyecto desde la oportunidad" },
      { status: 500 }
    );
  }
}
