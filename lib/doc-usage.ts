import { prisma } from "@/lib/prisma";

export async function logDocToolCall(
  userId: string,
  pathname: string,
  method: string,
  organizationId: string | null = null
) {
  try {
    let toolName = "unknown_api_call";
    
    // Normalize path (remove query params, trailing slashes)
    const cleanPath = pathname.split("?")[0].replace(/\/$/, "");
    
    if (cleanPath.startsWith("/api/v1/fasting")) {
      if (cleanPath.endsWith("/status")) {
        toolName = method === "POST" ? "update_fasting_config" : "get_fasting_status";
      } else if (cleanPath.endsWith("/start")) {
        toolName = "start_fasting";
      } else if (cleanPath.endsWith("/end")) {
        toolName = "end_fasting";
      } else if (cleanPath.endsWith("/history")) {
        toolName = "get_fasting_history";
      } else if (cleanPath.endsWith("/water")) {
        toolName = "log_fasting_water";
      } else {
        toolName = "fasting_api";
      }
    } else if (cleanPath.startsWith("/api/v1/focus/tasks")) {
      const parts = cleanPath.split("/");
      if (parts.length > 5) { // /api/v1/focus/tasks/[id]
        toolName = method === "DELETE" ? "delete_focus_task" : "update_focus_task";
      } else {
        toolName = method === "POST" ? "create_focus_task" : "get_focus_tasks";
      }
    } else if (cleanPath === "/api/v1/focus/primer") {
      toolName = "get_focus_primer";
    } else if (cleanPath === "/api/v1/projects") {
      toolName = method === "POST" ? "create_project" : "list_projects";
    } else if (cleanPath.startsWith("/api/v1/tasks")) {
      const parts = cleanPath.split("/");
      if (parts.length > 4 && parts[parts.length - 1] === "micro-split") {
        toolName = "micro_split_task";
      } else if (parts.length > 4) { // /api/v1/tasks/[id]
        toolName = method === "DELETE" ? "delete_task" : "update_task";
      } else {
        toolName = method === "POST" ? "create_task" : "list_tasks";
      }
    } else if (cleanPath.startsWith("/api/v1/contacts")) {
      const parts = cleanPath.split("/");
      if (parts.length > 4) {
        toolName = method === "DELETE" ? "delete_contact" : "update_contact";
      } else {
        toolName = method === "POST" ? "create_contact" : "list_contacts";
      }
    } else if (cleanPath.startsWith("/api/v1/deals")) {
      toolName = method === "POST" ? "create_deal" : "list_deals";
    } else if (cleanPath === "/api/v1/pipeline") {
      toolName = "get_pipeline";
    } else {
      // General fallback formatting
      const suffix = cleanPath.replace("/api/v1/", "").replace(/\//g, "_");
      toolName = `${method.toLowerCase()}_${suffix || "api"}`;
    }

    let finalOrgId = organizationId;
    if (!finalOrgId) {
      const member = await prisma.organizationMember.findFirst({
        where: { userId },
        select: { organizationId: true },
        orderBy: { joinedAt: "asc" },
      });
      finalOrgId = member?.organizationId || null;
    }

    await prisma.taskyUsage.create({
      data: {
        userId,
        organizationId: finalOrgId,
        prompt: "doc_tool_call",
        toolsUsed: [toolName],
        duration: 0,
      },
    });
  } catch (err) {
    console.error("Error logging Doc tool call:", err);
  }
}
