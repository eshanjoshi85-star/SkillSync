import { Router, Response } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth.middleware";

const router = Router();
router.use(authenticate);

// GET /api/mentors
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const { skill, search } = req.query;

        const skillFilter = skill ? {
            skill: {
                name: { equals: skill as string, mode: "insensitive" as const }
            }
        } : {};

        const searchFilter = search ? {
            name: { contains: search as string, mode: "insensitive" as const }
        } : {};

        const mentors = await prisma.user.findMany({
            where: {
                id: { not: req.userId }, // Exclude current user
                skills: {
                    some: {
                        type: "TEACH",
                        ...skillFilter
                    }
                },
                ...searchFilter
            },
            select: {
                id: true,
                name: true,
                bio: true,
                skills: {
                    where: { type: "TEACH" },
                    include: { skill: true }
                },
                quizAttempts: {
                    where: { passed: true },
                    take: 1
                }
            }
        });

        // Format to include a simplified isVerified flag and token cost
        const formattedMentors = mentors.map((m: any) => ({
            id: m.id,
            name: m.name,
            bio: m.bio,
            skills: m.skills.map((s: any) => ({
                id: s.skill.id,
                name: s.skill.name,
                category: s.skill.category,
                proficiencyLevel: s.proficiencyLevel
            })),
            isVerified: m.quizAttempts.length > 0,
            tokenCost: 5 // Fixed minimum token cost per session for now
        }));

        res.json(formattedMentors);
    } catch (err: any) {
        console.error("Error fetching mentors:", err);
        res.status(500).json({ error: "Failed to fetch mentors" });
    }
});

export default router;
