/**
 * Atomically transfers tokens from learner to teacher when a session completes.
 * All reads and writes happen in one transaction — no partial state possible.
 */
export declare function transferTokensForSession(sessionId: string): Promise<void>;
/**
 * Refunds tokens to the learner if a session is cancelled.
 */
export declare function refundTokensForSession(sessionId: string): Promise<void>;
//# sourceMappingURL=token.service.d.ts.map