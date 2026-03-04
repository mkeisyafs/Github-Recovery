import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { BRANCH_PREFIX, DEFAULT_CONTENT_TEMPLATE } from "./config";
import { getInstallationToken } from "./github";
import { generateCommitMessage, AIConfig } from "./ai-messages";

export interface BackdateConfig {
    repoFullName: string;
    owner: string;
    repoName: string;
    defaultBranch: string;
    installationId: number;
    dates: string[]; // YYYY-MM-DD format
    intensity: number; // commits per day (used in fixed mode)
    randomMode: boolean; // whether to randomize intensity per day
    intensityWeights: number[]; // weights for levels 0-4 (used in random mode)
    artMode: boolean; // whether to use explicit per-day intensities
    artIntensities: Record<string, number>; // date -> intensity level (0-4) for art mode
    targetFile: string;
    contentTemplate: string;
    createPR: boolean;
    dryRun: boolean;
    useAI: boolean;
    aiConfig?: AIConfig;
    authorName?: string;
    authorEmail?: string;
    branchName?: string;
}

export type LogCallback = (level: string, message: string) => void;

export interface BackdateResult {
    success: boolean;
    branch: string;
    totalCommits: number;
    prUrl?: string;
    error?: string;
}

function randomTimeInDay(): { hours: number; minutes: number; seconds: number } {
    const hours = Math.floor(Math.random() * 14) + 8; // 08:00 - 22:00
    const minutes = Math.floor(Math.random() * 60);
    const seconds = Math.floor(Math.random() * 60);
    return { hours, minutes, seconds };
}

function formatGitDate(dateStr: string, time: { hours: number; minutes: number; seconds: number }): string {
    const h = String(time.hours).padStart(2, "0");
    const m = String(time.minutes).padStart(2, "0");
    const s = String(time.seconds).padStart(2, "0");
    return `${dateStr}T${h}:${m}:${s}`;
}

function generateContent(template: string, date: string, time: string, commitNum: number): string {
    return template
        .replace(/\{\{date\}\}/g, date)
        .replace(/\{\{time\}\}/g, time)
        .replace(/\{\{commit_number\}\}/g, String(commitNum))
        .replace(/\{\{uuid\}\}/g, uuidv4().slice(0, 8));
}

const INTENSITY_TO_COMMITS: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 6, 4: 10 };

