import React, { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

interface LockdownWrapperProps {
    children: React.ReactNode;
    onViolation?: (count: number, blocked: boolean, unlocksAt: string | null) => void;
    onBlocked?: (unlocksAt: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function LockdownWrapper({ children, onViolation, onBlocked }: LockdownWrapperProps) {
    const { token } = useAuth();
    // Local count of ALL violations (including the grace-period first one)
    const localViolationCountRef = useRef(0);
    const isReportingRef = useRef(false);

    const reportViolation = useCallback(async () => {
        // Debounce: don't fire multiple simultaneous reports
        if (isReportingRef.current) return;
        isReportingRef.current = true;

        // Increment local counter first
        localViolationCountRef.current += 1;
        const localCount = localViolationCountRef.current;

        // Grace period: first violation → show toast only, do NOT hit the API
        if (localCount === 1) {
            onViolation?.(1, false, null);
            // Release debounce quickly so the next real violation can fire
            setTimeout(() => {
                isReportingRef.current = false;
            }, 2000);
            return;
        }

        // 2nd and 3rd violations → report to the server
        try {
            const res = await fetch(`${API_BASE}/api/quiz/violation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await res.json();

            onViolation?.(data.violationCount, data.blocked, data.unlocksAt ?? null);

            if (data.blocked && data.unlocksAt) {
                onBlocked?.(data.unlocksAt);
            }
        } catch (err) {
            console.error('Failed to report violation:', err);
        } finally {
            // Allow next report after 2 seconds
            setTimeout(() => {
                isReportingRef.current = false;
            }, 2000);
        }
    }, [token, onViolation, onBlocked]);

    // Force fullscreen on mount
    const enterFullscreen = useCallback(() => {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => {
                // Fullscreen may be blocked; still proceed
            });
        }
    }, []);

    useEffect(() => {
        enterFullscreen();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                reportViolation();
            }
        };

        const handleBlur = () => {
            reportViolation();
        };

        const handleFullscreenChange = () => {
            // If user escaped fullscreen, try to re-enter and report
            if (!document.fullscreenElement) {
                reportViolation();
                // Re-enter fullscreen after short delay
                setTimeout(enterFullscreen, 500);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);

            // Exit fullscreen when quiz is done
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
        };
    }, [reportViolation, enterFullscreen]);

    return <>{children}</>;
}
