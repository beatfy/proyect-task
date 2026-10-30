import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { canAccessProject, verifyOrgMembership, getUserOrgIds } from "@/lib/tenant";

export interface TenantAuthContext {
  userId: string;
  permissions: string;
  userOrgIds: string[];
  projectId?: string | null;
  organizationId?: string | null;
}

export interface TenantGuardOptions {
  /** Automatically validate projectId / organizationId from URL searchParams if present */
  validateQueryTenant?: boolean;
  /** Require write/full permissions on API keys */
  requireWritePermission?: boolean;
}

/**
 * Reusable wrapper for Next.js API Route Handlers that enforces authentication
 * and multi-tenant authorization (organization & project membership).
 */
export function withTenantAuth<TParams = Record<string, string>>(
  handler: (
    request: NextRequest,
    auth: TenantAuthContext,
    routeContext: { params: Promise<TParams> }
  ) => Promise<NextResponse>,
  options: TenantGuardOptions = { validateQueryTenant: true }
) {
  return async (
    request: NextRequest,
    routeContext: { params: Promise<TParams> } = { params: Promise.resolve({} as TParams) }
  ): Promise<NextResponse> => {
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (options.requireWritePermission && authResult.permissions === "read") {
      return NextResponse.json(
        { error: "Permisos insuficientes (solo lectura)" },
        { status: 403 }
      );
    }

    const userOrgIds = await getUserOrgIds(authResult.userId);
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const organizationId = searchParams.get("organizationId");

    if (options.validateQueryTenant !== false) {
      if (projectId) {
        const hasProjectAccess = await canAccessProject(authResult.userId, projectId);
        if (!hasProjectAccess) {
          return NextResponse.json(
            { error: "No tienes acceso a este proyecto" },
            { status: 403 }
          );
        }
      }
      if (organizationId) {
        const { valid } = await verifyOrgMembership(authResult.userId, organizationId);
        if (!valid) {
          return NextResponse.json(
            { error: "No tienes acceso a esta organización" },
            { status: 403 }
          );
        }
      }
    }

    return handler(
      request,
      {
        userId: authResult.userId,
        permissions: authResult.permissions,
        userOrgIds,
        projectId,
        organizationId,
      },
      routeContext
    );
  };
}
