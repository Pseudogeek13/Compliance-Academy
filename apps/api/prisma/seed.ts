import { PrismaClient, CourseStatus, Role } from "@prisma/client";

const prisma = new PrismaClient();

const seedCourses = [
  "Compliance Manual",
  "Customer Due Diligence (KYC/EDD/monitoring)",
  "AML Business Risk Assessment",
  "Security Plan",
  "Market Surveillance & Abuse",
  "Anti-Fraud",
  "Complaints Handling",
  "Business Continuity & DR",
  "Custody Policy",
  "Outsourcing/Vendor Management",
  "User Agreement & Privacy Policy",
  "Listing/Delisting Policy",
  "Market Rulebook",
  "Third-Party Custodian Assessment",
];

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "System Admin",
      role: Role.SYSTEM_ADMIN,
      status: "active",
    },
  });

  for (const title of seedCourses) {
    await prisma.course.upsert({
      where: { title_version_unique: { title, version: "1.0" } },
      update: {},
      create: {
        title,
        version: "1.0",
        status: CourseStatus.PUBLISHED,
        required: true,
        validityDays: 365,
        timeToCompleteMinutes: 15,
        creditHours: 0.25,
        lessons: {
          create: [
            {
              order: 1,
              content: { type: "richtext", body: `${title} overview` },
            },
          ],
        },
        questions: {
          create: Array.from({ length: 8 }).map((_, i) => ({
            body: `${title} question ${i + 1}`,
            type: "MCQ_SINGLE" as any,
            answers: ["A", "B", "C", "D"] as any,
            correctKey: 0 as any,
            tags: ["seed"],
            version: "1.0",
          })),
        },
      },
    });
  }

  console.log("Seed complete. Admin:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
