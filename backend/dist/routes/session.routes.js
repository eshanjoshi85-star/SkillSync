"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const token_service_1 = require("../services/token.service");
const matching_service_1 = require("../services/matching.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// GET /api/sessions/matches — find potential learning partners
router.get("/matches", async (req, res) => {
    try {
        const matches = await (0, matching_service_1.findMatches)(req.userId);
        return res.json(matches);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// GET /api/sessions — list sessions for current user
router.get("/", async (req, res) => {
    const sessions = await prisma_1.prisma.session.findMany({
        where: {
            OR: [{ teacherId: req.userId }, { learnerId: req.userId }],
        },
        include: {
            teacher: { select: { id: true, name: true } },
            learner: { select: { id: true, name: true } },
            skill: true,
        },
        orderBy: { scheduledTime: "asc" },
    });
    return res.json(sessions);
});
// POST /api/sessions — schedule a new session
router.post("/", async (req, res) => {
    const { teacherId, skillId, scheduledTime, durationMinutes } = req.body;
    if (!teacherId || !skillId || !scheduledTime || !durationMinutes) {
        return res.status(400).json({ error: "teacherId, skillId, scheduledTime, durationMinutes are required" });
    }
    if (![15, 30].includes(Number(durationMinutes))) {
        return res.status(400).json({ error: "durationMinutes must be 15 or 30" });
    }
    if (teacherId === req.userId) {
        return res.status(400).json({ error: "You cannot schedule a session with yourself" });
    }
    // Check learner has enough tokens
    const learner = await prisma_1.prisma.user.findUnique({ where: { id: req.userId } });
    if (!learner || learner.tokenBalance < 5) {
        return res.status(402).json({ error: "Insufficient tokens to schedule session (need 5)" });
    }
    const session = await prisma_1.prisma.session.create({
        data: {
            teacherId,
            learnerId: req.userId,
            skillId,
            scheduledTime: new Date(scheduledTime),
            durationMinutes: Number(durationMinutes),
        },
        include: {
            teacher: { select: { id: true, name: true } },
            learner: { select: { id: true, name: true } },
            skill: true,
        },
    });
    return res.status(201).json(session);
});
// PATCH /api/sessions/:id/status — accept or decline a session request
router.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        if (!["ACCEPTED", "DECLINED"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const session = await prisma_1.prisma.session.findUnique({ where: { id: req.params["id"] } });
        if (!session)
            return res.status(404).json({ error: "Session not found" });
        if (session.teacherId !== req.userId) {
            return res.status(403).json({ error: "Only the requested mentor can update the status" });
        }
        if (session.status !== "PENDING") {
            return res.status(400).json({ error: `Cannot update status of a ${session.status} session` });
        }
        let meetingLink = null;
        if (status === "ACCEPTED") {
            meetingLink = `https://meet.jit.si/SkillSync-${session.id}`;
        }
        const updatedSession = await prisma_1.prisma.session.update({
            where: { id: session.id },
            data: { status, meetingLink },
        });
        // Note: Tokens are not escrowed during PENDING, so no refund needed on DECLINED.
        // If we implement escrow later, we'd refund here.
        return res.json(updatedSession);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST /api/sessions/:id/complete — mark session complete and transfer tokens
router.post("/:id/complete", async (req, res) => {
    try {
        const session = await prisma_1.prisma.session.findUnique({ where: { id: req.params["id"] } });
        if (!session)
            return res.status(404).json({ error: "Session not found" });
        if (session.teacherId !== req.userId) {
            return res.status(403).json({ error: "Only the mentor can complete the session" });
        }
        if (session.status !== "ACCEPTED") {
            return res.status(400).json({ error: "Only ACCEPTED sessions can be completed" });
        }
        await (0, token_service_1.transferTokensForSession)(req.params["id"]);
        const updatedSession = await prisma_1.prisma.session.findUnique({ where: { id: req.params["id"] } });
        return res.json({ message: "Session completed, tokens transferred", session: updatedSession });
    }
    catch (err) {
        return res.status(400).json({ error: err.message });
    }
});
// PATCH /api/sessions/:id/cancel — cancel and refund
router.patch("/:id/cancel", async (req, res) => {
    try {
        await (0, token_service_1.refundTokensForSession)(req.params["id"]);
        await prisma_1.prisma.session.update({
            where: { id: req.params["id"] },
            data: { status: "CANCELLED" },
        });
        return res.json({ message: "Session cancelled and tokens refunded" });
    }
    catch (err) {
        return res.status(400).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=session.routes.js.map