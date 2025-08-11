import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CDD_TITLE = "Customer Due Diligence (KYC/EDD/monitoring)";
const VERSION = "1.0";

async function main() {
  const course = await prisma.course.findUnique({ where: { title_version_unique: { title: CDD_TITLE, version: VERSION } } });
  if (!course) throw new Error("CDD course not found");
  const qs = await prisma.question.findMany({ where: { courseId: course.id }, orderBy: { id: 'asc' } });
  for (const q of qs) {
    console.log(`[${q.id}] type=${q.type} :: ${q.body}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());

