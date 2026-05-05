import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { getUserOrgIds, verifyOrgMembership } from "@/lib/tenant";
import { z } from "zod";

const dealCreateSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  value: z.number().min(0).default(0),
  stageId: z.string().min(1, "La etapa es obligatoria"),
  contactId: z.string().min(1, "El contacto es obligatorio"),
  pipelineId: z.string().min(1),
  probability: z.number().min(0).max(100).default(0),
  expectedClose: z.string().optional(),
  notes: z.string().optional(),
  organizationId: z.string().optional(),
});

const dealUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  value: z.number().min(0).optional(),
  stageId: z.string().min(1).optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedClose: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId");
    const stageId = searchParams.get("stageId");
    const contactId = searchParams.get("contactId");
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

    if (pipelineId) where.pipelineId = pipelineId;
    if (stageId) where.stageId = stageId;
    if (contactId) where.contactId = contactId;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, email: true, company: true } },
        stage: { select: { id: true, name: true, color: true, position: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { movedAt: "desc" },
    });

    return NextResponse.json(deals);
  } catch (error) {
    console.error("Get deals error:", error);
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
    const parsed = dealCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const { title, value, stageId, contactId, pipelineId, probability, expectedClose, notes, organizationId } = parsed.data;

    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    const deal = await prisma.deal.create({
      data: {
        id: cuid(),
        title,
        value,
        stageId,
        contactId,
        pipelineId,
        probability,
        expectedClose: expectedClose ? new Date(expectedClose) : null,
        notes: notes || null,
        ownerId: authResult.userId,
        organizationId: organizationId || null,
      },
      include: {
        contact: { select: { id: true, name: true, email: true, company: true } },
        stage: true,
        _count: { select: { activities: true } },
      },
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error("Create deal error:", error);
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
    const parsed = dealUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const { id, ...data } = parsed.data;

    const existingDeal = await prisma.deal.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!existingDeal) {
      return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    }
    if (existingDeal.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, existingDeal.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a este deal" }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.probability !== undefined) updateData.probability = data.probability;
    if (data.expectedClose !== undefined) updateData.expectedClose = data.expectedClose ? new Date(data.expectedClose) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // When moving to a different stage, update stageId and movedAt
    if (data.stageId !== undefined) {
      updateData.stageId = data.stageId;
      updateData.movedAt = new Date();
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true, email: true, company: true } },
        stage: true,
        _count: { select: { activities: true } },
      },
    });

    return NextResponse.json(deal);
  } catch (error) {
    console.error("Update deal error:", error);
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

    const deal = await prisma.deal.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Deal no encontrado" }, { status: 404 });
    }
    if (deal.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, deal.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a este deal" }, { status: 403 });
      }
    }

    await prisma.deal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete deal error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
