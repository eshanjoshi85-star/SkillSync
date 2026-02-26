"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// GET /api/mentors
router.get("/", async (req, res) => {
    try {
        const { skill, search } = req.query;
        const skillFilter = skill ? {
            skill: {
                name: { equals: skill, mode: "insensitive" }
            }
        } : {};
        const searchFilter = search ? {
            name: { contains: search, mode: "insensitive" }
        } : {};
        const mentors = await prisma_1.prisma.user.findMany({
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
        const formattedMentors = mentors.map((m) => ({
            id: m.id,
            name: m.name,
            bio: m.bio,
            skills: m.skills.map((s) => ({
                id: s.skill.id,
                name: s.skill.name,
                category: s.skill.category,
                proficiencyLevel: s.proficiencyLevel
            })),
            isVerified: m.quizAttempts.length > 0,
            tokenCost: 5 // Fixed minimum token cost per session for now
        }));
        res.json(formattedMentors);
    }
    catch (err) {
        console.error("Error fetching mentors:", err);
        res.status(500).json({ error: "Failed to fetch mentors" });
    }
});
exports.default = router;
//# sourceMappingURL=mentor.routes.js.map