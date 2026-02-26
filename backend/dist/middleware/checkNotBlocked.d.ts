import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
/**
 * Middleware: blocks users whose isBlockedUntil is in the future.
 * Must be used AFTER the `authenticate` middleware so req.userId is set.
 */
export declare const checkNotBlocked: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=checkNotBlocked.d.ts.map