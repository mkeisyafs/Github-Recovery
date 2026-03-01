import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { findUserInstallation } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/?error=no_code`);
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_BASE_URL}/?error=${tokenData.error}`
            );
        }

        const accessToken = tokenData.access_token;

        // Get user info
        const userResponse = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userData = await userResponse.json();

        // Find installation
        const installationId = await findUserInstallation(accessToken);

        // Upsert user in DB
        const user = await prisma.user.upsert({
            where: { githubId: userData.id },
            update: {
                login: userData.login,
                avatarUrl: userData.avatar_url,
                accessToken,
                installationId,
            },
            create: {
                githubId: userData.id,
                login: userData.login,
                avatarUrl: userData.avatar_url,
                accessToken,
                installationId,
            },
        });

        // Set session
        const cookieStore = await cookies();
        const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
        session.userId = user.id;
        session.githubId = userData.id;
        session.login = userData.login;
        session.avatarUrl = userData.avatar_url;
        session.accessToken = accessToken;
        session.installationId = installationId ?? undefined;
        await session.save();

        // Redirect to dashboard
        if (!installationId) {
            // User hasn't installed the app yet — redirect to installation
            const appSlug = "git-recovery"; // Update this if your app has a different slug
            return NextResponse.redirect(
                `https://github.com/apps/${appSlug}/installations/new`
            );
        }

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`);
    } catch (error) {
        console.error("Auth callback error:", error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/?error=auth_failed`);
    }
}
