import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateOrgApiKey, apiError } from "@/lib/org-api-auth";

export async function GET(request: NextRequest) {
  const auth = await authenticateOrgApiKey(request);
  if (!auth) return apiError("Unauthorized. Provide Bearer <org_api_key>", 401);

  const pipelines = await prisma.pipeline.findMany({
    where: { organizationId: auth.organizationId },
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: {
          deals: {
            include: {
              contact: { select: { id: true, name: true, email: true, company: true } },
              _count: { select: { activities: true } },
            },
            orderBy: { movedAt: "desc" },
          },
          _count: { select: { deals: true } },
        },
      },
      _count: { select: { deals: true } },
    },
  });

  return Response.json({ pipelines });
}
