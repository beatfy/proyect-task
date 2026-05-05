import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";
import { getUserOrgIds, verifyOrgMembership } from "@/lib/tenant";
import { z } from "zod";

const contactCreateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["LEAD", "CONTACTED", "QUALIFIED", "CUSTOMER"]).default("LEAD"),
  pipelineId: z.string().optional(),
  organizationId: z.string().optional(),
});

const contactUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["LEAD", "CONTACTED", "QUALIFIED", "CUSTOMER"]).optional(),
  pipelineId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase() || "";
    const status = searchParams.get("status");
    const tag = searchParams.get("tag");
    const organizationId = searchParams.get("organizationId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

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

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (tag) {
      where.tags = { has: tag };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          pipeline: { select: { id: true, name: true } },
          _count: { select: { deals: true, activities: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({ contacts, total, page, limit });
  } catch (error) {
    console.error("Get contacts error:", error);
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
    const parsed = contactCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const { name, email, phone, company, notes, tags, status, pipelineId, organizationId } = parsed.data;

    if (organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a esta organización" }, { status: 403 });
      }
    }

    const contact = await prisma.contact.create({
      data: {
        id: cuid(),
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        notes: notes || null,
        tags,
        status,
        pipelineId: pipelineId || null,
        ownerId: authResult.userId,
        organizationId: organizationId || null,
      },
      include: {
        pipeline: { select: { id: true, name: true } },
        _count: { select: { deals: true, activities: true } },
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("Create contact error:", error);
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
    const parsed = contactUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const { id, ...data } = parsed.data;
    const updateData: Record<string, unknown> = {};

    const existingContact = await prisma.contact.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!existingContact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }
    if (existingContact.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, existingContact.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a este contacto" }, { status: 403 });
      }
    }

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email === "" ? null : data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.company !== undefined) updateData.company = data.company;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.pipelineId !== undefined) updateData.pipelineId = data.pipelineId;

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        pipeline: { select: { id: true, name: true } },
        _count: { select: { deals: true, activities: true } },
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Update contact error:", error);
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

    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
    }
    if (contact.organizationId) {
      const { valid } = await verifyOrgMembership(authResult.userId, contact.organizationId);
      if (!valid) {
        return NextResponse.json({ error: "No tienes acceso a este contacto" }, { status: 403 });
      }
    }

    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete contact error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
