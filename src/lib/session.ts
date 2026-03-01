import { SessionOptions } from "iron-session";

export interface SessionData {
    userId?: string;
    githubId?: number;
    login?: string;
    avatarUrl?: string;
    accessToken?: string;
    installationId?: number;
}

export const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET || "default-secret-must-be-at-least-32-characters-long",
    cookieName: "git-recovery-session",
    cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax" as const,
        maxAge: 60 * 60 * 24 * 7, // 1 week
    },
};
