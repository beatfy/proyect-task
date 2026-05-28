import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized. Provide Bearer <org_api_key>", 401);

  const { searchParams } = new URL(request.url);
  const dealId = searchParams.get("id");
  const stageId = searchParams.get("stageId");

  if (dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, organizationId: auth.organizationId },
      include: {
        contact: { select: { id: true, name: true, email: true, company: true } },
        stage: { select: { id: true, name: true, color: true } },
        activities: { select: { id: true, type: true, title: true, createdAt: true } },
      },
    });
    if (!deal) return apiError("Deal no encontrado", 404);
    return Response.json(deal);
  }

  const where: Record<string, unknown> = { organizationId: auth.organizationId };
  if (stageId) where.stageId = stageId;

  const deals = await prisma.deal.findMany({
    where,
    include: {
      contact: { select: { id: true, name: true, email: true, company: true } },
      stage: { select: { id: true, name: true, color: true, position: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { movedAt: "desc" },
    take: 100,
  });

  return Response.json({ deals });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { title, value, stageId, contactId, pipelineId, probability, expectedClose, notes } = body;

  if (!title || !stageId) return apiError("title y stageId son requeridos", 400);

  const deal = await prisma.deal.create({
    data: {
      id: cuid(),
      title,
      value: value || 0,
      stageId,
      contactId: contactId || undefined,
      pipelineId: pipelineId || undefined,
      probability: probability || 0,
      expectedClose: expectedClose ? new Date(expectedClose) : null,
      notes: notes || null,
      organizationId: auth.organizationId,
    },
    include: {
      contact: { select: { id: true, name: true } },
      stage: { select: { name: true, color: true } },
    },
  });

  return Response.json(deal, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { id, title, value, stageId, probability, expectedClose, notes } = body;

  if (!id) return apiError("id es requerido", 400);

  const existing = await prisma.deal.findFirst({
    where: { id, organizationId: auth.organizationId },
  });
  if (!existing) return apiError("Deal no encontrado", 404);

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (value !== undefined) data.value = value;
  if (stageId !== undefined) { data.stageId = stageId; data.movedAt = new Date(); }
  if (probability !== undefined) data.probability = probability;
  if (expectedClose !== undefined) data.expectedClose = expectedClose ? new Date(expectedClose) : null;
  if (notes !== undefined) data.notes = notes;

  const deal = await prisma.deal.update({ where: { id }, data, include: { stage: true, contact: { select: { name: true } } } });

  return Response.json(deal);
}
