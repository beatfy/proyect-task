import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find the first organization (BEATFY APP)
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    console.error("No organization found in database");
    process.exit(1);
  }

  console.log(`Found organization: ${org.name} (${org.id})`);

  // Find orphan projects
  const orphans = await prisma.project.findMany({
    where: { organizationId: null },
  });

  console.log(`Found ${orphans.length} orphan projects`);

  if (orphans.length === 0) {
    console.log("Nothing to do");
    return;
  }

  // Assign to org
  const result = await prisma.project.updateMany({
    where: { organizationId: null },
    data: { organizationId: org.id },
  });

  console.log(`Updated ${result.count} projects to organization ${org.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
