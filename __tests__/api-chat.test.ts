/**
 * Integration tests for Tasky AI agent tools (POST /api/chat)
 *
 * Strategy: mock all external dependencies (Prisma, fetch, auth, blob)
 * and test tool definitions, route handler responses, and error handling.
 */

import { NextRequest } from "next/server";

// --- Mocks ---

// Mock @/lib/prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: "user-1", name: "Test User" }),
  },
  project: {
    findUnique: jest.fn().mockResolvedValue({ id: "proj-1", name: "Test Project", organizationId: "org-1" }),
    update: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: "proj-new", name: "New Project" }),
  },
  organization: {
    findUnique: jest.fn().mockResolvedValue({ id: "org-1", name: "Test Org" }),
  },
  task: {
    create: jest.fn().mockResolvedValue({ id: "task-1", title: "Test", status: "TODO" }),
    update: jest.fn().mockResolvedValue({ id: "task-1", title: "Updated", status: "IN_PROGRESS" }),
    delete: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue({ id: "task-1" }),
  },
  chatMessage: {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },
  projectMember: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
  timeEntry: {
    create: jest.fn().mockResolvedValue({ id: "te-1", hours: 2 }),
  },
  attachment: {
    create: jest.fn().mockResolvedValue({ id: "att-1", name: "nota.txt", url: "https://blob.url/n" }),
  },
  apiKey: {
    findFirst: jest.fn().mockResolvedValue({ id: "key-1", userId: "user-1", permissions: "full" }),
    update: jest.fn().mockResolvedValue({}),
  },
};

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Mock @/lib/api-auth
jest.mock("@/lib/api-auth", () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ userId: "user-1", permissions: "full" }),
}));

// Mock @/lib/webhook
jest.mock("@/lib/webhook", () => ({
  notifyTaskWebhook: jest.fn().mockResolvedValue(undefined),
}));

// Mock @/lib/utils
jest.mock("@/lib/utils", () => ({ cuid: jest.fn().mockReturnValue("cuid-abc123") }));

// Mock @vercel/blob
jest.mock("@vercel/blob", () => ({
  put: jest.fn().mockResolvedValue({ url: "https://blob.url/file.txt" }),
}));

// Mock @/lib/auth (needed by api-auth)
jest.mock("@/lib/auth", () => ({ auth: jest.fn().mockResolvedValue(null) }));

// Mock global fetch for LLM calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import route AFTER mocks
import { POST } from "@/app/api/chat/route";

// --- Helpers ---

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer tx2_test_key", ...headers },
    body: JSON.stringify(body),
  });
}

function mockLLMResponse(message: { content?: string; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ choices: [{ message }] }),
  });
}

// ============================================================
// TOOL DEFINITIONS TESTS
// ============================================================

