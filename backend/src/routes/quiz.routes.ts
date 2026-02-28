import { Router, Response } from "express";
import multer from "multer";
import { authenticate, AuthRequest } from "../middleware/auth.middleware.js";
import { checkNotBlocked } from "../middleware/checkNotBlocked.js";
import { prisma } from "../lib/prisma.js";
import {
    extractTextFromResume,
    generateQuizQuestions,
    saveQuizAttempt,
    QuizQuestion,
} from "../services/quiz.service.js";
import { extractSkillsFromText } from "../utils/extractSkills.js";

const router = Router();

// Memory storage – we only need the buffer for pdf-parse, never write to disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/extract-skills
// Upload a resume PDF → returns matched skill keywords
// ─────────────────────────────────────────────────────────────────────────────
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
            if (req.file.mimetype !== "application/pdf") {
                res.status(400).json({ error: "Only PDF files are accepted" });
                return;
            }

            const resumeText = await extractTextFromResume(req.file.buffer);
            const skills = extractSkillsFromText(resumeText);

            res.json({ skills });
        } catch (err: any) {
            console.error("Skill extraction error:", err);
            const status = err.message?.includes("valid") ? 400 : 500;
            res.status(status).json({ error: err.message || "Failed to extract skills" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/generate
// Accepts JSON body: { skills: string[] }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    "/generate",
    authenticate,
    checkNotBlocked,
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { skills } = req.body as { skills?: unknown };

            if (!Array.isArray(skills) || skills.length === 0) {
                res.status(400).json({ error: "skills must be a non-empty array of strings" });
                return;
            }

            const validSkills = skills.filter((s): s is string => typeof s === "string" && s.trim() !== "");
            if (validSkills.length === 0) {
                res.status(400).json({ error: "All provided skills were empty strings" });
                return;
            }

            const questions = await generateQuizQuestions(validSkills);
            res.json({ questions, skills: validSkills });
        } catch (err: any) {
            console.error("Quiz generation error:", err);
            res.status(500).json({ error: err.message || "Failed to generate quiz" });
        }
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/submit
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/violation
// ─────────────────────────────────────────────────────────────────────────────
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
