import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const job = await prisma.job.findFirst({
        where: { id, userId: session.userId },
        include: {
            logs: {
                orderBy: { createdAt: "asc" },
            },
        },
    });

    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
        id: job.id,
        repo: job.repo,
        branch: job.branch,
        status: job.status,
        progress: job.progress,
        totalSteps: job.totalSteps,
        dryRun: job.dryRun,
        prUrl: job.prUrl,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        logs: job.logs.map((log) => ({
            level: log.level,
            message: log.message,
            timestamp: log.createdAt,
        })),
    });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const job = await prisma.job.findFirst({
        where: { id, userId: session.userId },
    });

    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
