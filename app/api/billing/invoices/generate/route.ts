import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const month = Number(body.month) || new Date().getMonth() + 1;
    const year = Number(body.year) || new Date().getFullYear();

    // Get all projects with monthlyFee > 0 that user belongs to
    const projects = await prisma.project.findMany({
      where: {
        monthlyFee: { gt: 0 },
        members: { some: { userId: session.user.id } },
      },
    });

    const dueDate = new Date(year, month, 15); // due on 15th of the month

    const results = [];

    for (const project of projects) {
      try {
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
        results.push({ projectId: project.id, status: "created", invoice });
      } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
          results.push({ projectId: project.id, status: "already_exists" });
        } else {
          results.push({ projectId: project.id, status: "error", error: String(error) });
        }
      }
    }

    return NextResponse.json({ month, year, results });
  } catch (error) {
    console.error("Generate invoices error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
