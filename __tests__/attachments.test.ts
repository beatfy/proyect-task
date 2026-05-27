import { GET as attachmentsGet, POST as attachmentsPost } from "@/app/api/attachments/route";

// ── Mocks ──
jest.mock("@/lib/api-auth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    attachment: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("@vercel/blob", () => ({
  put: jest.fn(),
  del: jest.fn(),
}));

import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const mockAuth = authenticateRequest as jest.Mock;

function makeGetRequest(url: string) {
  return new Request(url) as any;
}

function makePostRequest(formData: FormData) {
  return new Request("http://localhost/api/attachments", {
    method: "POST",
    body: formData,
  }) as any;
}

describe("GET /api/attachments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1", permissions: "full" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await attachmentsGet(makeGetRequest("http://localhost/api/attachments?taskId=t1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no taskId and not all=true", async () => {
    const res = await attachmentsGet(makeGetRequest("http://localhost/api/attachments"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/taskId/i);
  });

  it("returns attachments for a task", async () => {
    const fakeAttachments = [
      { id: "a1", name: "file.pdf", url: "https://blob/file.pdf", type: "pdf", size: 1024, taskId: "t1" },
    ];
    (prisma.attachment.findMany as jest.Mock).mockResolvedValue(fakeAttachments);

    const res = await attachmentsGet(makeGetRequest("http://localhost/api/attachments?taskId=t1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("file.pdf");
  });

  it("returns all user attachments when all=true", async () => {
    (prisma.attachment.findMany as jest.Mock).mockResolvedValue([]);

    const res = await attachmentsGet(makeGetRequest("http://localhost/api/attachments?all=true"));
    expect(res.status).toBe(200);
    const call = (prisma.attachment.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.task.OR).toBeDefined();
  });
});

describe("POST /api/attachments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1", permissions: "full" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const fd = new FormData();
    const res = await attachmentsPost(makePostRequest(fd));
    expect(res.status).toBe(401);
  });

  it("returns 400 when file or taskId missing", async () => {
    const fd = new FormData();
    const res = await attachmentsPost(makePostRequest(fd));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/file y taskId/i);
  });

  it("rejects disallowed MIME types", async () => {
    const fd = new FormData();
    const file = new File(["bad"], "malware.exe", { type: "application/x-msdownload" });
    fd.append("file", file);
    fd.append("taskId", "t1");

    const res = await attachmentsPost(makePostRequest(fd));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/no permitido/i);
  });
});
