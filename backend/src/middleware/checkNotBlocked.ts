import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "./auth.middleware";

/**
 * Middleware: blocks users whose isBlockedUntil is in the future.
 * Must be used AFTER the `authenticate` middleware so req.userId is set.
 */
export const checkNotBlocked = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isBlockedUntil: true, violationCount: true },
    });

    if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
    }

    if (user.isBlockedUntil && user.isBlockedUntil > new Date()) {
        const unlocksAt = user.isBlockedUntil.toISOString();
        res.status(403).json({
            error: "Account temporarily blocked due to quiz violations.",
            code: "ACCOUNT_BLOCKED",
            unlocksAt,
            violationCount: user.violationCount,
        });
        return;
    }

    next();
};
