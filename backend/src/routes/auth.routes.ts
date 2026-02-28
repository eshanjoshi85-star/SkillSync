import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport";
import { prisma } from "../lib/prisma.js";
import { authenticate, AuthRequest } from "../middleware/auth.middleware.js";

const router = Router();


// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
    const { email, password, name, bio } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: "email, password, and name are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
        data: { email, passwordHash, name, bio },
        select: { id: true, email: true, name: true, tokenBalance: true, createdAt: true },
    });

    // Grant welcome bonus
    await prisma.tokenHistory.create({
        data: { userId: user.id, amount: 10, type: "SYSTEM_BONUS" },
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    return res.status(201).json({ user, token });
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    return res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, tokenBalance: user.tokenBalance },
    });
});

// GET /api/auth/google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

// GET /api/auth/google/callback
router.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/login?error=oauth_failed" }),
    (req: Request, res: Response) => {
        const user = req.user as any;
        if (!user) return res.redirect("/login?error=oauth_failed");

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        res.redirect(`${frontendUrl}/oauth-callback?token=${token}`);
    }
);

// GET /api/auth/me
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true, tokenBalance: true, bio: true }
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({ user });
});

export default router;
