import { PrismaClient, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();
const CDD_TITLE = "Customer Due Diligence (KYC/EDD/monitoring)";
const VERSION = "1.0";

async function main() {
  const course = await prisma.course.findUnique({ where: { title_version_unique: { title: CDD_TITLE, version: VERSION } } });
  if (!course) throw new Error("CDD course not found");
  const short = await prisma.question.findFirst({ where: { courseId: course.id, type: QuestionType.SHORT_ANSWER, body: { contains: "additional checks", mode: 'insensitive' } } });
  if (!short) throw new Error("Short answer EDD question not found");

  // Remove attempt items tied to this question to avoid type mismatch
  await prisma.attemptItem.deleteMany({ where: { questionId: short.id } });

  await prisma.question.update({
    where: { id: short.id },
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

  console.log("Converted short-answer EDD to MCQ");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());

