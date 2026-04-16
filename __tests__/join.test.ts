import { POST as joinPost } from "@/app/api/join/route";

// ── Mocks ──
jest.mock("@/lib/api-auth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    projectInviteToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    invitation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    projectMember: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(Array.isArray(ops) ? ops : [])),
  },
}));

import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const mockAuth = authenticateRequest as jest.Mock;

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/join", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1", permissions: "full" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await joinPost(makeRequest({ token: "abc" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no token provided", async () => {
    const res = await joinPost(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/token/i);
  });

  it("joins via project invite token successfully", async () => {
    (prisma.projectInviteToken.findUnique as jest.Mock).mockResolvedValue({
      id: "inv-1",
      token: "tok-abc",
      projectId: "proj-1",
      role: "MEMBER",
      expiresAt: null,
      maxUses: null,
      uses: 0,
      createdBy: "creator-1",
      project: { id: "proj-1", name: "My Project", organizationId: null },
    });

    (prisma.projectMember.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.projectMember.create as jest.Mock).mockResolvedValue({ id: "pm-1" });
    (prisma.notification.create as jest.Mock).mockResolvedValue({});
    (prisma.projectInviteToken.update as jest.Mock).mockResolvedValue({});

    const res = await joinPost(makeRequest({ token: "tok-abc" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.projectId).toBe("proj-1");
  });

  it("rejects expired project invite token", async () => {
    (prisma.projectInviteToken.findUnique as jest.Mock).mockResolvedValue({
      id: "inv-1",
      token: "tok-exp",
      projectId: "proj-1",
      role: "MEMBER",
      expiresAt: new Date("2020-01-01"),
      maxUses: null,
      uses: 0,
      project: { id: "proj-1", name: "Old" },
    });

    const res = await joinPost(makeRequest({ token: "tok-exp" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/expir/i);
  });

  it("rejects already-used invite token", async () => {
    (prisma.projectInviteToken.findUnique as jest.Mock).mockResolvedValue({
      id: "inv-1",
      token: "tok-max",
      projectId: "proj-1",
      role: "MEMBER",
      expiresAt: null,
      maxUses: 1,
      uses: 1,
      project: { id: "proj-1", name: "Full" },
    });

    const res = await joinPost(makeRequest({ token: "tok-max" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/disponible/i);
  });

  it("joins via organization invitation", async () => {
    (prisma.projectInviteToken.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue({
      id: "inv-org-1",
      organizationId: "org-1",
      projectId: null,
      role: "MEMBER",
      status: "PENDING",
      expiresAt: null,
      invitedBy: "admin-1",
      project: null,
      organization: { id: "org-1", name: "Acme Corp" },
    });

    (prisma.organizationMember.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.organizationMember.create as jest.Mock).mockResolvedValue({ id: "om-1" });
    (prisma.invitation.update as jest.Mock).mockResolvedValue({});
    (prisma.notification.create as jest.Mock).mockResolvedValue({});

    const res = await joinPost(makeRequest({ token: "inv-org-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.organizationId).toBe("org-1");
  });

  it("returns 404 for invalid token", async () => {
    (prisma.projectInviteToken.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await joinPost(makeRequest({ token: "nonexistent" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toMatch(/inválido/i);
  });

  it("rejects already-processed invitation", async () => {
    (prisma.projectInviteToken.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.invitation.findUnique as jest.Mock).mockResolvedValue({
      id: "inv-done",
      organizationId: "org-1",
      projectId: null,
      role: "MEMBER",
      status: "ACCEPTED",
      expiresAt: null,
      invitedBy: "admin-1",
      project: null,
      organization: { id: "org-1", name: "Acme" },
    });

    const res = await joinPost(makeRequest({ token: "inv-done" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/procesada/i);
  });
});
