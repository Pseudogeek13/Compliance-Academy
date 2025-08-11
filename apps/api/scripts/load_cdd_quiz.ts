import { PrismaClient, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();
const CDD_TITLE = "Customer Due Diligence (KYC/EDD/monitoring)";
const VERSION = "1.0";

async function main() {
  const course = await prisma.course.findUnique({
    where: { title_version_unique: { title: CDD_TITLE, version: VERSION } },
  });
  if (!course) throw new Error("CDD course not found. Run load:cdd first.");

  // Remove existing questions for clean import
  await prisma.question.deleteMany({ where: { courseId: course.id } });

  await prisma.question.createMany({
    data: [
      {
        courseId: course.id,
        body: "When must you perform CDD?",
        type: QuestionType.MCQ_SINGLE,
        answers: [
          "Only when a transaction is suspicious",
          "Only when the customer is new",
          "At onboarding, on occasional high-value transactions, and when suspicion arises",
          "Only during annual reviews",
        ] as any,
        correctKey: 2 as any,
        tags: ["CDD"],
        version: VERSION,
      },
      {
        courseId: course.id,
        body: "Who must approve onboarding of a high-risk customer?",
        type: QuestionType.MCQ_SINGLE,
        answers: [
          "Any Compliance Analyst",
          "MLRO and Board of Directors",
          "Customer Service Manager",
          "The customer’s lawyer",
        ] as any,
        correctKey: 1 as any,
        tags: ["CDD"],
        version: VERSION,
      },
      {
        courseId: course.id,
        body: "Which of the following is NOT an acceptable verification method for an individual?",
        type: QuestionType.MCQ_SINGLE,
        answers: [
          "Passport",
          "Driving Licence issued in their home country",
          "Social media profile",
          "National ID card",
        ] as any,
        correctKey: 2 as any,
        tags: ["CDD"],
        version: VERSION,
      },
      {
        courseId: course.id,
        body: "What is the minimum period for retaining CDD records?",
        type: QuestionType.MCQ_SINGLE,
        answers: ["2 years", "4 years", "6 years", "10 years"] as any,
        correctKey: 2 as any,
        tags: ["CDD"],
        version: VERSION,
      },
      {
        courseId: course.id,
        body: "Which of these customers automatically require EDD?",
        type: QuestionType.MCQ_SINGLE,
        answers: ["Customers living locally with low transaction volumes", "PEPs", "Students", "All corporate clients"] as any,
        correctKey: 1 as any,
        tags: ["CDD"],
        version: VERSION,
      },
      {
        courseId: course.id,
        body: "True or False: Shell banks can be accepted as customers if they provide extra documentation.",
        type: QuestionType.TRUE_FALSE,
        answers: ["True", "False"] as any,
        correctKey: 1 as any,
        tags: ["CDD"],
        version: VERSION,
      },
      {
        courseId: course.id,
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
      {
        courseId: course.id,
        body: "If a customer’s IP address does not match their stated residence, what should you do?",
        type: QuestionType.MCQ_SINGLE,
        answers: [
          "Ignore it",
          "Proceed but make a note",
          "Flag to Compliance Department",
          "Ask IT to change their IP",
        ] as any,
        correctKey: 2 as any,
        tags: ["CDD"],
        version: VERSION,
      },
    ],
  });

  console.log("CDD quiz loaded: 8 questions");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

