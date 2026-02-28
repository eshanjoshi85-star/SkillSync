import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const TOKEN_COST_PER_SESSION = 5;

/**
 * Atomically transfers tokens from learner to teacher when a session completes.
 */
export async function transferTokensForSession(sessionId: string): Promise<void> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

        const session = await tx.session.findUnique({ where: { id: sessionId } });
        if (!session) throw new Error("Session not found");
        if (session.status === "COMPLETED") throw new Error("Tokens already transferred for this session");
        if (session.status !== "ACCEPTED") throw new Error("Only ACCEPTED sessions can have tokens transferred");

        const learner = await tx.user.findUnique({ where: { id: session.learnerId } });
        if (!learner) throw new Error("Learner not found");
        if (learner.tokenBalance < TOKEN_COST_PER_SESSION) {
            throw new Error(`Insufficient tokens. Need ${TOKEN_COST_PER_SESSION}, have ${learner.tokenBalance}`);
        }

        const amount = TOKEN_COST_PER_SESSION;

        await tx.user.update({
            where: { id: session.learnerId },
            data: { tokenBalance: { decrement: amount } },
        });

        await tx.user.update({
            where: { id: session.teacherId },
            data: { tokenBalance: { increment: amount } },
        });

        await tx.tokenHistory.create({
            data: {
                userId: session.learnerId,
                amount: -amount,
                type: TransactionType.SPENT_LEARNING,
                sessionId,
            },
        });

        await tx.tokenHistory.create({
            data: {
                userId: session.teacherId,
                amount: amount,
                type: TransactionType.EARNED_TEACHING,
                sessionId,
            },
        });

        await tx.session.update({
            where: { id: sessionId },
            data: { status: "COMPLETED", tokensTransferred: amount, updatedAt: new Date() },
        });
    });
}

/**
 * Refunds tokens to the learner if a session is cancelled.
 */
export async function refundTokensForSession(sessionId: string): Promise<void> {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const session = await tx.session.findUnique({ where: { id: sessionId } });
        if (!session) throw new Error("Session not found");
        if (session.tokensTransferred === 0) return;

        await tx.user.update({
            where: { id: session.learnerId },
            data: { tokenBalance: { increment: session.tokensTransferred } },
        });

        await tx.tokenHistory.create({
            data: {
                userId: session.learnerId,
                amount: session.tokensTransferred,
                type: TransactionType.REFUND,
                sessionId,
            },
        });
    });
}