export async function executeBackdateJob(
    config: BackdateConfig,
    log: LogCallback,
    onProgress: (current: number, total: number) => void
): Promise<BackdateResult> {
    const tmpDir = path.join(os.tmpdir(), `git-recovery-${uuidv4()}`);
    const branchName = config.branchName?.trim() || `${BRANCH_PREFIX}/${Date.now()}`;
    let totalCommits = 0;

    // Helper: pick random intensity from weights
    function pickRandomIntensity(): number {
        const weights = config.intensityWeights || [0, 25, 25, 25, 25];
        const total = weights.reduce((a, b) => a + b, 0);
        if (total === 0) return config.intensity;
        let rand = Math.random() * total;
        const intensityValues = [0, 1, 3, 6, 10];
        for (let i = 0; i < weights.length; i++) {
            rand -= weights[i];
            if (rand <= 0) return intensityValues[i];
        }
        return intensityValues[4];
    }

    function getIntensityForDay(date: string): number {
        if (config.artMode && config.artIntensities) {
            const level = config.artIntensities[date] ?? 0;
            return INTENSITY_TO_COMMITS[level] ?? 0;
        }
        return config.randomMode ? pickRandomIntensity() : config.intensity;
    }

    // Pre-calculate intensities for each day to know total steps
    const sortedDates = [...config.dates].sort();
    const dailyIntensities: number[] = sortedDates.map((d) => getIntensityForDay(d));
    const estimatedTotal = dailyIntensities.reduce((a, b) => a + b, 0);

    try {
        // Step 1: Get installation token
        log("info", "🔑 Obtaining installation access token...");
        const token = await getInstallationToken(config.installationId);

        // Step 2: Clone
        log("info", `📦 Cloning ${config.repoFullName}...`);
        const cloneUrl = `https://x-access-token:${token}@github.com/${config.repoFullName}.git`;

        if (config.dryRun) {
            log("info", "🏃 DRY RUN MODE — No actual git operations will be performed");
            log("info", `Would clone: ${config.repoFullName}`);
            log("info", `Would create branch: ${branchName}`);
            if (config.randomMode) {
                log("info", `🎲 Random mode — intensity varies per day`);
            }

            let commitCount = 0;
            for (let d = 0; d < sortedDates.length; d++) {
                const date = sortedDates[d];
                const dayIntensity = dailyIntensities[d];

                if (dayIntensity === 0) {
                    log("info", `  ⏭️ ${date} — skipped (no commits)`);
                    continue;
                }

                log("info", `📅 ${date} — ${dayIntensity} commits`);
                for (let i = 0; i < dayIntensity; i++) {
                    commitCount++;
                    const time = randomTimeInDay();
                    const gitDate = formatGitDate(date, time);
                    log("info", `  📝 [${commitCount}] ${gitDate}`);
                    onProgress(commitCount, estimatedTotal);
                }
            }

            log("success", `✅ Dry run complete. Would create ${commitCount} commits on branch ${branchName}`);
            return { success: true, branch: branchName, totalCommits: commitCount };
        }

        // Actual execution
        fs.mkdirSync(tmpDir, { recursive: true });
        const git: SimpleGit = simpleGit(tmpDir);

        await git.clone(cloneUrl, tmpDir);

        // Re-initialize git in the cloned dir and detect actual default branch
        const repoGit: SimpleGit = simpleGit(tmpDir);
        let actualDefault = config.defaultBranch;
        let isEmptyRepo = false;
        try {
            actualDefault = (await repoGit.revparse(["--abbrev-ref", "HEAD"])).trim() || config.defaultBranch;
        } catch {
            // Empty repo — HEAD doesn't exist yet
            isEmptyRepo = true;
            log("info", "📭 Repository is empty (no commits yet)");
        }
        log("success", `✅ Repository cloned successfully (branch: ${actualDefault})`);

        // Set git user
        const authorName = config.authorName || "git-recovery";
        const authorEmail = config.authorEmail || "git-recovery@users.noreply.github.com";
        await repoGit.addConfig("user.name", authorName);
        await repoGit.addConfig("user.email", authorEmail);

        // Step 3: Create branch
        log("info", `🌿 Creating branch: ${branchName}`);
        if (isEmptyRepo) {
            // For empty repos, use --orphan since there's no commit to branch from
            await repoGit.checkout(["--orphan", branchName]);
        } else {
            await repoGit.checkoutLocalBranch(branchName);
        }

        // Step 4: Create commits
        const filePath = path.join(tmpDir, config.targetFile);
        const template = config.contentTemplate || DEFAULT_CONTENT_TEMPLATE;

        // Ensure target file directory exists
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }

        // Ensure file exists
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "");
        }

        // Sort dates chronologically

        let currentCommit = 0;
        for (let d = 0; d < sortedDates.length; d++) {
            const date = sortedDates[d];
            const dayIntensity = dailyIntensities[d];

            if (dayIntensity === 0) {
                log("info", `⏭️ ${date} — skipped (no commits)`);
                continue;
            }

            log("info", `📅 Processing date: ${date} (${dayIntensity} commits)`);

            // Generate random times and sort them for this day
            const times = Array.from({ length: dayIntensity }, () => randomTimeInDay());
            times.sort((a, b) => a.hours * 3600 + a.minutes * 60 + a.seconds - (b.hours * 3600 + b.minutes * 60 + b.seconds));

            for (let i = 0; i < dayIntensity; i++) {
                currentCommit++;
                const time = times[i];
                const gitDate = formatGitDate(date, time);
                const timeStr = `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}:${String(time.seconds).padStart(2, "0")}`;

                // Modify file
                const content = generateContent(template, date, timeStr, i + 1);
                fs.appendFileSync(filePath, content);

                // Generate commit message
                let commitMessage: string;
                if (config.useAI && config.aiConfig) {
                    try {
                        commitMessage = await generateCommitMessage(config.aiConfig, {
                            date,
                            fileName: config.targetFile,
                            repoName: config.repoName,
                            commitNumber: i + 1,
                        });
                    } catch {
                        commitMessage = `docs: update ${config.targetFile}`;
                    }
                } else {
                    commitMessage = `docs: update ${config.targetFile} (${date} #${i + 1})`;
                }

                // Stage and commit with backdated dates
                await repoGit.add(config.targetFile);
                await repoGit.env({
                    GIT_AUTHOR_DATE: gitDate,
                    GIT_COMMITTER_DATE: gitDate,
                }).commit(commitMessage);

                totalCommits++;
                log("info", `  ✅ [${currentCommit}/${estimatedTotal}] ${gitDate} — ${commitMessage}`);
                onProgress(currentCommit, estimatedTotal);
            }
        }

        // Step 5: Push
        log("info", `🚀 Pushing branch ${branchName} to origin...`);
        await repoGit.push("origin", branchName);
        log("success", "✅ Branch pushed successfully");

        // Step 6: Create PR if requested
        let prUrl: string | undefined;
        if (config.createPR) {
            log("info", "📋 Creating Pull Request...");
            const { createPullRequest } = await import("./github");
            prUrl = await createPullRequest(
                config.installationId,
                config.owner,
                config.repoName,
                branchName,
                actualDefault,
                `Backfill commits: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`,
                `## Backdated Commits\n\nThis PR contains **${totalCommits}** backdated commits from ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}.\n\nGenerated by [Git Recovery](https://github.com/apps/git-recovery).`
            );
            log("success", `✅ Pull Request created: ${prUrl}`);
        }

        log("success", `🎉 Job complete! ${totalCommits} commits created on branch ${branchName}`);
        return { success: true, branch: branchName, totalCommits, prUrl };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log("error", `❌ Error: ${message}`);
        return { success: false, branch: branchName, totalCommits, error: message };
    } finally {
        // Cleanup
        try {
            if (fs.existsSync(tmpDir)) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
                log("info", "🧹 Temporary files cleaned up");
            }
        } catch (cleanupError) {
            log("warn", `⚠️ Failed to clean up temp directory: ${cleanupError}`);
        }
    }
}
