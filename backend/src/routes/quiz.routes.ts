import { Router, Response } from "express";
import multer from "multer";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";
import { checkNotBlocked } from "../middleware/checkNotBlocked";
import { prisma } from "../lib/prisma";
import {
    extractTextFromResume,
    extractSkills,
    generateQuizQuestions,
    saveQuizAttempt,
    QuizQuestion,
} from "../services/quiz.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/quiz/extract-skills
// Upload a resume PDF and automatically extract matching skills
router.post(
    "/extract-skills",
    authenticate,
    checkNotBlocked,
    upload.single("resume"),
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ error: "Resume PDF is required" });
                return;
            }
            const resumeText = await extractTextFromResume(req.file.buffer);
            const skills = extractSkills(resumeText);

            res.json({ skills });
        } catch (err: any) {
            console.error("Skill extraction error:", err);
            res.status(500).json({ error: err.message || "Failed to extract skills" });
        }
    }
);

// POST /api/quiz/generate
// Upload a resume PDF and select 1–2 skills to receive generated questions
router.post(
    "/generate",
    authenticate,
    checkNotBlocked,
    upload.single("resume"),
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                res.status(400).json({ error: "Resume PDF is required" });
                return;
            }

            const rawSkills = req.body.skills;
            const skills: string[] = Array.isArray(rawSkills)
                ? rawSkills
                : typeof rawSkills === "string"
                    ? JSON.parse(rawSkills)
                    : [];

            if (!skills.length || skills.length > 2) {
                res.status(400).json({ error: "Select 1 or 2 skills for the quiz" });
                return;
            }

            const resumeText = await extractTextFromResume(req.file.buffer);
            const questions = await generateQuizQuestions(skills, resumeText);

            res.json({ questions, skills });
        } catch (err: any) {
            console.error("Quiz generation error:", err);
            res.status(500).json({ error: err.message || "Failed to generate quiz" });
        }
    }
);

// POST /api/quiz/submit
// Submit answers and persist the attempt
router.post(
    "/submit",
    authenticate,
    checkNotBlocked,
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { skills, questions, answers } = req.body as {
                skills: string[];
                questions: QuizQuestion[];
                answers: Record<string, number>;
            };

            if (!skills || !questions || !answers) {
                res.status(400).json({ error: "skills, questions, and answers are required" });
                return;
            }

            const result = await saveQuizAttempt(req.userId!, skills, questions, answers);
            res.json(result);
        } catch (err: any) {
            console.error("Quiz submit error:", err);
            res.status(500).json({ error: err.message || "Failed to submit quiz" });
        }
    }
);

// POST /api/quiz/violation
// Report a tab-switch / blur violation; block user if count >= 3
router.post(
    "/violation",
    authenticate,
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const BLOCK_THRESHOLD = 3;
            const BLOCK_HOURS = 24;

            const user = await prisma.user.findUnique({
                where: { id: req.userId! },
                select: { violationCount: true, isBlockedUntil: true },
            });

            if (!user) {
                res.status(404).json({ error: "User not found" });
                return;
            }

            const newCount = user.violationCount + 1;
            const shouldBlock = newCount >= BLOCK_THRESHOLD;
            const blockUntil = shouldBlock
                ? new Date(Date.now() + BLOCK_HOURS * 60 * 60 * 1000)
                : user.isBlockedUntil;

            const updated = await prisma.user.update({
                where: { id: req.userId! },
                data: {
                    violationCount: newCount,
                    ...(shouldBlock ? { isBlockedUntil: blockUntil } : {}),
                },
                select: { violationCount: true, isBlockedUntil: true },
            });

            res.json({
                violationCount: updated.violationCount,
                blocked: shouldBlock,
                unlocksAt: updated.isBlockedUntil?.toISOString() ?? null,
                message: shouldBlock
                    ? `You have been blocked for ${BLOCK_HOURS} hours due to ${BLOCK_THRESHOLD} violations.`
                    : `Warning: violation ${newCount}/${BLOCK_THRESHOLD}. Further violations will result in a ${BLOCK_HOURS}-hour block.`,
            });
        } catch (err: any) {
            console.error("Violation error:", err);
            res.status(500).json({ error: "Failed to record violation" });
        }
    }
);

export default router;
