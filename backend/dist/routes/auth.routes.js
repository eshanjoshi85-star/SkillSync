"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const passport_1 = __importDefault(require("passport"));
const prisma_1 = require("../lib/prisma");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post("/register", async (req, res) => {
    const { email, password, name, bio } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: "email, password, and name are required" });
    }
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing)
        return res.status(409).json({ error: "Email already in use" });
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const user = await prisma_1.prisma.user.create({
        data: { email, passwordHash, name, bio },
        select: { id: true, email: true, name: true, tokenBalance: true, createdAt: true },
    });
    // Grant welcome bonus
    await prisma_1.prisma.tokenHistory.create({
        data: { userId: user.id, amount: 10, type: "SYSTEM_BONUS" },
    });
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.status(201).json({ user, token });
});
// POST /api/auth/login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: "email and password are required" });
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user)
        return res.status(401).json({ error: "Invalid credentials" });
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!valid)
        return res.status(401).json({ error: "Invalid credentials" });
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, tokenBalance: user.tokenBalance },
    });
});
// GET /api/auth/google
router.get("/google", passport_1.default.authenticate("google", { scope: ["profile", "email"], session: false }));
// GET /api/auth/google/callback
router.get("/google/callback", passport_1.default.authenticate("google", { session: false, failureRedirect: "/login?error=oauth_failed" }), (req, res) => {
    const user = req.user;
    if (!user)
        return res.redirect("/login?error=oauth_failed");
    const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/oauth-callback?token=${token}`);
});
// GET /api/auth/me
router.get("/me", auth_middleware_1.authenticate, async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true, tokenBalance: true, bio: true }
    });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    return res.json({ user });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map