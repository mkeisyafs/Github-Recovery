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
        const { baseUrl, apiKey, modelId } = await request.json();

        if (!baseUrl || !apiKey) {
            return NextResponse.json({ error: "Missing base URL or API key" }, { status: 400 });
        }

        // Normalize URL: strip trailing slashes
        const normalizedUrl = baseUrl.replace(/\/+$/, "");

        // Try multiple URL patterns to find the right one
        const urlCandidates = [
            `${normalizedUrl}/v1/chat/completions`,
            `${normalizedUrl}/chat/completions`,
            `${normalizedUrl}/v1/models`,
            `${normalizedUrl}/models`,
        ];

        let workingUrl = "";
        let testResponse: Response | null = null;

        // First try: list models (lightweight, GET)
        for (const url of [urlCandidates[2], urlCandidates[3]]) {
            try {
                const res = await fetch(url, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${apiKey}` },
                    signal: AbortSignal.timeout(10000),
                });
                if (res.ok) {
                    workingUrl = url;
                    testResponse = res;
                    break;
                }
            } catch {
                // try next
            }
        }

        // Second try: send a minimal chat completion
        if (!workingUrl) {
            for (const url of [urlCandidates[0], urlCandidates[1]]) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            model: modelId || "gpt-3.5-turbo",
                            messages: [{ role: "user", content: "Say hi" }],
                            max_tokens: 5,
                        }),
                        signal: AbortSignal.timeout(15000),
                    });
                    if (res.ok) {
                        workingUrl = url;
                        testResponse = res;
                        break;
                    }
                    // If 404, try next URL pattern
                    if (res.status === 404) continue;
                    // Other errors (401, 403, 429) — report them
                    const errBody = await res.text();
                    return NextResponse.json({
                        success: false,
                        error: `API returned ${res.status}: ${errBody.slice(0, 200)}`,
                        testedUrl: url,
                    });
                } catch (err) {
                    // Timeout or network error — try next
                    continue;
                }
            }
        }

        if (!workingUrl || !testResponse) {
            return NextResponse.json({
                success: false,
                error: "Could not connect to the AI API. Tried multiple URL patterns. Check your base URL.",
                triedUrls: urlCandidates,
            });
        }

        // Parse response for details
        let details: Record<string, unknown> = {};
        try {
            const data = await testResponse.json();
            if (data.data && Array.isArray(data.data)) {
                // Models endpoint
                details = {
                    type: "models",
                    modelCount: data.data.length,
                    models: data.data.slice(0, 10).map((m: { id: string }) => m.id),
                };
            } else if (data.choices) {
                // Chat completion
                details = {
                    type: "chat",
                    response: data.choices[0]?.message?.content?.trim(),
                    model: data.model,
                };
            }
        } catch {
            // response already consumed
        }

        // Determine the correct chat completions URL
        const chatUrl = workingUrl.includes("/models")
            ? workingUrl.replace(/\/models$/, "/chat/completions")
            : workingUrl;

        return NextResponse.json({
            success: true,
            message: "Connection successful!",
            chatUrl,
            details,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
