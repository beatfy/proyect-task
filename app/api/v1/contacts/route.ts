import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";
import { cuid } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized. Provide Bearer <org_api_key>", 401);

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("id");
  const search = searchParams.get("search");

  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: auth.organizationId },
      include: {
        _count: { select: { deals: true, activities: true } },
        deals: { select: { id: true, title: true, value: true, stage: { select: { name: true, color: true } } } },
      },
    });
    if (!contact) return apiError("Contacto no encontrado", 404);
    return Response.json(contact);
  }

  const where: Record<string, unknown> = { organizationId: auth.organizationId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true, name: true, email: true, phone: true, company: true, status: true, tags: true, createdAt: true,
      _count: { select: { deals: true, activities: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return Response.json({ contacts });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { name, email, phone, company, notes, tags, status } = body;

  if (!name) return apiError("name es requerido", 400);

  const contact = await prisma.contact.create({
    data: {
      id: cuid(),
      name,
      email: email || null,
      phone: phone || null,
      company: company || null,
      notes: notes || null,
      tags: tags || [],
      status: status || "LEAD",
      organizationId: auth.organizationId,
    },
  });

  return Response.json(contact, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const body = await request.json();
  const { id, name, email, phone, company, notes, tags, status } = body;

  if (!id) return apiError("id es requerido", 400);

  const existing = await prisma.contact.findFirst({
    where: { id, organizationId: auth.organizationId },
  });
  if (!existing) return apiError("Contacto no encontrado", 404);

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (company !== undefined) data.company = company || null;
  if (notes !== undefined) data.notes = notes || null;
  if (tags !== undefined) data.tags = tags;
  if (status !== undefined) data.status = status;

  const contact = await prisma.contact.update({ where: { id }, data });

  return Response.json(contact);
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return apiError("id es requerido", 400);

  const existing = await prisma.contact.findFirst({
    where: { id, organizationId: auth.organizationId },
  });
  if (!existing) return apiError("Contacto no encontrado", 404);

  await prisma.contact.delete({ where: { id } });

  return Response.json({ success: true });
}
