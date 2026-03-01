import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

    if (!session.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { baseUrl, apiKey, context } = await request.json();

        if (!baseUrl || !apiKey) {
            return NextResponse.json({ error: "Missing AI configuration" }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a helpful assistant that generates realistic git commit messages. Generate 5 different short, professional commit messages. Use conventional commit format (feat:, fix:, docs:, chore:, refactor:). Return them as a JSON array of strings.",
                    },
                    {
                        role: "user",
                        content: `Generate 5 realistic git commit messages for commits to "${context?.fileName || "README.md"}" in repository "${context?.repoName || "project"}". Return as JSON array.`,
                    },
                ],
                max_tokens: 200,
                temperature: 0.9,
            }),
        });

        if (!response.ok) {
            throw new Error(`AI API returned ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();

        return NextResponse.json({ messages: content });
    } catch (error) {
        console.error("AI message generation failed:", error);
        return NextResponse.json({ error: "Failed to generate messages" }, { status: 500 });
    }
}
