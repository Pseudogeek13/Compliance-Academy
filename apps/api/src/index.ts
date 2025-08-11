import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
// Fallback local DB URL for dev if .env is missing
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://app:app@localhost:5436/compliance?schema=public";
}

const app = express();
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors({ origin: /localhost\:\d+$/, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
type JwtPayload = { sub: string; name: string; email: string; role: string };
function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    try {
      const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
      if (!token) return res.status(401).json({ error: 'unauthorized' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change') as JwtPayload;
      if (!roles.includes(decoded.role)) return res.status(403).json({ error: 'forbidden' });
      (req as any).user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'unauthorized' });
    }
  };
}

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Minimal auth placeholder (Azure AD would mint JWT; here we stub login)
app.post("/auth/dev-login", async (req, res) => {
  const { email = "learner@example.com", role = "LEARNER" } = req.body ?? {};
  const user = await prisma.user.upsert({ where: { email }, update: { role }, create: { email, name: email.split('@')[0], role } });
  const token = jwt.sign({ sub: user.id, name: user.name, email: user.email, role: user.role }, process.env.JWT_SECRET || 'dev-secret-change', { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true });
  res.json({ ok: true, user });
});

app.get("/me", async (req: any, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.json({});
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change') as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    res.json(user ?? {});
  } catch { res.json({}); }
});


// Courses list (published)
app.get("/courses", async (_req, res) => {
  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, title: true, version: true, validityDays: true, timeToCompleteMinutes: true },
  });
  res.json(courses);
});

// Assignments for a user (ensure assignment/enrollment and compute status)
app.get("/me/assignments", async (_req, res) => {
  const user = await prisma.user.upsert({
    where: { email: "learner@example.com" },
    update: {},
    create: { email: "learner@example.com", name: "Learner", role: "LEARNER", status: "active" },
  });

  const courses = await prisma.course.findMany({ where: { status: "PUBLISHED" } });
  const maxAttempts = 3;
  const results = [] as any[];
  for (const c of courses) {
    let assignment = await prisma.assignment.findFirst({ where: { courseId: c.id, version: c.version } });
    if (!assignment) {
      assignment = await prisma.assignment.create({
        data: {
          courseId: c.id,
          version: c.version,
          audienceFilter: {},
          dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    let enrollment = await prisma.enrollment.findFirst({ where: { userId: user.id, assignmentId: assignment.id } });
    if (!enrollment) {
      enrollment = await prisma.enrollment.create({ data: { userId: user.id, assignmentId: assignment.id, dueAt: assignment.dueAt } });
    }
    const attempts = await prisma.attempt.findMany({ where: { enrollmentId: enrollment.id }, orderBy: { startedAt: "desc" } });
    const passedAttempt = attempts.find((a) => a.passed === true) || null;
    const attemptsCount = attempts.length;
    const remainingAttempts = Math.max(0, maxAttempts - attemptsCount);
    let nextDueAt: Date | null = null;
    if (passedAttempt) {
      const base = passedAttempt.finishedAt || new Date();
      const addDays = c.validityDays ?? 365;
      nextDueAt = new Date(base.getTime() + addDays * 24 * 60 * 60 * 1000);
    }
    const totalLessons = await prisma.lesson.count({ where: { courseId: c.id } });
    const currentIdx = enrollment.currentLessonIndex ?? 0;
    const progress = totalLessons > 0 ? Math.min(100, Math.round((currentIdx / totalLessons) * 100)) : 0;
    const startedViaLessons = currentIdx > 1;
    const status = passedAttempt ? "Completed" : (startedViaLessons || attemptsCount > 0) ? "In Progress" : "Not Started";
    results.push({
      id: assignment.id,
      courseId: c.id,
      title: c.title,
      dueAt: assignment.dueAt,
      status,
      attemptsCount,
      remainingAttempts,
      passed: !!passedAttempt,
      nextDueAt,
      progress,
    });
  }
  res.json(results);
});

// Assignment details -> lessons + quiz link
app.get("/assignments/:id", async (req, res) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: req.params.id },
    include: { course: { include: { lessons: { orderBy: { order: "asc" } }, questions: true } } },
  });
  if (!assignment) return res.status(404).json({ error: "Not found" });
  const course = assignment.course;
  res.json({
    id: assignment.id,
    title: course.title,
    lessons: course.lessons,
    quiz: { questionCount: course.questions.length, id: course.id },
  });
});

