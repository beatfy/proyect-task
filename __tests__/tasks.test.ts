import { GET as tasksGet, POST as tasksPost } from "@/app/api/tasks/route";

// ── Mocks ──
jest.mock("@/lib/api-auth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    taskAssignee: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/authz", () => ({
  canAccessTask: jest.fn(),
  canModifyTask: jest.fn(),
}));

jest.mock("@/lib/webhook", () => ({
  notifyTaskWebhook: jest.fn(),
}));

jest.mock("@vercel/blob", () => ({
  put: jest.fn(),
}));

import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const mockAuth = authenticateRequest as jest.Mock;

function makeGetRequest(url: string) {
  return new Request(url) as any;
}

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("GET /api/tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1", permissions: "full" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeGetRequest("http://localhost/api/tasks");
    const res = await tasksGet(req);
    expect(res.status).toBe(401);
  });

  it("returns tasks filtered by projectId", async () => {
    const fakeTasks = [
      {
        id: "t1", title: "Task 1", status: "TODO", priority: "NONE",
        project: { id: "p1", name: "Proj", color: "#fff" },
        assignee: null, taskAssignees: [], tags: [],
      },
    ];
    (prisma.task.findMany as jest.Mock).mockResolvedValue(fakeTasks);

    const req = makeGetRequest("http://localhost/api/tasks?projectId=p1");
    const res = await tasksGet(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].assignedTo).toBeNull();

    const call = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.projectId).toBe("p1");
  });

  it("returns user tasks when no projectId provided", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    const req = makeGetRequest("http://localhost/api/tasks");
    const res = await tasksGet(req);

    expect(res.status).toBe(200);
    const call = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.parentId).toBeNull();
  });
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1", permissions: "full" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await tasksPost(makePostRequest({ title: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid input (empty title)", async () => {
    const res = await tasksPost(makePostRequest({ title: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/título/i);
  });

  it("creates a task successfully", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });

    const createdTask = {
      id: "t-new", title: "New Task", description: null, status: "TODO", priority: "NONE",
      project: null, assignee: null, taskAssignees: [],
    };
    (prisma.task.create as jest.Mock).mockResolvedValue(createdTask);

    const res = await tasksPost(makePostRequest({ title: "New Task" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("New Task");
    expect(prisma.task.create).toHaveBeenCalled();
  });

  it("creates task with assignee by email", async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: "user-1" }) // user check
      .mockResolvedValueOnce({ id: "assignee-1" }); // assignee lookup

    const createdTask = {
      id: "t-new", title: "Assigned", description: null, status: "TODO", priority: "NONE",
      project: null, assignee: { id: "assignee-1", name: "John", email: "john@test.com" },
      taskAssignees: [],
    };
    (prisma.task.create as jest.Mock).mockResolvedValue(createdTask);

    const res = await tasksPost(makePostRequest({
      title: "Assigned",
      assignedTo: "john@test.com",
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.assignedTo).toBe("john@test.com");
  });
});
