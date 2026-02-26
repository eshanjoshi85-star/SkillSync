"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// GET /api/users/me
router.get("/me", async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true, bio: true, tokenBalance: true, createdAt: true },
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    return res.json(user);
});
// GET /api/users/me/skills
router.get("/me/skills", async (req, res) => {
    const skills = await prisma_1.prisma.userSkill.findMany({
        where: { userId: req.userId },
        include: { skill: true },
    });
    return res.json(skills);
});
// POST /api/users/me/skills
router.post("/me/skills", async (req, res) => {
    const { skillName, category, type, proficiencyLevel } = req.body;
    if (!skillName || !type)
        return res.status(400).json({ error: "skillName and type are required" });
    if (!["TEACH", "LEARN"].includes(type))
        return res.status(400).json({ error: "type must be TEACH or LEARN" });
    const skill = await prisma_1.prisma.skill.upsert({
        where: { name: skillName },
        update: {},
        create: { name: skillName, category: category ?? "General" },
    });
    const userSkill = await prisma_1.prisma.userSkill.upsert({
        where: { userId_skillId_type: { userId: req.userId, skillId: skill.id, type } },
        update: { proficiencyLevel },
        create: { userId: req.userId, skillId: skill.id, type, proficiencyLevel },
        include: { skill: true },
    });
    return res.status(201).json(userSkill);
});
// DELETE /api/users/me/skills/:id
router.delete("/me/skills/:id", async (req, res) => {
    await prisma_1.prisma.userSkill.deleteMany({ where: { id: req.params["id"], userId: req.userId } });
    return res.json({ message: "Skill removed" });
});
// GET /api/users/me/token-history
router.get("/me/token-history", async (req, res) => {
    const history = await prisma_1.prisma.tokenHistory.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return res.json(history);
});
exports.default = router;
//# sourceMappingURL=user.routes.js.map