// Persist lesson progress (store index on enrollment)
app.post("/assignments/:id/progress", async (req, res) => {
  const { currentLessonIndex } = req.body ?? {};
  const user = await prisma.user.findFirst({ where: { email: "learner@example.com" } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const enrollment = await prisma.enrollment.findFirst({ where: { assignmentId: req.params.id, userId: user.id } });
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
  const nextIndex = Math.max(enrollment.currentLessonIndex ?? 0, Number(currentLessonIndex ?? 0));
  const startedAt = (enrollment.startedAt ?? null) || (nextIndex > 1 ? new Date() : null);
  const updated = await prisma.enrollment.update({ where: { id: enrollment.id }, data: { currentLessonIndex: nextIndex, startedAt, status: nextIndex > 1 ? "IN_PROGRESS" : enrollment.status } });
  res.json({ ok: true, currentLessonIndex: updated.currentLessonIndex });
});

// Attempts (randomize question and answer order; evaluate on submit)
app.post("/attempts", async (req, res) => {
  const { courseId } = req.body ?? {};
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { questions: true } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  // Use stable learner user to avoid duplicate emails due to React dev double-mount
  const user = await prisma.user.upsert({
    where: { email: "learner@example.com" },
    update: {},
    create: { email: "learner@example.com", name: "Learner", role: "LEARNER", status: "active" },
  });
  let assignment = await prisma.assignment.findFirst({ where: { courseId: course.id, version: course.version } });
  if (!assignment) {
    assignment = await prisma.assignment.create({ data: { courseId: course.id, version: course.version, audienceFilter: {}, dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  }
  let enrollment = await prisma.enrollment.findFirst({ where: { userId: user.id, assignmentId: assignment.id } });
  if (!enrollment) {
    enrollment = await prisma.enrollment.create({ data: { userId: user.id, assignmentId: assignment.id, dueAt: assignment.dueAt, status: "IN_PROGRESS", startedAt: new Date() } });
  }

  const shuffledQuestions = [...course.questions].sort(() => Math.random() - 0.5);
  const attempt = await prisma.attempt.create({ data: { enrollmentId: enrollment.id } });

  // Create AttemptItems with randomized answer order
  for (const q of shuffledQuestions) {
    let answerOrder: number[] | null = null;
    let correctIndex: number | null = null;
    if (q.type === "MCQ_SINGLE" || q.type === "MCQ_MULTI" || q.type === "TRUE_FALSE") {
      const arr = Array.from({ length: (q.answers as any[]).length }, (_, i) => i);
      answerOrder = arr.sort(() => Math.random() - 0.5);
      const originalCorrect = typeof q.correctKey === "number" ? (q.correctKey as unknown as number) : 0;
      correctIndex = answerOrder.findIndex((i) => i === originalCorrect);
    }
    await prisma.attemptItem.create({
      data: {
        attemptId: attempt.id,
        questionId: q.id,
        selected: [],
        correct: false,
        answerOrder: answerOrder as any,
        correctIndex: correctIndex ?? undefined,
      },
    });
  }

  const items = await prisma.attemptItem.findMany({ where: { attemptId: attempt.id }, include: { question: true } });
  res.status(201).json({ id: attempt.id, items: items.map((it) => ({ id: it.id, question: it.question, answerOrder: it.answerOrder })) });
});

app.post("/attempts/:id/answers", async (req, res) => {
  const { itemId, selectedIndex, selectedText } = req.body ?? {};
  if (!itemId) return res.status(400).json({ error: "itemId required" });
  const item = await prisma.attemptItem.findUnique({ where: { id: itemId }, include: { question: true } });
  if (!item) return res.status(404).json({ error: "Attempt item not found" });

  if (item.question.type === "SHORT_ANSWER") {
    const expected = String(item.question.correctKey ?? "").trim().toLowerCase();
    const given = String(selectedText ?? "").trim().toLowerCase();
    const correct = expected.length > 0 && given === expected;
    await prisma.attemptItem.update({
      where: { id: itemId },
      data: { selected: selectedText ?? "", selectedIndex: null, correct },
    });
  } else {
    const correct = item.correctIndex != null ? selectedIndex === item.correctIndex : false;
    await prisma.attemptItem.update({
      where: { id: itemId },
      data: { selectedIndex: selectedIndex ?? null, selected: selectedIndex ?? null, correct },
    });
  }

  res.status(202).json({ ok: true });
});

app.post("/attempts/:id/submit", async (req, res) => {
  const attemptId = req.params.id;
  const items = await prisma.attemptItem.findMany({ where: { attemptId } });
  const total = items.length;
  const correct = items.filter((i) => i.correct).length;
  const score = Math.round((correct / Math.max(total, 1)) * 100);
  const passed = score >= 80;
  const attempt = await prisma.attempt.update({ where: { id: attemptId }, data: { score, passed, finishedAt: new Date() } });
  res.json(attempt);
});

// --- Admin API --- //
// List courses (all statuses)
app.get("/admin/courses", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (_req, res) => {
  const courses = await prisma.course.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(courses);
});

// Create course (DRAFT)
app.post("/admin/courses", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const { title, version = "1.0", required = true, validityDays = 365, timeToCompleteMinutes = 15, creditHours = 0.25 } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "title required" });
  try {
    const course = await prisma.course.create({ data: { title, version, required, validityDays, timeToCompleteMinutes, creditHours, status: "DRAFT" } });
    res.status(201).json(course);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Get course detail with lessons/questions
app.get("/admin/courses/:id", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.id }, include: { lessons: { orderBy: { order: "asc" } }, questions: true } });
  if (!course) return res.status(404).json({ error: "Not found" });
  res.json(course);
});

// Update course fields
app.patch("/admin/courses/:id", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const { title, required, validityDays, timeToCompleteMinutes, creditHours } = req.body ?? {};
  try {
    const updated = await prisma.course.update({
      where: { id: req.params.id },
      data: { title, required, validityDays, timeToCompleteMinutes, creditHours },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Workflow transition
app.post("/admin/courses/:id/status", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const { status } = req.body ?? {};
  if (!["DRAFT", "REVIEW", "PUBLISHED"].includes(status)) return res.status(400).json({ error: "invalid status" });
  const updated = await prisma.course.update({ where: { id: req.params.id }, data: { status } });
  res.json(updated);
});

// Add lesson (appends to end)
app.post("/admin/courses/:id/lessons", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const { title, body } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "title required" });
  const count = await prisma.lesson.count({ where: { courseId: req.params.id } });
  const lesson = await prisma.lesson.create({ data: { courseId: req.params.id, order: count + 1, content: { type: "richtext", title, body } } });
  res.status(201).json(lesson);
});

// Reorder lessons
app.post("/admin/courses/:id/lessons/reorder", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const { orderedIds } = req.body ?? {};
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "orderedIds[] required" });
  await prisma.$transaction(
    orderedIds.map((id: string, idx: number) => prisma.lesson.update({ where: { id }, data: { order: idx + 1 } }))
  );
  res.json({ ok: true });
});

