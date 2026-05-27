import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { getUserOrgIds, verifyOrgMembership } from "@/lib/tenant";
import { z } from "zod";

const activityCreateSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "TASK", "NOTE"]),
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  contactId: z.string().min(1),
  dealId: z.string().optional(),
  organizationId: z.string().optional(),
});

const activityUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  completed: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");
    const dealId = searchParams.get("dealId");
    const type = searchParams.get("type");
    const organizationId = searchParams.get("organizationId");

    const userOrgIds = await getUserOrgIds(authResult.userId);

    const where: Record<string, unknown> = {};

    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
      where.organizationId = organizationId;
    } else {
      where.OR = [
        { organizationId: { in: userOrgIds } },
        { ownerId: authResult.userId, organizationId: null },
      ];
    }

    if (contactId) where.contactId = contactId;
    if (dealId) where.dealId = dealId;
    if (type) where.type = type;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Get activities error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = activityCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const { type, title, description, dueDate, contactId, dealId, organizationId } = parsed.data;

    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    const activity = await prisma.activity.create({
      data: {
        id: cuid(),
        type,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        contactId,
        dealId: dealId || null,
        ownerId: authResult.userId,
        organizationId: organizationId || null,
      },
      include: {
        contact: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Create activity error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = activityUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const { id, ...data } = parsed.data;

    const existingActivity = await prisma.activity.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!existingActivity) {
      return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
    }
    if (existingActivity.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, existingActivity.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta actividad" }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.completed !== undefined) {
      updateData.completed = data.completed;
      updateData.completedAt = data.completed ? new Date() : null;
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error("Update activity error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const activity = await prisma.activity.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!activity) {
      return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
    }
    if (activity.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, activity.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta actividad" }, { status: 403 });
      }
    }

    await prisma.activity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete activity error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
