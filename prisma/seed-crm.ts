import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check if default pipeline already exists
  const existing = await prisma.pipeline.findFirst({
    where: { isDefault: true },
  });

  if (existing) {
    console.log("Default pipeline already exists, skipping seed.");
    return;
  }

  const pipeline = await prisma.pipeline.create({
    data: {
      name: "Ventas",
      isDefault: true,
      stages: {
        create: [
          { name: "Lead", position: 0, color: "#6366f1" },
          { name: "Contactado", position: 1, color: "#8b5cf6" },
          { name: "Propuesta", position: 2, color: "#3b82f6" },
          { name: "Negociación", position: 3, color: "#f59e0b" },
          { name: "Cerrado Ganado", position: 4, color: "#22c55e" },
          { name: "Cerrado Perdido", position: 5, color: "#ef4444" },
        ],
      },
    },
    include: { stages: true },
  });

  console.log(`✅ Pipeline "${pipeline.name}" created with ${pipeline.stages.length} stages.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
