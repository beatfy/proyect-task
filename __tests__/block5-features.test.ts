import { NextRequest } from "next/server";
import { POST as archiveTasksPost } from "@/app/api/tasks/archive-completed/route";
import { GET as billingHoursGet } from "@/app/api/billing/projects/[id]/hours/route";

jest.mock("@/lib/api-auth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/lib/tenant", () => ({
  canModifyProject: jest.fn(),
  canAccessProject: jest.fn(),
  getUserOrgIds: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
    },
  },
}));

import { authenticateRequest } from "@/lib/api-auth";
import { canModifyProject, canAccessProject, getUserOrgIds } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

const mockAuth = authenticateRequest as unknown as jest.Mock;
const mockCanModify = canModifyProject as unknown as jest.Mock;
const mockCanAccess = canAccessProject as unknown as jest.Mock;
const mockGetUserOrgIds = getUserOrgIds as unknown as jest.Mock;

describe("Block 5 Features", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/tasks/archive-completed", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3000/api/tasks/archive-completed", {
        method: "POST",
        body: JSON.stringify({ daysOld: 7 }),
      });

      const res = await archiveTasksPost(req);
      expect(res.status).toBe(401);
    });

    it("archives matching tasks and returns count", async () => {
      mockAuth.mockResolvedValue({ userId: "u-1" });
      mockCanModify.mockResolvedValue(true);
      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { id: "task-1", title: "Task 1", updatedAt: new Date() },
        { id: "task-2", title: "Task 2", updatedAt: new Date() },
      ]);
      (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      const req = new NextRequest("http://localhost:3000/api/tasks/archive-completed", {
        method: "POST",
        body: JSON.stringify({ projectId: "proj-1", daysOld: 7 }),
      });

      const res = await archiveTasksPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.archivedCount).toBe(2);
      expect(prisma.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["task-1", "task-2"] } },
          data: { status: "ARCHIVED" },
        })
      );
    });
  });

  describe("GET /api/billing/projects/[id]/hours", () => {
    it("returns 403 when user has no access to project", async () => {
      mockAuth.mockResolvedValue({ userId: "u-1" });
      mockCanAccess.mockResolvedValue(false);

      const req = new NextRequest("http://localhost:3000/api/billing/projects/proj-1/hours?month=10&year=2026");
      const res = await billingHoursGet(req, { params: Promise.resolve({ id: "proj-1" }) });

      expect(res.status).toBe(403);
    });

    it("calculates total hours and breakdown by task correctly", async () => {
      mockAuth.mockResolvedValue({ userId: "u-1" });
      mockCanAccess.mockResolvedValue(true);

      (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([
        {
          id: "entry-1",
          duration: 3600, // 1 hour
          startTime: new Date("2026-10-15T10:00:00Z"),
          description: "Dev work",
          task: { id: "t-1", title: "Setup auth" },
        },
        {
          id: "entry-2",
          duration: 1800, // 0.5 hours
          startTime: new Date("2026-10-16T11:00:00Z"),
          description: "Testing",
          task: { id: "t-1", title: "Setup auth" },
        },
        {
          id: "entry-3",
          duration: 5400, // 1.5 hours
          startTime: new Date("2026-10-17T12:00:00Z"),
          description: "UI polish",
          task: { id: "t-2", title: "Frontend design" },
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/billing/projects/proj-1/hours?month=10&year=2026");
      const res = await billingHoursGet(req, { params: Promise.resolve({ id: "proj-1" }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalSeconds).toBe(10800); // 3600 + 1800 + 5400
      expect(data.totalHours).toBe(3); // 3.0 hours
      expect(data.tasks).toHaveLength(2);
      expect(data.tasks[0].hours).toBe(1.5);
      expect(data.tasks[1].hours).toBe(1.5);
    });
  });
});
