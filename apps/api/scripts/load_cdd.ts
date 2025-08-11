import { PrismaClient, CourseStatus } from "@prisma/client";

const prisma = new PrismaClient();

const CDD_TITLE = "Customer Due Diligence (KYC/EDD/monitoring)";
const VERSION = "1.0";

const sections: { title: string; body: string }[] = [
  { title: "Welcome to your CDD training!", body: `If you’ve ever signed up for a bank account, a trading platform, or even bought cryptocurrency through an exchange, you’ve probably gone through Customer Due Diligence without even realizing it. It’s the process of figuring out exactly who our customers are, understanding their background, and checking if doing business with them is safe and legal.

Think of it as “getting to know someone before you trust them with your house keys” — except in our case, the house is Bumba’s platform, and the “keys” are the services we provide.` },
  { title: "Why We Do CDD (Short version)", body: `We’re legally required to do it under the BVI VASP Act and the BVI AML & TF Code of Practice, and it’s one of the most important ways we protect the company from being used for money laundering, terrorist financing, or dealing with people and businesses we shouldn’t.` },
  { title: "Why We Do CDD (Longer version)", body: `Without CDD, criminals could hide behind fake identities, anonymous companies, or shady transactions. If that happened, regulators could fine us, shut us down, or worse — we could unintentionally help fund illegal activity. That’s why CDD isn’t just “compliance work” — it’s protecting our reputation, our licence, and our ability to do business.` },
  { title: "When We Do CDD", body: `We check our customers’ identities whenever: They first sign up (onboarding). They make a big one-off transaction above certain thresholds. Something suspicious pops up during our monitoring. It’s time for a regular review of their account.` },
  { title: "How CDD Works: Overview", body: `Here’s the journey from “new customer” to “cleared to use our services”.` },
  { title: "Step 1: Risk Assessment", body: `Every new customer starts with a quick risk score: geography, type (individual/company), services, and unusual factors. Low-risk move quickly; high-risk need MLRO and Board approval.` },
  { title: "Step 2: Identity Verification", body: `Individuals: passport/ID via SumSub. Companies: incorporation documents, ownership, and beneficial owners.` },
  { title: "Step 3: Screening", body: `We screen for PEPs (politically exposed persons), sanctions, and adverse media in trusted databases.` },
  { title: "Step 4: Decision & Approval", body: `Low/medium risk: Compliance signs off. High risk: MLRO and Board decide.` },
  { title: "Step 5: Record-Keeping", body: `All collected data (IDs, screening, approvals) must be securely stored for at least six years, including after the customer leaves.` },
  { title: "Enhanced Due Diligence (EDD)", body: `EDD applies to PEPs, high-risk countries, complex ownership. We capture Source of Wealth and Source of Funds and get senior approvals.` },
  { title: "Who We Cannot Onboard", body: `No anonymous accounts, shell banks, sanctioned countries, or prohibited industries (see Prohibited Business List).` },
  { title: "Ongoing Monitoring", body: `CDD continues after onboarding: periodic reviews by risk, continuous sanctions/PEP screening, and monitoring for unusual transactions.` },
  { title: "Why This Matters to You", body: `Everyone plays a part: spot and flag unusual activity, understand onboarding delays, and ask Compliance when unsure.` },
  { title: "Course Wrap-Up", body: `CDD in a nutshell: know your customer, check their background, and keep records. It’s about certainty, not suspicion. When ready, take the quiz to complete your training.` },
];

async function main() {
  const course = await prisma.course.upsert({
    where: { title_version_unique: { title: CDD_TITLE, version: VERSION } },
    update: {},
    create: {
      title: CDD_TITLE,
      version: VERSION,
      status: CourseStatus.PUBLISHED,
      required: true,
      validityDays: 365,
      timeToCompleteMinutes: 20,
      creditHours: 0.33,
    },
  });

  // Remove any existing lessons to replace with structured bites
  await prisma.lesson.deleteMany({ where: { courseId: course.id } });

  // Insert lessons in order
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    await prisma.lesson.create({
      data: {
        courseId: course.id,
        order: i + 1,
        content: { type: "richtext", title: s.title, body: s.body },
      },
    });
  }

  console.log(`CDD content loaded: ${sections.length} lessons`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

