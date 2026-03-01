export interface AIConfig {
    baseUrl: string;
    apiKey: string;
    modelId?: string;
}

// Random action verbs and subjects for varied prompts
const ACTIONS = [
    "update", "refactor", "fix", "improve", "add", "remove", "clean up", "optimize",
    "restructure", "simplify", "extend", "modify", "adjust", "revise", "enhance",
];
const SUBJECTS = [
    "error handling", "input validation", "type definitions", "helper functions",
    "utility methods", "documentation", "configuration", "test coverage",
    "code comments", "variable naming", "function signatures", "imports",
    "logging", "performance", "edge cases", "formatting", "dependencies",
    "readme", "changelog", "api endpoints", "data models", "constants",
];
const PREFIXES = ["feat", "fix", "docs", "chore", "refactor", "style", "perf", "test", "build", "ci"];

export async function generateCommitMessage(
    config: AIConfig,
    context: { date: string; fileName: string; repoName: string; commitNumber: number }
): Promise<string> {
    try {
        // Normalize URL
        let apiUrl = config.baseUrl.replace(/\/+$/, "");
        if (apiUrl.endsWith("/v1/chat/completions") || apiUrl.endsWith("/chat/completions")) {
            // Already a full URL
        } else if (apiUrl.endsWith("/v1")) {
            apiUrl = `${apiUrl}/chat/completions`;
        } else {
            apiUrl = `${apiUrl}/v1/chat/completions`;
        }

        // Add randomness to the prompt itself so the AI generates unique messages
        const randAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
        const randSubject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
        const randPrefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
        const seed = Math.floor(Math.random() * 10000);

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.modelId || "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You generate unique, realistic one-line git commit messages. Use conventional commit prefixes (feat:, fix:, docs:, chore:, refactor:, style:, perf:, test:). Each message must be DIFFERENT and UNIQUE. Never repeat yourself. Keep under 72 characters. Return ONLY the commit message, no quotes, no explanation.`,
                    },
                    {
                        role: "user",
                        content: `Commit for "${context.repoName}" on ${context.date}, file: ${context.fileName}, commit #${context.commitNumber}. Theme hint: ${randPrefix}: ${randAction} ${randSubject}. Seed: ${seed}. Generate ONE unique commit message:`,
                    },
                ],
                max_tokens: 50,
                temperature: 1.2,
                top_p: 0.95,
            }),
        });

        if (!response.ok) {
            throw new Error(`AI API returned ${response.status}`);
        }

        const data = await response.json();
        const msg = data.choices?.[0]?.message?.content?.trim();
        // Clean up: remove surrounding quotes if present
        if (msg) {
            return msg.replace(/^["']|["']$/g, "").trim();
        }
        return getTemplateMessage(context);
    } catch (error) {
        console.error("AI message generation failed:", error);
        return getTemplateMessage(context);
    }
}

function getTemplateMessage(context: { date: string; commitNumber: number }): string {
    const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
    return `${prefix}: ${action} ${subject}`;
}

export async function generateBatchMessages(
    config: AIConfig,
    contexts: Array<{ date: string; fileName: string; repoName: string; commitNumber: number }>
): Promise<string[]> {
    const messages = await Promise.all(
        contexts.map((ctx) => generateCommitMessage(config, ctx))
    );
    return messages;
}
