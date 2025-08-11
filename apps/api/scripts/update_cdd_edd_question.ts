import { PrismaClient, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();
const CDD_TITLE = "Customer Due Diligence (KYC/EDD/monitoring)";
const VERSION = "1.0";

async function main() {
  const course = await prisma.course.findUnique({ where: { title_version_unique: { title: CDD_TITLE, version: VERSION } } });
  if (!course) throw new Error("CDD course not found");

  const questions = await prisma.question.findMany({ where: { courseId: course.id } });
  const target = questions.find((q) => q.body.toLowerCase().includes("additional checks") || q.body.toLowerCase().includes("edd"));
  if (!target) throw new Error("Target question not found");

  await prisma.attemptItem.deleteMany({ where: { questionId: target.id } });

  await prisma.question.update({
    where: { id: target.id },
    data: {
      body: "Which two additional checks are performed during Enhanced Due Diligence (EDD)?",
      type: QuestionType.MCQ_SINGLE,
      answers: [
        "Checking customer’s social media and favourite brands",
        "Verifying their source of wealth and source of funds",
        "Asking for their annual holiday destination and hobbies",
        "Reviewing their LinkedIn connections",
      ] as any,
      correctKey: 1 as any,
      tags: ["CDD"],
      version: VERSION,
    },
  });

  console.log("Updated EDD question to MCQ");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());

