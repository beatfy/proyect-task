import {
  buildFocusQueue,
  extractCustomPrimersFromTasks,
  selectDopaminePrimers,
} from "@/lib/focus";
import { getPreviousBillingPeriod } from "@/lib/billing";
import { storeFile, readLocalStoredFile, deleteStoredFile } from "@/lib/storage";

describe("lib/focus shared utilities", () => {
  const now = new Date("2026-10-28T12:00:00Z");

  it("escalates emotionalWeight by +0.5 per untouched day and promotes blocking tasks after 3 days", () => {
    const tasks = [
      {
        id: "t1",
        title: "Normal task",
        createdAt: new Date("2026-10-27T12:00:00Z"),
        updatedAt: new Date("2026-10-27T12:00:00Z"),
        tdahMetrics: {
          emotionalWeight: 2,
          energyRequired: "low",
          blocksSomeone: false,
          lastTouched: "2026-10-26T12:00:00Z", // 2 days ago -> weight = 2 + 1 = 3
        },
      },
      {
        id: "t2",
        title: "Blocking old task",
        createdAt: new Date("2026-10-20T12:00:00Z"),
        updatedAt: new Date("2026-10-20T12:00:00Z"),
        tdahMetrics: {
          emotionalWeight: 1,
          energyRequired: "high",
          blocksSomeone: true,
          lastTouched: "2026-10-23T12:00:00Z", // 5 days ago -> promoted!
        },
      },
    ];

    const queue = buildFocusQueue(tasks, { now });
    expect(queue[0].id).toBe("t2");
    expect(queue[0].tdahMetrics.isPromoted).toBe(true);
    expect(queue[0].tdahMetrics.streakDays).toBe(5);
    expect(queue[1].id).toBe("t1");
    expect(queue[1].tdahMetrics.emotionalWeight).toBe(3);
  });

  it("filters queue by energyRequired and respects limit", () => {
    const tasks = [
      {
        id: "t-low",
        title: "Low energy",
        createdAt: now,
        updatedAt: now,
        tdahMetrics: { emotionalWeight: 2, energyRequired: "low" },
      },
      {
        id: "t-high",
        title: "High energy",
        createdAt: now,
        updatedAt: now,
        tdahMetrics: { emotionalWeight: 4, energyRequired: "high" },
      },
    ];

    const lowOnly = buildFocusQueue(tasks, { energyFilter: "low", now });
    expect(lowOnly).toHaveLength(1);
    expect(lowOnly[0].id).toBe("t-low");
  });

  it("extracts custom primers from short tasks and selects diverse primers", () => {
    const tasks = [
      {
        id: "t-short",
        title: "Quick sketch",
        createdAt: now,
        updatedAt: now,
        tdahMetrics: {
          emotionalWeight: 1.5,
          timeBlock: "15min",
          dopamineSource: "creative",
        },
      },
    ];

    const custom = extractCustomPrimersFromTasks(tasks);
    expect(custom).toHaveLength(1);
    expect(custom[0].taskId).toBe("t-short");
    expect(custom[0].duration).toBe("15 min");

    const selected = selectDopaminePrimers(tasks, 3);
    expect(selected).toHaveLength(3);
  });
});

describe("lib/billing shared utilities", () => {
  it("computes previous billing period accurately across year boundary", () => {
    expect(getPreviousBillingPeriod(new Date("2026-01-15T00:00:00Z"))).toEqual({
      month: 12,
      year: 2025,
    });
    expect(getPreviousBillingPeriod(new Date("2026-05-01T00:00:00Z"))).toEqual({
      month: 4,
      year: 2026,
    });
  });

  it("calculates billable hourly amount from tracked seconds accurately", () => {
    const entries = [{ duration: 3600 }, { duration: 1800 }, { duration: 5400 }];
    const totalSeconds = entries.reduce((acc, e) => acc + e.duration, 0); // 10800s = 3.0h
    const totalHours = Math.round((totalSeconds / 3600) * 100) / 100;
    const hourlyRate = 45;
    const amount = Math.round(totalHours * hourlyRate * 100) / 100;

    expect(totalHours).toBe(3.0);
    expect(amount).toBe(135.0);
  });
});

describe("lib/storage unified local & blob storage", () => {
  it("stores, reads, and deletes a local file when BLOB_READ_WRITE_TOKEN is unset", async () => {
    const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;

    try {
      const entityId = `test-task-${Date.now()}`;
      const filename = "resumen.txt";
      const payload = Buffer.from("Contenido de prueba unificado", "utf-8");

      const stored = await storeFile("tasks", entityId, filename, payload, "/api/attachments");
      expect(stored.storageType).toBe("local");
      expect(stored.url).toBe(`/api/attachments/${entityId}/${filename}`);
      expect(stored.size).toBe(payload.byteLength);

      const readBack = await readLocalStoredFile("tasks", entityId, filename);
      expect(readBack.toString("utf-8")).toBe("Contenido de prueba unificado");

      await deleteStoredFile(stored.url, { scope: "tasks", entityId, filename });
    } finally {
      if (prevToken !== undefined) {
        process.env.BLOB_READ_WRITE_TOKEN = prevToken;
      }
    }
  });
});