describe("Tasky tool definitions", () => {
  // We can't directly import TOOLS since it's not exported,
  // but we can verify behavior through the LLM API call.
  // Instead, let's test that the route sends tools to the LLM.

  it("sends tools array to the LLM API", async () => {
    // LLM responds with plain text (no tool calls)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "¡Hola!" } }],
      }),
    });

    await POST(makeRequest({ message: "hola" }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.tools).toBeDefined();
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools.length).toBe(13); // 13 tools total (11 + client_context_update + task_attachment)
  });

  it("includes all expected tool names", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "ok" } }],
      }),
    });

    await POST(makeRequest({ message: "test" }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const toolNames = body.tools.map((t: { function: { name: string } }) => t.function.name);

    const expectedTools = [
      "task_create",
      "task_update",
      "task_delete",
      "task_list",
      "task_move",
      "project_summary",
      "member_list",
      "member_assign",
      "time_log",
      "client_context",
      "client_context_update",
      "project_create",
      "task_attachment",
    ];

    expectedTools.forEach((name) => {
      expect(toolNames).toContain(name);
    });
  });

  it("tools have correct structure (type, function with name, description, parameters)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "ok" } }],
      }),
    });

    await POST(makeRequest({ message: "test" }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    body.tools.forEach((tool: Record<string, unknown>) => {
      expect(tool.type).toBe("function");
      expect(tool).toHaveProperty("function");
      const fn = tool.function as Record<string, unknown>;
      expect(typeof fn.name).toBe("string");
      expect(typeof fn.description).toBe("string");
      expect(fn.parameters).toBeDefined();
      expect((fn.parameters as Record<string, unknown>).type).toBe("object");
    });
  });

  it("task_create requires 'title' parameter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "ok" } }],
      }),
    });

    await POST(makeRequest({ message: "test" }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const taskCreate = body.tools.find((t: { function: { name: string } }) => t.function.name === "task_create");

    expect(taskCreate.function.parameters.required).toContain("title");
    expect(taskCreate.function.parameters.properties).toHaveProperty("title");
    expect(taskCreate.function.parameters.properties).toHaveProperty("priority");
    expect(taskCreate.function.parameters.properties.priority).toHaveProperty("enum");
  });

  it("task_update requires 'id' parameter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "ok" } }],
      }),
    });

    await POST(makeRequest({ message: "test" }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const taskUpdate = body.tools.find((t: { function: { name: string } }) => t.function.name === "task_update");

    expect(taskUpdate.function.parameters.required).toContain("id");
  });

  it("task_move requires both 'id' and 'status'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "ok" } }],
      }),
    });

    await POST(makeRequest({ message: "test" }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const taskMove = body.tools.find((t: { function: { name: string } }) => t.function.name === "task_move");

    expect(taskMove.function.parameters.required).toEqual(["id", "status"]);
  });

  it("member_assign requires 'taskId' and 'memberId'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "ok" } }],
      }),
    });

    await POST(makeRequest({ message: "test" }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const memberAssign = body.tools.find((t: { function: { name: string } }) => t.function.name === "member_assign");

    expect(memberAssign.function.parameters.required).toEqual(["taskId", "memberId"]);
  });

  it("time_log requires 'taskId' and 'hours'", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "ok" } }],
      }),
    });

    await POST(makeRequest({ message: "test" }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const timeLog = body.tools.find((t: { function: { name: string } }) => t.function.name === "time_log");

    expect(timeLog.function.parameters.required).toEqual(["taskId", "hours"]);
  });
});

// ============================================================
// POST /api/chat — ROUTE HANDLER TESTS
// ============================================================

