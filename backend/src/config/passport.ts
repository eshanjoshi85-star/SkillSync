import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "../lib/prisma.js";

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID || "default_client_id",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "default_client_secret",
            callbackURL:
                process.env.NODE_ENV === "production"
                    ? "https://skillsync-p827.onrender.com/api/auth/google/callback"
                    : "http://localhost:3000/api/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(new Error("No email found from Google profile"));
                }

                let user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            email,
                            name: profile.displayName || "Google User",
                            passwordHash: "oauth_user_no_password",
                        },
                    });

                    await prisma.tokenHistory.create({
                        data: {
                            userId: user.id,
                            amount: 10,
                            type: "SYSTEM_BONUS",
                        },
                    });

                    await prisma.user.update({
                        where: { id: user.id },
                        data: { tokenBalance: { increment: 10 } },
                    });
                }

                return done(null, user);
            } catch (error) {
                return done(error);
            }
        }
    )
);

export default passport;
