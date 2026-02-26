"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
require("./config/passport");
const passport_1 = __importDefault(require("passport"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const session_routes_1 = __importDefault(require("./routes/session.routes"));
const quiz_routes_1 = __importDefault(require("./routes/quiz.routes"));
const mentor_routes_1 = __importDefault(require("./routes/mentor.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Security & parsing
app.use((0, helmet_1.default)());
const frontendUrls = process.env.NODE_ENV === "production"
    ? ["https://skillsync.vercel.app"]
    : [
        process.env.FRONTEND_URL || "http://localhost:5173",
        process.env.CLIENT_URL || "http://localhost:5173",
        "http://localhost:3000"
    ];
app.use((0, cors_1.default)({ origin: frontendUrls, credentials: true }));
app.use(express_1.default.json());
app.use(passport_1.default.initialize());
// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
// API Routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/sessions", session_routes_1.default);
app.use("/api/quiz", quiz_routes_1.default);
app.use("/api/mentors", mentor_routes_1.default);
// Global error handler
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
});
app.listen(PORT, () => {
    console.log(`🚀 SkillSync API running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map