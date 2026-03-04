import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { executeBackdateJob, BackdateConfig } from "@/lib/git-operations";
import { checkRateLimit } from "@/lib/rate-limit";
import { INTENSITY_MAP } from "@/lib/config";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId || !session.accessToken || !session.installationId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit check
    const rateLimit = checkRateLimit(session.userId);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: "Rate limit exceeded. Try again later.", resetIn: rateLimit.resetIn },
            { status: 429 }
        );
    }

    try {
        const body = await request.json();
        const {
            repoFullName,
            owner,
            repoName,
            defaultBranch,
            dates,
            intensityLevel,
            randomMode,
            intensityWeights,
            artMode,
            artIntensities,
            targetFile,
            contentTemplate,
            createPR,
            dryRun,
            useAI,
            aiBaseUrl,
            aiApiKey,
            aiModelId,
            branchName,
        } = body;

        // Validate
        if (!repoFullName || !dates || !Array.isArray(dates) || dates.length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const intensity = INTENSITY_MAP[intensityLevel as number] ?? 1;
        if (!randomMode && !artMode && intensity === 0) {
            return NextResponse.json({ error: "Intensity level 0 means no commits" }, { status: 400 });
        }

        // Get user info for commit author
        const user = await prisma.user.findUnique({ where: { id: session.userId } });

        const config: BackdateConfig = {
            repoFullName,
            owner,
            repoName,
            defaultBranch: defaultBranch || "main",
            installationId: session.installationId,
            dates,
            intensity,
            randomMode: randomMode ?? false,
            intensityWeights: intensityWeights ?? [0, 25, 25, 25, 25],
            artMode: artMode ?? false,
            artIntensities: artIntensities ?? {},
            targetFile: targetFile || "README.md",
            contentTemplate: contentTemplate || "",
            createPR: createPR ?? false,
            dryRun: dryRun ?? false,
            useAI: useAI ?? false,
            aiConfig: useAI && aiBaseUrl && aiApiKey ? { baseUrl: aiBaseUrl, apiKey: aiApiKey, modelId: aiModelId || undefined } : undefined,
            authorName: user?.login,
            authorEmail: `${user?.githubId}+${user?.login}@users.noreply.github.com`,
            branchName: branchName || undefined,
        };

        // Create job in DB
        const job = await prisma.job.create({
            data: {
                userId: session.userId,
                repo: repoFullName,
                status: "running",
                totalSteps: (() => {
                    if (artMode && artIntensities) {
                        // Sum actual commits per day from art intensities
                        return dates.reduce((sum: number, d: string) => {
                            const level = artIntensities[d] ?? 0;
                            return sum + (INTENSITY_MAP[level] ?? 0);
                        }, 0);
                    }
                    if (randomMode && intensityWeights) {
                        // Weighted average estimate
                        const commitValues = [0, 1, 3, 6, 10];
                        const wTotal = intensityWeights.reduce((a: number, b: number) => a + b, 0);
                        if (wTotal > 0) {
                            const avg = intensityWeights.reduce((sum: number, w: number, i: number) => sum + (w / wTotal) * commitValues[i], 0);
                            return Math.round(dates.length * avg);
                        }
                    }
                    return dates.length * intensity;
                })(),
                dryRun: dryRun ?? false,
                config: body,
            },
        });

        // Start job asynchronously
        executeBackdateJob(
            config,
            async (level, message) => {
                try {
                    await prisma.jobLog.create({
                        data: { jobId: job.id, level, message },
                    });
                } catch (e) {
                    console.error("Failed to save log:", e);
                }
            },
            async (current, total) => {
                try {
                    await prisma.job.update({
                        where: { id: job.id },
                        data: { progress: current, totalSteps: total },
                    });
                } catch (e) {
                    console.error("Failed to update progress:", e);
                }
            }
        ).then(async (result) => {
            await prisma.job.update({
                where: { id: job.id },
                data: {
                    status: result.success ? "completed" : "failed",
                    branch: result.branch,
                    prUrl: result.prUrl,
                    completedAt: new Date(),
                },
            });
        }).catch(async (error) => {
            await prisma.job.update({
                where: { id: job.id },
                data: {
                    status: "failed",
                    completedAt: new Date(),
                },
            });
            console.error("Job failed:", error);
        });

        return NextResponse.json({ jobId: job.id, status: "running" });
    } catch (error) {
        console.error("Job creation error:", error);
        return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
    }
}

export async function GET() {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobs = await prisma.job.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
            id: true,
            repo: true,
            branch: true,
            status: true,
            progress: true,
            totalSteps: true,
            dryRun: true,
            prUrl: true,
            createdAt: true,
            completedAt: true,
        },
    });

    return NextResponse.json({ jobs });
}
