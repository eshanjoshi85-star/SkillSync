import { Router, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, AuthRequest } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

// GET /api/users/me
router.get("/me", async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
            id: true,
            email: true,
            name: true,
            bio: true,
            tokenBalance: true,
            createdAt: true,
            quizVerifiedSkills: {
                select: { skill: true, verified: true, verifiedAt: true, bestScore: true, attempts: true },
                orderBy: { updatedAt: "desc" },
            },
        },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
});


// GET /api/users/me/skills
router.get("/me/skills", async (req: AuthRequest, res: Response) => {
    const skills = await prisma.userSkill.findMany({
        where: { userId: req.userId },
        include: { skill: true },
    });
    return res.json(skills);
});

// POST /api/users/me/skills
router.post("/me/skills", async (req: AuthRequest, res: Response) => {
    const { skillName, category, type, proficiencyLevel } = req.body;
    if (!skillName || !type) return res.status(400).json({ error: "skillName and type are required" });
    if (!["TEACH", "LEARN"].includes(type)) return res.status(400).json({ error: "type must be TEACH or LEARN" });

    const skill = await prisma.skill.upsert({
        where: { name: skillName },
        update: {},
        create: { name: skillName, category: category ?? "General" },
    });

    const userSkill = await prisma.userSkill.upsert({
        where: { userId_skillId_type: { userId: req.userId!, skillId: skill.id, type } },
        update: { proficiencyLevel },
        create: { userId: req.userId!, skillId: skill.id, type, proficiencyLevel },
        include: { skill: true },
    });

    return res.status(201).json(userSkill);
});

// DELETE /api/users/me/skills/:id
router.delete("/me/skills/:id", async (req: AuthRequest, res: Response) => {
    await prisma.userSkill.deleteMany({ where: { id: req.params["id"] as string, userId: req.userId } });
    return res.json({ message: "Skill removed" });
});

// GET /api/users/me/token-history
router.get("/me/token-history", async (req: AuthRequest, res: Response) => {
    const history = await prisma.tokenHistory.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return res.json(history);
});

export default router;
