"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const checkNotBlocked_1 = require("../middleware/checkNotBlocked");
const prisma_1 = require("../lib/prisma");
const quiz_service_1 = require("../services/quiz.service");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
// POST /api/quiz/generate
// Upload a resume PDF and select 1–2 skills to receive generated questions
router.post("/generate", auth_middleware_1.authenticate, checkNotBlocked_1.checkNotBlocked, upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "Resume PDF is required" });
            return;
        }
        const rawSkills = req.body.skills;
        const skills = Array.isArray(rawSkills)
            ? rawSkills
            : typeof rawSkills === "string"
                ? JSON.parse(rawSkills)
                : [];
        if (!skills.length || skills.length > 2) {
            res.status(400).json({ error: "Select 1 or 2 skills for the quiz" });
            return;
        }
        const resumeText = await (0, quiz_service_1.extractTextFromResume)(req.file.buffer);
        const questions = await (0, quiz_service_1.generateQuizQuestions)(skills, resumeText);
        res.json({ questions, skills });
    }
    catch (err) {
        console.error("Quiz generation error:", err);
        res.status(500).json({ error: err.message || "Failed to generate quiz" });
    }
});
// POST /api/quiz/submit
// Submit answers and persist the attempt
router.post("/submit", auth_middleware_1.authenticate, checkNotBlocked_1.checkNotBlocked, async (req, res) => {
    try {
        const { skills, questions, answers } = req.body;
        if (!skills || !questions || !answers) {
            res.status(400).json({ error: "skills, questions, and answers are required" });
            return;
        }
        const result = await (0, quiz_service_1.saveQuizAttempt)(req.userId, skills, questions, answers);
        res.json(result);
    }
    catch (err) {
        console.error("Quiz submit error:", err);
        res.status(500).json({ error: err.message || "Failed to submit quiz" });
    }
});
// POST /api/quiz/violation
// Report a tab-switch / blur violation; block user if count >= 3
router.post("/violation", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const BLOCK_THRESHOLD = 3;
        const BLOCK_HOURS = 24;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.userId },
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
        const updated = await prisma_1.prisma.user.update({
            where: { id: req.userId },
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
    }
    catch (err) {
        console.error("Violation error:", err);
        res.status(500).json({ error: "Failed to record violation" });
    }
});
exports.default = router;
//# sourceMappingURL=quiz.routes.js.map