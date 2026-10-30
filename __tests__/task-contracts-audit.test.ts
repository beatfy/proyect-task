import { NextRequest } from "next/server";
import { GET as taskGet, PATCH as taskPatch, DELETE as taskDelete } from "@/app/api/tasks/[id]/route";
import { GET as taskHistoryGet } from "@/app/api/tasks/[id]/history/route";
import { POST as taskRestorePost } from "@/app/api/tasks/[id]/restore/route";
import { hasModulePermission } from "@/lib/authz";
import { normalizeCanonicalStatus } from "@/lib/task-status";

jest.mock("@/lib/api-auth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/lib/authz", () => {
  const actual = jest.requireActual("@/lib/authz");
  return {
    ...actual,
    canAccessTask: jest.fn(),
    canModifyTask: jest.fn(),
  };
});

jest.mock("@/lib/prisma", () => {
  const mockPrisma: any = {
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    taskAuditLog: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    taskPipelineStage: {
      findUnique: jest.fn(),
    },
    taskPipeline: {
      findFirst: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { authenticateRequest } from "@/lib/api-auth";
import { canAccessTask, canModifyTask } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const mockAuth = authenticateRequest as unknown as jest.Mock;
const mockCanAccess = canAccessTask as unknown as jest.Mock;
const mockCanModify = canModifyTask as unknown as jest.Mock;

describe("Task API Contracts & Robustness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Punto 2 & 3: Contracts & Elimination of 404 HTML / Traps", () => {
    it("GET /api/tasks/[id] returns 404 JSON (NOT HTML) when task is missing", async () => {
      mockAuth.mockResolvedValue({ userId: "u-1" });
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/tasks/non-existent-task");
      const res = await taskGet(req, { params: Promise.resolve({ id: "non-existent-task" }) });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toHaveProperty("error", "Tarea no encontrada");
    });

    it("PATCH /api/tasks/[id] accepts numeric priority and maps correctly (e.g. 3 -> HIGH)", async () => {
      mockAuth.mockResolvedValue({ userId: "u-1" });
      mockCanModify.mockResolvedValue(true);

      const currentTask = {
        id: "task-1",
        title: "Old title",
        status: "TODO",
        priority: "LOW",
        stageId: "stage-1",
        projectId: "proj-1",
      };
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(currentTask);
      (prisma.task.update as jest.Mock).mockResolvedValue({
        ...currentTask,
        priority: "HIGH",
      });

      const req = new NextRequest("http://localhost:3000/api/tasks/task-1", {
        method: "PATCH",
        body: JSON.stringify({ priority: 3 }), // Numeric priority trap test
      });

      const res = await taskPatch(req, { params: Promise.resolve({ id: "task-1" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.priority).toBe("HIGH");

      expect(prisma.taskAuditLog.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              field: "priority",
              oldValue: "LOW",
              newValue: "HIGH",
            }),
          ]),
        })
      );
    });

    it("DELETE /api/tasks/[id] deletes via URL param without requiring body and returns JSON", async () => {
      mockAuth.mockResolvedValue({ userId: "u-1" });
      mockCanModify.mockResolvedValue(true);
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: "task-to-delete" });
      (prisma.task.delete as jest.Mock).mockResolvedValue({ id: "task-to-delete" });

      const req = new NextRequest("http://localhost:3000/api/tasks/task-to-delete", {
        method: "DELETE",
      });

      const res = await taskDelete(req, { params: Promise.resolve({ id: "task-to-delete" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.id).toBe("task-to-delete");
    });

    it("Normalizes Spanish and mixed-case status values to canonical enum", () => {
      expect(normalizeCanonicalStatus("Hecho")).toBe("DONE");
      expect(normalizeCanonicalStatus("completado")).toBe("DONE");
      expect(normalizeCanonicalStatus("en progreso")).toBe("INPROGRESS");
      expect(normalizeCanonicalStatus("en revisión")).toBe("INREVIEW");
      expect(normalizeCanonicalStatus("por hacer")).toBe("TODO");
    });
  });

  describe("Punto 5: Audit Log History & Undo / Restore", () => {
    it("GET /api/tasks/[id]/history returns audit trail", async () => {
      mockAuth.mockResolvedValue({ userId: "u-1" });
      mockCanAccess.mockResolvedValue(true);

      (prisma.taskAuditLog.findMany as jest.Mock).mockResolvedValue([
        {
          id: "audit-1",
          taskId: "task-1",
          action: "UPDATE",
          field: "status",
          oldValue: "TODO",
          newValue: "DONE",
          createdAt: new Date(),
          user: { id: "u-1", name: "User 1" },
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/tasks/task-1/history");
      const res = await taskHistoryGet(req, { params: Promise.resolve({ id: "task-1" }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.history).toHaveLength(1);
      expect(data.history[0].field).toBe("status");
    });

    it("POST /api/tasks/[id]/restore restores field value from audit entry", async () => {
      mockAuth.mockResolvedValue({ userId: "u-1" });
      mockCanModify.mockResolvedValue(true);

      (prisma.taskAuditLog.findUnique as jest.Mock).mockResolvedValue({
        id: "audit-1",
        taskId: "task-1",
        field: "title",
        oldValue: "Original Title",
        newValue: "Wrong Title",
      });

      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: "task-1",
        title: "Wrong Title",
      });

      (prisma.task.update as jest.Mock).mockResolvedValue({
        id: "task-1",
        title: "Original Title",
      });

      const req = new NextRequest("http://localhost:3000/api/tasks/task-1/restore", {
        method: "POST",
        body: JSON.stringify({ auditLogId: "audit-1" }),
      });

      const res = await taskRestorePost(req, { params: Promise.resolve({ id: "task-1" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.result.restoredValue).toBe("Original Title");
    });
  });

  describe("Punto 4: Granular RBAC Permissions", () => {
    it("Restricts regular members from writing/generating billing", async () => {
      (prisma.organizationMember.findUnique as jest.Mock).mockResolvedValue({
        role: "MEMBER",
      });

      const canWriteBilling = await hasModulePermission("u-1", "org-1", "billing", "write");
      expect(canWriteBilling).toBe(false);

      const canReadBilling = await hasModulePermission("u-1", "org-1", "billing", "read");
      expect(canReadBilling).toBe(true);
    });

    it("Allows admins and owners to write billing and settings", async () => {
      (prisma.organizationMember.findUnique as jest.Mock).mockResolvedValue({
        role: "ADMIN",
      });

      const canWriteBilling = await hasModulePermission("u-admin", "org-1", "billing", "write");
      expect(canWriteBilling).toBe(true);
    });
  });
});
