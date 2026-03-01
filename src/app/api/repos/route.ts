import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { getInstallationRepos } from "@/lib/github";
import { cookies } from "next/headers";

export async function GET() {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId || !session.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.installationId) {
        return NextResponse.json(
            { error: "GitHub App not installed. Please install the app first." },
            { status: 403 }
        );
    }

    try {
        const repos = await getInstallationRepos(session.accessToken, session.installationId);
        return NextResponse.json({ repos });
    } catch (error) {
        console.error("Failed to fetch repos:", error);
        return NextResponse.json({ error: "Failed to fetch repositories" }, { status: 500 });
    }
}
