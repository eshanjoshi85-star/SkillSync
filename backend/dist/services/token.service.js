"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferTokensForSession = transferTokensForSession;
exports.refundTokensForSession = refundTokensForSession;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const TOKEN_COST_PER_SESSION = 5;
/**
 * Atomically transfers tokens from learner to teacher when a session completes.
 * All reads and writes happen in one transaction — no partial state possible.
 */
async function transferTokensForSession(sessionId) {
    await prisma_1.prisma.$transaction(async (tx) => {
        const session = await tx.session.findUnique({ where: { id: sessionId } });
        if (!session)
            throw new Error("Session not found");
        if (session.status === "COMPLETED")
            throw new Error("Tokens already transferred for this session");
        if (session.status !== "ACCEPTED")
            throw new Error("Only ACCEPTED sessions can have tokens transferred");
        const learner = await tx.user.findUnique({ where: { id: session.learnerId } });
        if (!learner)
            throw new Error("Learner not found");
        if (learner.tokenBalance < TOKEN_COST_PER_SESSION) {
            throw new Error(`Insufficient tokens. Need ${TOKEN_COST_PER_SESSION}, have ${learner.tokenBalance}`);
        }
        const amount = TOKEN_COST_PER_SESSION;
        // Deduct from learner
        await tx.user.update({
            where: { id: session.learnerId },
            data: { tokenBalance: { decrement: amount } },
        });
        // Add to teacher
        await tx.user.update({
            where: { id: session.teacherId },
            data: { tokenBalance: { increment: amount } },
        });
        // Record transaction for learner
        await tx.tokenHistory.create({
            data: {
                userId: session.learnerId,
                amount: -amount,
                type: client_1.TransactionType.SPENT_LEARNING,
                sessionId,
            },
        });
        // Record transaction for teacher
        await tx.tokenHistory.create({
            data: {
                userId: session.teacherId,
                amount: amount,
                type: client_1.TransactionType.EARNED_TEACHING,
                sessionId,
            },
        });
        // Mark session as completed and record token amount
        await tx.session.update({
            where: { id: sessionId },
            data: { status: "COMPLETED", tokensTransferred: amount, updatedAt: new Date() },
        });
    });
}
/**
 * Refunds tokens to the learner if a session is cancelled.
 */
async function refundTokensForSession(sessionId) {
    await prisma_1.prisma.$transaction(async (tx) => {
        const session = await tx.session.findUnique({ where: { id: sessionId } });
        if (!session)
            throw new Error("Session not found");
        if (session.tokensTransferred === 0)
            return; // Nothing to refund
        await tx.user.update({
            where: { id: session.learnerId },
            data: { tokenBalance: { increment: session.tokensTransferred } },
        });
        await tx.tokenHistory.create({
            data: {
                userId: session.learnerId,
                amount: session.tokensTransferred,
                type: client_1.TransactionType.REFUND,
                sessionId,
            },
        });
    });
}
//# sourceMappingURL=token.service.js.map