// Add question
app.post("/admin/courses/:id/questions", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const { body, type = "MCQ_SINGLE", answers = [], correctKey = 0, tags = [] } = req.body ?? {};
  if (!body) return res.status(400).json({ error: "body required" });
  const question = await prisma.question.create({ data: { courseId: req.params.id, body, type, answers, correctKey, tags, version: (await prisma.course.findUnique({ where: { id: req.params.id } }))?.version || "1.0" } });
  res.status(201).json(question);
});

// Update question (body/answers/correctKey/type)
app.patch("/admin/questions/:questionId", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const { body, answers, correctKey, type } = req.body ?? {};
  try {
    const updated = await prisma.question.update({
      where: { id: req.params.questionId },
      data: { body, answers, correctKey, type },
    });
    // Clean up attempt items answer ordering when options change
    await prisma.attemptItem.deleteMany({ where: { questionId: updated.id } });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Update lesson content and media refs
app.patch("/admin/lessons/:lessonId", requireRole(["CONTENT_ADMIN", "SYSTEM_ADMIN"]), async (req, res) => {
  const { title, body, mediaRefs, replaceMedia } = req.body ?? {};
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
  if (!lesson) return res.status(404).json({ error: "Lesson not found" });
  const content = (lesson.content as any) || {};
  const nextContent = { ...content, title: title ?? content.title, body: body ?? content.body };
  let nextMedia = lesson.mediaRefs as any[] | null;
  if (Array.isArray(mediaRefs)) {
    if (replaceMedia) nextMedia = mediaRefs;
    else nextMedia = [ ...(nextMedia ?? []), ...mediaRefs ];
  }
  const updated = await prisma.lesson.update({ where: { id: lesson.id }, data: { content: nextContent as any, mediaRefs: nextMedia as any } });
  res.json(updated);
});

// Admin-only user overview
app.get("/admin/users", requireRole(["SYSTEM_ADMIN"]), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: "@example.com" } } },
    include: { enrollments: { include: { assignment: { include: { course: true } }, attempts: true } } },
    orderBy: { name: "asc" },
  });
  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    enrollments: u.enrollments.map((e) => ({
      course: e.assignment.course.title,
      status: e.status,
      attempts: e.attempts.length,
      passed: e.attempts.some(a => a.passed),
      dueAt: e.dueAt,
    })),
  }));
  res.json(rows);
});

// Admin: add user by email and auto-assign published courses
app.post("/admin/users", requireRole(["SYSTEM_ADMIN"]), async (req, res) => {
  const { email, role = "LEARNER" } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "email required" });
  const user = await prisma.user.upsert({ where: { email }, update: { role }, create: { email, name: email.split('@')[0], role, status: "active" } });
  const courses = await prisma.course.findMany({ where: { status: "PUBLISHED" } });
  for (const c of courses) {
    let assignment = await prisma.assignment.findFirst({ where: { courseId: c.id, version: c.version } });
    if (!assignment) {
      assignment = await prisma.assignment.create({ data: { courseId: c.id, version: c.version, audienceFilter: {}, dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
    }
    const existing = await prisma.enrollment.findFirst({ where: { userId: user.id, assignmentId: assignment.id } });
    if (!existing) {
      await prisma.enrollment.create({ data: { userId: user.id, assignmentId: assignment.id, dueAt: assignment.dueAt, status: "NOT_STARTED" } });
    }
  }
  res.status(201).json({ ok: true });
});

// Admin: update user role
app.patch("/admin/users/:id", requireRole(["SYSTEM_ADMIN"]), async (req, res) => {
  const { role } = req.body ?? {};
  if (!role) return res.status(400).json({ error: "role required" });
  const updated = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
  res.json({ ok: true, user: updated });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

