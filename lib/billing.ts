import { prisma } from "@/lib/prisma";
import { cuid } from "@/lib/utils";

export interface BillableProject {
  id: string;
  monthlyFee: number;
}

export interface InvoiceGenerationItemResult {
  projectId: string;
  status: "created" | "already_exists" | "error";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice?: any;
  error?: string;
}

/**
 * Returns the 1-indexed month and year corresponding to the previous calendar month.
 */
export function getPreviousBillingPeriod(referenceDate: Date = new Date()): {
  month: number;
  year: number;
} {
  let month = referenceDate.getMonth(); // 0-indexed -> previous month in 1..12
  let year = referenceDate.getFullYear();
  if (month === 0) {
    month = 12;
    year--;
  }
  return { month, year };
}

/**
 * Generates monthly invoices for a list of billable projects, skipping duplicates safely.
 */
export async function generateInvoicesForProjects(
  projects: BillableProject[],
  month: number,
  year: number,
  dueDate: Date
): Promise<{
  created: number;
  total: number;
  results: InvoiceGenerationItemResult[];
}> {
  let created = 0;
  const results: InvoiceGenerationItemResult[] = [];

  for (const project of projects) {
    if (!project.monthlyFee || project.monthlyFee <= 0) continue;

    try {
      const existing = await prisma.invoice.findUnique({
        where: {
          projectId_month_year: {
            projectId: project.id,
            month,
            year,
          },
        },
      });

      if (existing) {
        results.push({ projectId: project.id, status: "already_exists" });
        continue;
      }

      const invoice = await prisma.invoice.create({
        data: {
          id: cuid(),
          projectId: project.id,
          month,
          year,
          amount: project.monthlyFee,
          dueDate,
        },
      });

      created++;
      results.push({ projectId: project.id, status: "created", invoice });
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        results.push({ projectId: project.id, status: "already_exists" });
      } else {
        results.push({
          projectId: project.id,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    created,
    total: projects.length,
    results,
  };
}
