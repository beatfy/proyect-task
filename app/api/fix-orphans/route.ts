import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time fix: assign orphan projects to first organization
// DELETE THIS FILE AFTER RUNNING
export async function POST() {
  try {
    const org = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!org) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const orphans = await prisma.project.findMany({
      where: { organizationId: null },
      select: { id: true, name: true },
    });

    if (orphans.length === 0) {
      return NextResponse.json({ message: "No orphan projects found", org: org.name });
    }

    const result = await prisma.project.updateMany({
      where: { organizationId: null },
      data: { organizationId: org.id },
    });

    return NextResponse.json({
      message: `Assigned ${result.count} projects to ${org.name}`,
      org: { id: org.id, name: org.name },
      orphanProjects: orphans,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Fix orphan projects error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
