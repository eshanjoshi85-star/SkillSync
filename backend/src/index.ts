import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import "./config/passport";
import passport from "passport";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import sessionRoutes from "./routes/session.routes";
import quizRoutes from "./routes/quiz.routes";
import mentorRoutes from "./routes/mentor.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security & parsing
app.use(helmet());
const frontendUrls = process.env.NODE_ENV === "production"
    ? [process.env.FRONTEND_URL || "https://skillsync.vercel.app"]
    : [
        process.env.FRONTEND_URL || "http://localhost:5173",
        process.env.CLIENT_URL || "http://localhost:5173",
        "http://localhost:3000"
    ];
app.use(cors({ origin: frontendUrls, credentials: true }));
app.use(express.json());
app.use(passport.initialize());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/mentors", mentorRoutes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
    console.log(`🚀 SkillSync API running on http://localhost:${PORT}`);
});

export default app;