describe("POST /api/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: auth passes
    const { authenticateRequest } = require("@/lib/api-auth");
    authenticateRequest.mockResolvedValue({ userId: "user-1", permissions: "full" });
    // Default: user found
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", name: "Test User" });
    // Default: project found
    mockPrisma.project.findUnique.mockResolvedValue({ id: "proj-1", name: "Test Project", organizationId: "org-1" });
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Test Org" });
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.projectMember.findMany.mockResolvedValue([]);
  });

  it("returns 200 with a plain text reply from LLM", async () => {
    mockLLMResponse({ content: "¡Hola! ¿En qué puedo ayudarte?" });

    const res = await POST(makeRequest({ message: "hola", projectId: "proj-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reply).toBe("¡Hola! ¿En qué puedo ayudarte?");
    expect(data.actions).toEqual([]);
  });

  it("returns 401 when not authenticated", async () => {
    const { authenticateRequest } = require("@/lib/api-auth");
    authenticateRequest.mockResolvedValue(null);

    const res = await POST(makeRequest({ message: "hola" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is not a string", async () => {
    const res = await POST(makeRequest({ message: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when no API key is configured", async () => {
    // Temporarily remove API key
    const originalKey = process.env.GLM_API_KEY;
    const originalOpenAI = process.env.OPENAI_API_KEY;
    delete process.env.GLM_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const res = await POST(makeRequest({ message: "hola" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("API key no configurada");

    // Restore
    if (originalKey) process.env.GLM_API_KEY = originalKey;
    if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
  });

  it("returns 502 when LLM API fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const res = await POST(makeRequest({ message: "hola", projectId: "proj-1" }));
    expect(res.status).toBe(502);
  });

  it("executes tool calls and returns actions", async () => {
    // First call: LLM returns a tool call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "tc-1",
              type: "function",
              function: { name: "task_create", arguments: JSON.stringify({ title: "Nueva tarea", priority: "HIGH" }) },
            }],
          },
        }],
      }),
    });

    // Second call: LLM summarizes result
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Tarea creada: Nueva tarea con prioridad HIGH." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "crea una tarea urgente llamada Nueva tarea", projectId: "proj-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.actions).toHaveLength(1);
    expect(data.actions[0].tool).toBe("task_create");
    expect(data.actions[0].result.success).toBe(true);
    expect(data.reply).toBe("Tarea creada: Nueva tarea con prioridad HIGH.");
    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "Nueva tarea", priority: "HIGH" }) })
    );
  });

  it("handles task_update tool call", async () => {
    mockPrisma.task.update.mockResolvedValue({ id: "task-1", title: "Updated", status: "DONE" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-2",
              type: "function",
              function: { name: "task_update", arguments: JSON.stringify({ id: "task-1", status: "DONE" }) },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Tarea marcada como completada." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "marca la tarea task-1 como hecha", projectId: "proj-1" }));
    const data = await res.json();

    expect(data.actions[0].tool).toBe("task_update");
    expect(data.actions[0].result.success).toBe(true);
    expect(mockPrisma.task.update).toHaveBeenCalled();
  });

  it("handles task_delete tool call", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-3",
              type: "function",
              function: { name: "task_delete", arguments: JSON.stringify({ id: "task-1" }) },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Tarea eliminada." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "elimina la tarea task-1", projectId: "proj-1" }));
    const data = await res.json();

    expect(data.actions[0].tool).toBe("task_delete");
    expect(data.actions[0].result.success).toBe(true);
    expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: "task-1" } });
  });

  it("handles task_move tool call", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-4",
              type: "function",
              function: { name: "task_move", arguments: JSON.stringify({ id: "task-1", status: "IN_PROGRESS" }) },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Tarea movida a En Progreso." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "mueve task-1 a en progreso", projectId: "proj-1" }));
    const data = await res.json();

    expect(data.actions[0].tool).toBe("task_move");
    expect(data.actions[0].result.success).toBe(true);
  });

  it("handles project_summary tool call", async () => {
    mockPrisma.task.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(5);
    mockPrisma.task.findMany.mockResolvedValueOnce([]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-5",
              type: "function",
              function: { name: "project_summary", arguments: "{}" },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Resumen: 3 TODO, 2 en progreso, 1 en revisión, 5 hechas." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "dame un resumen del proyecto", projectId: "proj-1" }));
    const data = await res.json();

    expect(data.actions[0].tool).toBe("project_summary");
    expect(data.actions[0].result.total).toBe(11);
  });

  it("handles member_list tool call", async () => {
    mockPrisma.projectMember.findMany.mockResolvedValueOnce([
      { id: "pm-1", userId: "user-1", role: "ADMIN", user: { id: "user-1", name: "Test", email: "t@t.com" } },
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-6",
              type: "function",
              function: { name: "member_list", arguments: "{}" },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Miembros: Test (ADMIN)" } }],
      }),
    });

    const res = await POST(makeRequest({ message: "lista los miembros", projectId: "proj-1" }));
    const data = await res.json();

    expect(data.actions[0].tool).toBe("member_list");
    expect(data.actions[0].result.members).toHaveLength(1);
  });

  it("handles time_log tool call", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-7",
              type: "function",
              function: { name: "time_log", arguments: JSON.stringify({ taskId: "task-1", hours: 2, description: "Diseño UI" }) },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Registradas 2 horas en tarea task-1." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "registra 2 horas en task-1 por diseño UI", projectId: "proj-1" }));
    const data = await res.json();

    expect(data.actions[0].tool).toBe("time_log");
    expect(data.actions[0].result.success).toBe(true);
    expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taskId: "task-1" }) })
    );
  });

  it("handles client_context tool call", async () => {
    mockPrisma.project.findUnique.mockResolvedValueOnce({
      id: "proj-1",
      name: "Test Project",
      clientContext: "Restaurante italiano en Madrid. Tono cercano.",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-8",
              type: "function",
              function: { name: "client_context", arguments: "{}" },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Cliente: Restaurante italiano en Madrid." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "qué sabes del cliente?", projectId: "proj-1" }));
    const data = await res.json();

    expect(data.actions[0].tool).toBe("client_context");
    expect(data.actions[0].result.context).toContain("Restaurante italiano");
  });

  it("handles project_create tool call", async () => {
    mockPrisma.project.create.mockResolvedValue({ id: "proj-new", name: "Nuevo Proyecto" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-9",
              type: "function",
              function: { name: "project_create", arguments: JSON.stringify({ name: "Nuevo Proyecto", organizationId: "org-1" }) },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Proyecto 'Nuevo Proyecto' creado." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "crea un proyecto llamado Nuevo Proyecto", projectId: "proj-1", organizationId: "org-1" }));
    const data = await res.json();

    expect(data.actions[0].tool).toBe("project_create");
    expect(data.actions[0].result.success).toBe(true);
    expect(mockPrisma.project.create).toHaveBeenCalled();
    expect(mockPrisma.projectMember.create).toHaveBeenCalled();
  });

  it("handles tool with invalid JSON arguments gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-bad",
              type: "function",
              function: { name: "task_create", arguments: "INVALID JSON" },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Error al crear tarea." } }],
      }),
    });

    const res = await POST(makeRequest({ message: "test", projectId: "proj-1" }));
    expect(res.status).toBe(200);
  });

  it("returns tool results as fallback when second LLM call fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-fb",
              type: "function",
              function: { name: "task_list", arguments: "{}" },
            }],
          },
        }],
      }),
    });
    // Second call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "LLM Error",
    });

    const res = await POST(makeRequest({ message: "lista tareas", projectId: "proj-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.reply).toBe("Acción completada.");
    expect(data.actions).toHaveLength(1);
  });

  it("saves chat messages to database", async () => {
    mockLLMResponse({ content: "Respuesta de prueba" });

    await POST(makeRequest({ message: "hola", projectId: "proj-1" }));

    expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(2); // user + assistant
  });

  it("passes system prompt with project context", async () => {
    mockLLMResponse({ content: "ok" });

    await POST(makeRequest({ message: "test", projectId: "proj-1" }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const systemMsg = body.messages[0];

    expect(systemMsg.role).toBe("system");
    expect(systemMsg.content).toContain("Test Project");
    expect(systemMsg.content).toContain("Test User");
    expect(systemMsg.content).toContain("Test Org");
  });

  it("handles unknown tool gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            tool_calls: [{
              id: "tc-unknown",
              type: "function",
              function: { name: "unknown_tool", arguments: "{}" },
            }],
          },
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Tool no reconocida" } }],
      }),
    });

    const res = await POST(makeRequest({ message: "test", projectId: "proj-1" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.actions[0].result.error).toContain("no reconocida");
  });

  it("includes history messages when provided", async () => {
    mockLLMResponse({ content: "ok" });

    await POST(makeRequest({
      message: "siguiente",
      projectId: "proj-1",
      history: [
        { role: "user", content: "hola" },
        { role: "assistant", content: "¡Hola!" },
      ],
    }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const msgs = body.messages;

    // system + 2 history + 1 user = 4
    expect(msgs).toHaveLength(4);
    expect(msgs[1].content).toBe("hola");
    expect(msgs[2].content).toBe("¡Hola!");
    expect(msgs[3].content).toBe("siguiente");
  });
});
