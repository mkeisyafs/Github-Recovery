import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import * as path from "path";

let appInstance: App | null = null;

function getApp(): App {
    if (appInstance) return appInstance;

    const appId = process.env.GITHUB_APP_ID;
    if (!appId) {
        throw new Error("GITHUB_APP_ID is not set. Check your .env file.");
    }

    let privateKey = "";

    // Option 1: Read from file path (local development)
    const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    if (keyPath) {
        const resolved = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
        if (!fs.existsSync(resolved)) {
            throw new Error(`Private key file not found: ${resolved}`);
        }
        privateKey = fs.readFileSync(resolved, "utf-8");
    }
    // Option 2: Base64-encoded env var (production / Vercel / Docker)
    else if (process.env.GITHUB_APP_PRIVATE_KEY) {
        privateKey = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY, "base64").toString("utf-8");
    }
    else {
        throw new Error(
            "No GitHub App private key configured. Set either:\n" +
            "  GITHUB_APP_PRIVATE_KEY_PATH (file path) or\n" +
            "  GITHUB_APP_PRIVATE_KEY (base64-encoded PEM)"
        );
    }

    appInstance = new App({
        appId,
        privateKey,
        oauth: {
            clientId: process.env.GITHUB_CLIENT_ID || "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
        },
    });

    return appInstance;
}

export async function getInstallationToken(installationId: number): Promise<string> {
    const app = getApp();
    const octokit = await app.getInstallationOctokit(installationId);
    // The octokit from getInstallationOctokit is already authenticated as the installation
    // Use it to make any API call — the auth token is embedded
    const { data } = await octokit.request("POST /app/installations/{installation_id}/access_tokens", {
        installation_id: installationId,
    });
    return data.token;
}

export async function getUserOctokit(accessToken: string): Promise<Octokit> {
    return new Octokit({ auth: accessToken });
}

export async function getInstallationRepos(
    accessToken: string,
    installationId: number
): Promise<Array<{ id: number; full_name: string; name: string; owner: string; private: boolean; default_branch: string; description: string | null }>> {
    const octokit = new Octokit({ auth: accessToken });

    const repos: Array<{ id: number; full_name: string; name: string; owner: string; private: boolean; default_branch: string; description: string | null }> = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const { data } = await octokit.rest.apps.listInstallationReposForAuthenticatedUser({
            installation_id: installationId,
            per_page: perPage,
            page,
        });

        for (const repo of data.repositories) {
            repos.push({
                id: repo.id,
                full_name: repo.full_name,
                name: repo.name,
                owner: repo.owner.login,
                private: repo.private,
                default_branch: repo.default_branch,
                description: repo.description,
            });
        }

        if (data.repositories.length < perPage) break;
        page++;
    }

    return repos;
}

export async function findUserInstallation(accessToken: string): Promise<number | null> {
    const octokit = new Octokit({ auth: accessToken });

    try {
        const { data } = await octokit.rest.apps.listInstallationsForAuthenticatedUser();
        const appId = parseInt(process.env.GITHUB_APP_ID || "0");

        for (const installation of data.installations) {
            if (installation.app_id === appId) {
                return installation.id;
            }
        }
    } catch {
        console.error("Failed to find user installation");
    }

    return null;
}

export async function createPullRequest(
    installationId: number,
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string
): Promise<string> {
    const token = await getInstallationToken(installationId);
    const octokit = new Octokit({ auth: token });

    const { data } = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head,
        base,
    });

    return data.html_url;
}
