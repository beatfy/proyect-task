import { executePlanToPipeline, PlanData } from "@/lib/plan-executor";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe("executePlanToPipeline", () => {
  const samplePlan: PlanData = {
    pipelineName: "Plan de Negocio: App Citas",
    description: "Plan estratégico y de lanzamiento",
    phases: [
      {
        name: "Fase 1: Validación",
        color: "#3b82f6",
        tasks: [
          {
            title: "Entrevistar a 10 usuarios",
            description: "Hacer videollamadas de 15 min",
            priority: "HIGH",
            daysFromNow: 3,
            subtasks: ["Escribir preguntas", "Agendar citas"],
            comments: ["Foco en el precio mensual"],
          },
        ],
      },
      {
        name: "Fase 2: Lanzamiento",
        color: "#10b981",
        tasks: [
          {
            title: "Campaña en redes",
            priority: "MEDIUM",
            daysFromNow: 10,
          },
        ],
      },
    ],
  };

  it("throws error if planData has no phases", async () => {
    await expect(
      executePlanToPipeline({
        planData: { pipelineName: "Vacio", phases: [] },
        userId: "user-123",
      })
    ).rejects.toThrow("El plan debe contener al menos una fase con tareas.");
  });

  it("creates a pipeline with stages, tasks, subtasks and comments in a transaction", async () => {
    const mockProject = { id: "proj-123", name: "Cliente VIP", organizationId: "org-1" };
    (prisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

    const mockCreatedPipeline = {
      id: "pipe-999",
      name: "Plan de Negocio: App Citas",
      stages: [
        { id: "stage-1", name: "Fase 1: Validación", position: 0, color: "#3b82f6" },
        { id: "stage-2", name: "Fase 2: Lanzamiento", position: 1, color: "#10b981" },
      ],
    };

    const mockTx = {
      taskPipeline: {
        create: jest.fn().mockResolvedValue(mockCreatedPipeline),
      },
      task: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "task-" + Math.random(), ...data })),
      },
      comment: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "comm-" + Math.random(), ...data })),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback(mockTx);
    });

    const result = await executePlanToPipeline({
      planData: samplePlan,
      userId: "user-123",
      projectId: "proj-123",
    });

    expect(result.success).toBe(true);
    expect(result.pipelineId).toBe("pipe-999");
    expect(result.pipelineName).toBe("Plan de Negocio: App Citas");
    expect(result.projectName).toBe("Cliente VIP");
    expect(result.totalStages).toBe(2);
    expect(result.totalTasks).toBe(2);
    expect(result.totalSubtasks).toBe(2);
    expect(result.totalComments).toBe(1);
    expect(result.url).toBe("/projects/proj-123?pipelineId=pipe-999");

    // Verify pipeline creation
    expect(mockTx.taskPipeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Plan de Negocio: App Citas",
          projectId: "proj-123",
          organizationId: "org-1",
        }),
      })
    );

    // Verify parent task creation
    expect(mockTx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Entrevistar a 10 usuarios",
          priority: "HIGH",
          pipelineId: "pipe-999",
          stageId: "stage-1",
        }),
      })
    );

    // Verify subtask creation
    expect(mockTx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Escribir preguntas",
          parentId: expect.any(String),
          status: "TODO",
        }),
      })
    );

    // Verify comment creation
    expect(mockTx.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Foco en el precio mensual",
          authorId: "user-123",
        }),
      })
    );
  });
});
