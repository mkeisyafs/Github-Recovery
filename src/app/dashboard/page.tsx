"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    GitBranch,
    LogOut,
    Search,
    Calendar,
    Zap,
    FileText,
    MessageSquare,
    Play,
    Eye,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronDown,
    GitPullRequest,
    Sparkles,
    Lock,
    Clock,
    RefreshCw,
    Settings2,
    History,
} from "lucide-react";

interface UserSession {
    id: string;
    login: string;
    avatarUrl: string;
    installationId: number | null;
}

interface Repo {
    id: number;
    full_name: string;
    name: string;
    owner: string;
    private: boolean;
    default_branch: string;
    description: string | null;
}

interface JobLog {
    level: string;
    message: string;
    timestamp: string;
}

interface Job {
    id: string;
    repo: string;
    branch: string | null;
    status: string;
    progress: number;
    totalSteps: number;
    dryRun: boolean;
    prUrl: string | null;
    createdAt: string;
    completedAt: string | null;
    logs?: JobLog[];
}

const INTENSITY_LABELS = [
    { level: 0, label: "None", commits: 0, color: "#161b22" },
    { level: 1, label: "Light", commits: 1, color: "#0e4429" },
    { level: 2, label: "Medium", commits: 3, color: "#006d32" },
    { level: 3, label: "Heavy", commits: 6, color: "#26a641" },
    { level: 4, label: "Extreme", commits: 10, color: "#39d353" },
];

function generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

export default function DashboardPage() {
    const [user, setUser] = useState<UserSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [repos, setRepos] = useState<Repo[]>([]);
    const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
    const [repoSearch, setRepoSearch] = useState("");
    const [reposLoading, setReposLoading] = useState(false);
    const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
    const [dateMode, setDateMode] = useState<"range" | "custom">("range");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [customDates, setCustomDates] = useState("");
    const [intensityLevel, setIntensityLevel] = useState(2);
    const [intensityMode, setIntensityMode] = useState<"fixed" | "random" | "art">("fixed");
    const [intensityWeights, setIntensityWeights] = useState([10, 20, 30, 25, 15]);
    const [artIntensities, setArtIntensities] = useState<Record<string, number>>({});
    const [artBrush, setArtBrush] = useState(3);
    const [isPainting, setIsPainting] = useState(false);
    const [artImageSrc, setArtImageSrc] = useState<string | null>(null);
    const [artImgOffsetX, setArtImgOffsetX] = useState(0);
    const [artImgOffsetY, setArtImgOffsetY] = useState(0);
    const [artImgScale, setArtImgScale] = useState(100);
    const [artText, setArtText] = useState("");
    const [targetFile, setTargetFile] = useState("README.md");
    const [contentTemplate, setContentTemplate] = useState(
        "<!-- Contribution update: {{date}} {{time}} | #{{commit_number}} | {{uuid}} -->\n"
    );
    const [createPR, setCreatePR] = useState(true);
    const [dryRun, setDryRun] = useState(false);
    const [customBranchName, setCustomBranchName] = useState("");
    const [useAI, setUseAI] = useState(false);
    const [aiBaseUrl, setAiBaseUrl] = useState("");
    const [aiApiKey, setAiApiKey] = useState("");
    const [aiModelId, setAiModelId] = useState("");
    const [aiTesting, setAiTesting] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message?: string; error?: string; details?: { models?: string[]; response?: string; model?: string } } | null>(null);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<Job | null>(null);
    const [jobRunning, setJobRunning] = useState(false);
    const [jobHistory, setJobHistory] = useState<Job[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const logContainerRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Load saved AI config from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem("git-recovery-ai-config");
            if (saved) {
                const data = JSON.parse(saved);
                if (data.baseUrl) setAiBaseUrl(data.baseUrl);
                if (data.apiKey) setAiApiKey(data.apiKey);
                if (data.modelId) setAiModelId(data.modelId);
                if (data.enabled) setUseAI(true);
            }
        } catch { /* ignore */ }
    }, []);

    // Save AI config to localStorage when changed
    useEffect(() => {
        if (aiBaseUrl || aiApiKey || aiModelId) {
            localStorage.setItem("git-recovery-ai-config", JSON.stringify({
                baseUrl: aiBaseUrl,
                apiKey: aiApiKey,
                modelId: aiModelId,
                enabled: useAI,
            }));
        }
    }, [aiBaseUrl, aiApiKey, aiModelId, useAI]);

    useEffect(() => {
        fetch("/api/auth/session")
            .then((res) => res.json())
            .then((data) => {
                if (data.authenticated) setUser(data.user);
                else window.location.href = "/";
            })
            .catch(() => { window.location.href = "/"; })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (user?.installationId) {
            setReposLoading(true);
            fetch("/api/repos")
                .then((res) => res.json())
                .then((data) => { if (data.repos) setRepos(data.repos); })
                .finally(() => setReposLoading(false));
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetch("/api/jobs")
                .then((res) => res.json())
                .then((data) => { if (data.jobs) setJobHistory(data.jobs); });
        }
    }, [user]);

    const pollJobStatus = useCallback((jobId: string) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/jobs/${jobId}`);
                const data = await res.json();
                setJobStatus(data);
                if (logContainerRef.current) {
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                }
                if (data.status === "completed" || data.status === "failed") {
                    setJobRunning(false);
                    if (pollRef.current) clearInterval(pollRef.current);
                    const histRes = await fetch("/api/jobs");
                    const histData = await histRes.json();
                    if (histData.jobs) setJobHistory(histData.jobs);
                }
            } catch { /* ignore */ }
        }, 1500);
    }, []);

    useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

    const startJob = async () => {
        if (!selectedRepo) return;
        let dates: string[];
        if (dateMode === "range") {
            if (!startDate || !endDate) return;
            dates = generateDateRange(startDate, endDate);
        } else {
            dates = customDates.split("\n").map((d) => d.trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
            if (dates.length === 0) return;
        }
        setJobRunning(true);
        setJobStatus(null);
        try {
            const res = await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    repoFullName: selectedRepo.full_name, owner: selectedRepo.owner,
                    repoName: selectedRepo.name, defaultBranch: selectedRepo.default_branch,
                    dates, intensityLevel, targetFile, contentTemplate, createPR, dryRun, useAI,
                    randomMode: intensityMode === "random",
                    intensityWeights: intensityMode === "random" ? intensityWeights : undefined,
                    artMode: intensityMode === "art",
                    artIntensities: intensityMode === "art" ? artIntensities : undefined,
                    aiBaseUrl: useAI ? aiBaseUrl : undefined, aiApiKey: useAI ? aiApiKey : undefined,
                    aiModelId: useAI && aiModelId ? aiModelId : undefined,
                    branchName: customBranchName.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (data.jobId) { setCurrentJobId(data.jobId); pollJobStatus(data.jobId); }
            else { setJobRunning(false); alert(data.error || "Failed to start job"); }
        } catch { setJobRunning(false); alert("Failed to start job"); }
    };

    const handleLogout = async () => {
        await fetch("/api/auth/session", { method: "DELETE" });
        window.location.href = "/";
    };

    const viewJob = async (jobId: string) => {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        setJobStatus(data);
        setCurrentJobId(jobId);
        setShowHistory(false);
    };

    const filteredRepos = repos.filter(
        (r) => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
            (r.description && r.description.toLowerCase().includes(repoSearch.toLowerCase()))
    );

    const totalDays = dateMode === "range" && startDate && endDate
        ? generateDateRange(startDate, endDate).length
        : customDates.split("\n").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.trim())).length;

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Loader2 className="spinner" style={{ width: 32, height: 32, color: "#39d353" }} />
            </div>
        );
    }

    return (
        <div className="bg-grid" style={{ minHeight: "100vh" }}>
            {/* ===== HEADER ===== */}
            <header style={{
                position: "sticky", top: 0, zIndex: 50,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(10,10,15,0.85)", backdropFilter: "blur(20px)",
            }}>
                <div style={{
                    maxWidth: 1280, margin: "0 auto", display: "flex",
                    alignItems: "center", justifyContent: "space-between",
                    padding: "16px 24px",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: "linear-gradient(135deg, #39d353, #58a6ff)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <GitBranch style={{ width: 18, height: 18, color: "#000" }} />
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 700 }}>Git Recovery</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <button onClick={() => setShowHistory(!showHistory)} className="btn btn-secondary" style={{ fontSize: 13, padding: "8px 16px" }}>
                            <History style={{ width: 16, height: 16 }} /> History
                        </button>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {user?.avatarUrl && (
                                <img src={user.avatarUrl} alt={user.login}
                                    style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)" }} />
                            )}
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{user?.login}</span>
                            <button onClick={handleLogout} title="Sign out"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#55556a", padding: 4 }}>
                                <LogOut style={{ width: 16, height: 16 }} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ===== MAIN CONTENT ===== */}
            <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
                {/* No Installation Warning */}
                {!user?.installationId && (
                    <div className="glass-card" style={{ padding: 24, marginBottom: 32, borderColor: "rgba(240,136,62,0.3)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                            <AlertCircle style={{ width: 20, height: 20, color: "#f0883e", marginTop: 2, flexShrink: 0 }} />
                            <div>
                                <h3 style={{ fontWeight: 600, color: "#f0883e", marginBottom: 4, fontSize: 15 }}>GitHub App Not Installed</h3>
                                <p style={{ fontSize: 14, color: "#8b8b9e", marginBottom: 12 }}>
                                    You need to install the Git Recovery GitHub App to access your repositories.
                                </p>
                                <a href="https://github.com/apps/git-recovery/installations/new" className="btn btn-primary" style={{ fontSize: 13 }}>
                                    Install GitHub App
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Job History */}
                {showHistory && (
                    <div className="glass-card animate-fade-in-up" style={{ padding: 24, marginBottom: 32 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                <History style={{ width: 20, height: 20, color: "#58a6ff" }} /> Job History
                            </h2>
                            <button onClick={() => setShowHistory(false)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#55556a", fontSize: 18 }}>✕</button>
                        </div>
                        {jobHistory.length === 0 ? (
                            <p style={{ fontSize: 14, color: "#55556a" }}>No jobs yet.</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
                                {jobHistory.map((job) => (
                                    <button key={job.id} onClick={() => viewJob(job.id)}
                                        style={{
                                            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "none",
                                            cursor: "pointer", textAlign: "left", color: "inherit", transition: "background 0.2s",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            {job.status === "completed" ? <CheckCircle2 style={{ width: 16, height: 16, color: "#39d353" }} />
                                                : job.status === "failed" ? <XCircle style={{ width: 16, height: 16, color: "#f85149" }} />
                                                    : <Loader2 className="spinner" style={{ width: 16, height: 16, color: "#58a6ff" }} />}
                                            <div>
                                                <span style={{ fontSize: 14, fontWeight: 500 }}>{job.repo}</span>
                                                {job.dryRun && (
                                                    <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(240,136,62,0.15)", color: "#f0883e" }}>
                                                        Dry Run
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: 12, color: "#55556a" }}>{new Date(job.createdAt).toLocaleString()}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== TWO COLUMN LAYOUT ===== */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 32, alignItems: "start" }}>
                    {/* LEFT COLUMN */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {/* Repo Selector */}
                        <section className="glass-card" style={{ padding: 24 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <GitBranch style={{ width: 16, height: 16, color: "#39d353" }} /> Select Repository
                            </h2>
                            <div style={{ position: "relative" }}>
                                <div onClick={() => setRepoDropdownOpen(!repoDropdownOpen)} style={{ cursor: "pointer" }}>
                                    <div style={{
                                        display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                                        borderRadius: 12, background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.06)", transition: "border-color 0.2s",
                                    }}>
                                        <Search style={{ width: 16, height: 16, color: "#55556a" }} />
                                        <input type="text" value={repoSearch}
                                            onChange={(e) => { setRepoSearch(e.target.value); setRepoDropdownOpen(true); }}
                                            onClick={(e) => { e.stopPropagation(); setRepoDropdownOpen(true); }}
                                            placeholder={selectedRepo ? selectedRepo.full_name : "Search repositories..."}
                                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: 0, fontSize: 14, color: "#f0f0f5" }}
                                        />
                                        {reposLoading
                                            ? <Loader2 className="spinner" style={{ width: 16, height: 16, color: "#55556a" }} />
                                            : <ChevronDown style={{ width: 16, height: 16, color: "#55556a" }} />}
                                    </div>
                                </div>
                                {repoDropdownOpen && (
                                    <div className="glass-card" style={{
                                        position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8,
                                        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
                                        overflow: "hidden", zIndex: 20, maxHeight: 300, overflowY: "auto",
                                    }}>
                                        {filteredRepos.length === 0 ? (
                                            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 14, color: "#55556a" }}>
                                                {reposLoading ? "Loading repositories..." : "No repositories found"}
                                            </div>
                                        ) : (
                                            filteredRepos.map((repo) => (
                                                <button key={repo.id}
                                                    onClick={() => { setSelectedRepo(repo); setRepoDropdownOpen(false); setRepoSearch(""); }}
                                                    style={{
                                                        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                                                        background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "inherit",
                                                        transition: "background 0.2s",
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                                >
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 14, fontWeight: 500 }}>{repo.full_name}</span>
                                                            {repo.private && <Lock style={{ width: 12, height: 12, color: "#55556a", flexShrink: 0 }} />}
                                                        </div>
                                                        {repo.description && (
                                                            <span style={{ fontSize: 12, color: "#55556a", display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {repo.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: 12, color: "#55556a", flexShrink: 0 }}>{repo.default_branch}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            {selectedRepo && (
                                <>
                                    <div style={{
                                        marginTop: 12, display: "flex", alignItems: "center", gap: 8,
                                        padding: "8px 12px", borderRadius: 10, background: "rgba(57,211,83,0.15)",
                                    }}>
                                        <CheckCircle2 style={{ width: 16, height: 16, color: "#39d353" }} />
                                        <span style={{ fontSize: 14, color: "#39d353" }}>{selectedRepo.full_name}</span>
                                        <span style={{ fontSize: 12, color: "#55556a", marginLeft: "auto" }}>branch: {selectedRepo.default_branch}</span>
                                    </div>
                                    <div style={{ marginTop: 12 }}>
                                        <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>
                                            <GitBranch style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                                            Branch Name <span style={{ color: "#55556a" }}>(optional)</span>
                                        </label>
                                        <input type="text" value={customBranchName} onChange={(e) => setCustomBranchName(e.target.value)}
                                            placeholder={`backfill/${Date.now()} (auto-generated)`}
                                            style={{ fontFamily: "monospace", fontSize: 13 }}
                                        />
                                        <span style={{ fontSize: 11, color: "#55556a", display: "block", marginTop: 4 }}>
                                            Leave empty for auto-generated name
                                        </span>
                                    </div>
                                </>
                            )}
                        </section>

                        {/* Date Configuration */}
                        <section className="glass-card" style={{ padding: 24 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <Calendar style={{ width: 16, height: 16, color: "#58a6ff" }} /> Date Configuration
                            </h2>
                            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "rgba(255,255,255,0.04)", marginBottom: 16 }}>
                                <button onClick={() => setDateMode("range")} style={{
                                    flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer",
                                    background: dateMode === "range" ? "rgba(255,255,255,0.08)" : "transparent",
                                    color: dateMode === "range" ? "#f0f0f5" : "#55556a", transition: "all 0.2s",
                                }}>Date Range</button>
                                <button onClick={() => setDateMode("custom")} style={{
                                    flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer",
                                    background: dateMode === "custom" ? "rgba(255,255,255,0.08)" : "transparent",
                                    color: dateMode === "custom" ? "#f0f0f5" : "#55556a", transition: "all 0.2s",
                                }}>Custom Dates</button>
                            </div>
                            {dateMode === "range" ? (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                    <div>
                                        <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>Start Date</label>
                                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>End Date</label>
                                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                    </div>
                                    {startDate && endDate && (
                                        <div style={{ gridColumn: "span 2", fontSize: 12, color: "#55556a", display: "flex", alignItems: "center", gap: 4 }}>
                                            <Clock style={{ width: 12, height: 12 }} />
                                            {generateDateRange(startDate, endDate).length} days selected
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>One date per line (YYYY-MM-DD)</label>
                                    <textarea value={customDates} onChange={(e) => setCustomDates(e.target.value)} placeholder={"2024-01-15\n2024-01-20\n2024-02-01"} rows={5} style={{ resize: "none", fontFamily: "monospace", fontSize: 13 }} />
                                    <div style={{ fontSize: 12, color: "#55556a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                        <Clock style={{ width: 12, height: 12 }} />
                                        {customDates.split("\n").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.trim())).length} valid dates
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Intensity Selector */}
                        <section className="glass-card" style={{ padding: 24 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <Zap style={{ width: 16, height: 16, color: "#f0883e" }} /> Commit Intensity
                            </h2>

                            {/* Mode Tabs */}
                            <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "rgba(255,255,255,0.04)", marginBottom: 16 }}>
                                {(["fixed", "random", "art"] as const).map((mode) => (
                                    <button key={mode} onClick={() => setIntensityMode(mode)} style={{
                                        flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
                                        background: intensityMode === mode ? "rgba(255,255,255,0.08)" : "transparent",
                                        color: intensityMode === mode ? "#f0f0f5" : "#55556a", transition: "all 0.2s",
                                    }}>
                                        {mode === "fixed" ? "⚡ Fixed" : mode === "random" ? "🎲 Random" : "🎨 Art"}
                                    </button>
                                ))}
                            </div>

                            {/* Fixed Mode */}
                            {intensityMode === "fixed" && (
                                <>
                                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                        {INTENSITY_LABELS.map((item) => (
                                            <button key={item.level} onClick={() => setIntensityLevel(item.level)} style={{
                                                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                                                padding: "12px 8px", borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
                                                background: intensityLevel === item.level ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                                                border: intensityLevel === item.level ? "1px solid rgba(57,211,83,0.3)" : "1px solid transparent",
                                            }}>
                                                <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: item.color }} />
                                                <span style={{ fontSize: 12, fontWeight: 500, color: "#f0f0f5" }}>{item.label}</span>
                                                <span style={{ fontSize: 11, color: "#55556a" }}>{item.commits}/day</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
                                        <span style={{ fontSize: 12, color: "#55556a", marginRight: 8 }}>Preview:</span>
                                        {Array.from({ length: 7 }).map((_, i) => (
                                            <div key={i} className={`contrib-${intensityLevel}`} style={{ width: 16, height: 16, borderRadius: 3 }} />
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Random Mode */}
                            {intensityMode === "random" && (
                                <>
                                    <p style={{ fontSize: 13, color: "#8b8b9e", marginBottom: 16 }}>
                                        Set the probability weight for each level. Higher = more likely. Set to 0 to exclude.
                                    </p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                                        {INTENSITY_LABELS.map((item, idx) => (
                                            <div key={item.level} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: item.color, flexShrink: 0 }} />
                                                <span style={{ fontSize: 13, color: "#f0f0f5", width: 60, flexShrink: 0 }}>{item.label}</span>
                                                <span style={{ fontSize: 11, color: "#55556a", width: 45, flexShrink: 0 }}>{item.commits}/day</span>
                                                <input type="range" min="0" max="100" value={intensityWeights[idx]}
                                                    onChange={(e) => {
                                                        const nw = [...intensityWeights];
                                                        nw[idx] = parseInt(e.target.value);
                                                        setIntensityWeights(nw);
                                                    }}
                                                    style={{ flex: 1, accentColor: item.color, height: 4, cursor: "pointer" }}
                                                />
                                                <span style={{ fontSize: 13, color: "#f0f0f5", width: 36, textAlign: "right", fontWeight: 500 }}>
                                                    {intensityWeights[idx]}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>
                                        <span style={{ fontSize: 12, color: "#55556a", marginRight: 8 }}>Preview:</span>
                                        {Array.from({ length: 14 }).map((_, i) => {
                                            const tw = intensityWeights.reduce((a, b) => a + b, 0);
                                            let r = Math.random() * tw; let lv = 0;
                                            for (let j = 0; j < intensityWeights.length; j++) { r -= intensityWeights[j]; if (r <= 0) { lv = j; break; } }
                                            return <div key={i} className={`contrib-${lv}`} style={{ width: 14, height: 14, borderRadius: 3 }} />;
                                        })}
                                    </div>
                                </>
                            )}

                            {/* Art Mode */}
                            {intensityMode === "art" && (() => {
                                // Build dates list from current date selection
                                let artDates: string[] = [];
                                if (dateMode === "range" && startDate && endDate) {
                                    artDates = generateDateRange(startDate, endDate);
                                } else if (dateMode === "custom") {
                                    artDates = customDates.split("\n").map(d => d.trim()).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
                                }

                                if (artDates.length === 0) {
                                    return (
                                        <div style={{ padding: 32, textAlign: "center", color: "#55556a", fontSize: 14 }}>
                                            <Calendar style={{ width: 32, height: 32, margin: "0 auto 12px", opacity: 0.4 }} />
                                            <p>Select a date range first to start painting your contribution graph.</p>
                                        </div>
                                    );
                                }

                                // Build week-based grid (7 rows: Sun-Sat, N columns: weeks)
                                const firstDate = new Date(artDates[0] + "T00:00:00");
                                const lastDate = new Date(artDates[artDates.length - 1] + "T00:00:00");
                                const artDateSet = new Set(artDates);

                                // Pad to start on Sunday
                                const startDay = firstDate.getDay(); // 0=Sun
                                const gridStart = new Date(firstDate);
                                gridStart.setDate(gridStart.getDate() - startDay);

                                // Build all cells
                                type GridCell = { date: string; inRange: boolean };
                                const cells: GridCell[] = [];
                                const current = new Date(gridStart);
                                while (current <= lastDate || current.getDay() !== 0) {
                                    const ds = current.toISOString().split("T")[0];
                                    cells.push({ date: ds, inRange: artDateSet.has(ds) });
                                    current.setDate(current.getDate() + 1);
                                    if (current > lastDate && current.getDay() === 0) break;
                                }

                                const weeks = Math.ceil(cells.length / 7);

                                // Month labels
                                const monthLabels: { label: string; col: number }[] = [];
                                let lastMonth = -1;
                                for (let w = 0; w < weeks; w++) {
                                    const cellDate = new Date(cells[w * 7]?.date + "T00:00:00");
                                    const m = cellDate.getMonth();
                                    if (m !== lastMonth) {
                                        monthLabels.push({ label: cellDate.toLocaleString("en", { month: "short" }), col: w });
                                        lastMonth = m;
                                    }
                                }

                                const paintCell = (date: string) => {
                                    setArtIntensities(prev => {
                                        const current = prev[date] ?? 0;
                                        return { ...prev, [date]: current === artBrush ? 0 : artBrush };
                                    });
                                };

                                const mapImageToGrid = (imgSrc: string, offsetX: number, offsetY: number, scale: number): Record<string, number> => {
                                    const canvas = document.createElement("canvas");
                                    canvas.width = weeks;
                                    canvas.height = 7;
                                    const ctx = canvas.getContext("2d")!;

                                    // Clear canvas to white (= no commits)
                                    ctx.fillStyle = "#ffffff";
                                    ctx.fillRect(0, 0, weeks, 7);

                                    // Load image synchronously from already-loaded src
                                    const img = new Image();
                                    img.src = imgSrc;

                                    // Scale factor: 100% = image fits grid height (7 cells), user can adjust
                                    const scaleFactor = scale / 100;
                                    const imgAspect = img.naturalWidth / img.naturalHeight;
                                    const drawH = 7 * scaleFactor;
                                    const drawW = drawH * imgAspect;

                                    // Offset in grid cells
                                    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

                                    const imageData = ctx.getImageData(0, 0, weeks, 7);
                                    const pixels = imageData.data;

                                    const result: Record<string, number> = {};
                                    for (let col = 0; col < weeks; col++) {
                                        for (let row = 0; row < 7; row++) {
                                            const cellIdx = col * 7 + row;
                                            const cell = cells[cellIdx];
                                            if (!cell || !cell.inRange) continue;

                                            const px = (row * weeks + col) * 4;
                                            const r = pixels[px], g = pixels[px + 1], b = pixels[px + 2], a = pixels[px + 3];
                                            const brightness = a < 128 ? 255 : (0.299 * r + 0.587 * g + 0.114 * b);

                                            let level: number;
                                            if (brightness < 51) level = 4;
                                            else if (brightness < 102) level = 3;
                                            else if (brightness < 153) level = 2;
                                            else if (brightness < 204) level = 1;
                                            else level = 0;

                                            result[cell.date] = level;
                                        }
                                    }
                                    return result;
                                };

                                // Compute live preview when image is loaded
                                let imagePreview: Record<string, number> = {};
                                if (artImageSrc) {
                                    try { imagePreview = mapImageToGrid(artImageSrc, artImgOffsetX, artImgOffsetY, artImgScale); } catch { /* image not ready */ }
                                }

                                return (
                                    <>
                                        {/* Image Placement Editor */}
                                        {artImageSrc && (
                                            <div style={{ padding: 16, borderRadius: 12, background: "rgba(88,166,255,0.06)", border: "1px solid rgba(88,166,255,0.2)", marginBottom: 16 }}>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#58a6ff" }}>📐 Adjust Image Placement</span>
                                                    <div style={{ display: "flex", gap: 8 }}>
                                                        <button onClick={() => {
                                                            setArtIntensities(imagePreview);
                                                            setArtImageSrc(null);
                                                        }} className="btn btn-primary" style={{ fontSize: 11, padding: "4px 14px" }}>
                                                            ✅ Apply
                                                        </button>
                                                        <button onClick={() => setArtImageSrc(null)} className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}>
                                                            ✕ Cancel
                                                        </button>
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <span style={{ fontSize: 12, color: "#8b8b9e", width: 75, flexShrink: 0 }}>↔ X Offset</span>
                                                        <input type="range" min={-weeks} max={weeks} value={artImgOffsetX}
                                                            onChange={(e) => setArtImgOffsetX(parseInt(e.target.value))}
                                                            style={{ flex: 1, accentColor: "#58a6ff", cursor: "pointer" }}
                                                        />
                                                        <span style={{ fontSize: 12, color: "#f0f0f5", width: 32, textAlign: "right" }}>{artImgOffsetX}</span>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <span style={{ fontSize: 12, color: "#8b8b9e", width: 75, flexShrink: 0 }}>↕ Y Offset</span>
                                                        <input type="range" min={-7} max={7} value={artImgOffsetY}
                                                            onChange={(e) => setArtImgOffsetY(parseInt(e.target.value))}
                                                            style={{ flex: 1, accentColor: "#58a6ff", cursor: "pointer" }}
                                                        />
                                                        <span style={{ fontSize: 12, color: "#f0f0f5", width: 32, textAlign: "right" }}>{artImgOffsetY}</span>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                        <span style={{ fontSize: 12, color: "#8b8b9e", width: 75, flexShrink: 0 }}>🔍 Scale</span>
                                                        <input type="range" min={10} max={500} value={artImgScale}
                                                            onChange={(e) => setArtImgScale(parseInt(e.target.value))}
                                                            style={{ flex: 1, accentColor: "#58a6ff", cursor: "pointer" }}
                                                        />
                                                        <span style={{ fontSize: 12, color: "#f0f0f5", width: 32, textAlign: "right" }}>{artImgScale}%</span>
                                                    </div>
                                                </div>

                                                {/* Live preview grid */}
                                                <div style={{ marginTop: 12, display: "flex", gap: 0 }}>
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 6 }}>
                                                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                                            <span key={i} style={{ fontSize: 8, color: "#55556a", height: 11, lineHeight: "11px", textAlign: "right", width: 12 }}>{d}</span>
                                                        ))}
                                                    </div>
                                                    <div style={{
                                                        display: "grid", gridTemplateRows: "repeat(7, 11px)",
                                                        gridAutoFlow: "column", gap: 2,
                                                    }}>
                                                        {cells.map((cell) => {
                                                            const level = cell.inRange ? (imagePreview[cell.date] ?? 0) : -1;
                                                            return (
                                                                <div key={cell.date}
                                                                    className={level >= 0 ? `contrib-${level}` : ""}
                                                                    style={{
                                                                        width: 11, height: 11, borderRadius: 2,
                                                                        opacity: cell.inRange ? 1 : 0.15,
                                                                        backgroundColor: level < 0 ? "#161b22" : undefined,
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Brush selector */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 12, color: "#55556a" }}>Brush:</span>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                {INTENSITY_LABELS.map((item) => (
                                                    <button key={item.level} onClick={() => setArtBrush(item.level)} title={`${item.label} (${item.commits}/day)`}
                                                        style={{
                                                            width: 28, height: 28, borderRadius: 6, backgroundColor: item.color,
                                                            border: artBrush === item.level ? "2px solid #fff" : "2px solid transparent",
                                                            cursor: "pointer", transition: "all 0.15s",
                                                            transform: artBrush === item.level ? "scale(1.15)" : "scale(1)",
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span style={{ fontSize: 12, color: "#8b8b9e", marginLeft: 8 }}>
                                                {INTENSITY_LABELS[artBrush].label} ({INTENSITY_LABELS[artBrush].commits}/day)
                                            </span>
                                            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                                <input type="file" accept="image/*" id="art-image-upload" style={{ display: "none" }}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => {
                                                                const src = ev.target?.result as string;
                                                                setArtImageSrc(src);
                                                                setArtImgOffsetX(0);
                                                                setArtImgOffsetY(0);
                                                                setArtImgScale(100);
                                                                // Pre-load image so canvas can use it synchronously
                                                                const preload = new Image();
                                                                preload.src = src;
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                        e.target.value = "";
                                                    }}
                                                />
                                                <button onClick={() => document.getElementById("art-image-upload")?.click()}
                                                    className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}>
                                                    📷 Image
                                                </button>
                                                <button onClick={() => {
                                                    const text = artText.trim();
                                                    if (!text) return;
                                                    // Render text to canvas
                                                    const c = document.createElement("canvas");
                                                    const fontSize = 80;
                                                    const ctx2 = c.getContext("2d")!;
                                                    ctx2.font = `bold ${fontSize}px Arial, sans-serif`;
                                                    const metrics = ctx2.measureText(text);
                                                    c.width = Math.ceil(metrics.width) + 10;
                                                    c.height = fontSize + 20;
                                                    const ctx3 = c.getContext("2d")!;
                                                    ctx3.fillStyle = "#ffffff";
                                                    ctx3.fillRect(0, 0, c.width, c.height);
                                                    ctx3.font = `bold ${fontSize}px Arial, sans-serif`;
                                                    ctx3.fillStyle = "#000000";
                                                    ctx3.textBaseline = "middle";
                                                    ctx3.fillText(text, 5, c.height / 2);
                                                    const dataUrl = c.toDataURL();
                                                    setArtImageSrc(dataUrl);
                                                    setArtImgOffsetX(0);
                                                    setArtImgOffsetY(0);
                                                    setArtImgScale(100);
                                                    // Pre-load
                                                    const pl = new Image(); pl.src = dataUrl;
                                                }} className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                                                    disabled={!artText.trim()}
                                                >
                                                    🔤 Render
                                                </button>
                                                <button onClick={() => {
                                                    const filled: Record<string, number> = {};
                                                    artDates.forEach(d => { filled[d] = artBrush; });
                                                    setArtIntensities(filled);
                                                }} className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}>
                                                    Fill All
                                                </button>
                                                <button onClick={() => setArtIntensities({})}
                                                    className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}>
                                                    Clear
                                                </button>
                                            </div>
                                        </div>

                                        {/* Text input */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                                            <span style={{ fontSize: 12, color: "#55556a" }}>Text:</span>
                                            <input type="text" value={artText} onChange={(e) => setArtText(e.target.value)}
                                                placeholder="Type text to render on graph..."
                                                style={{ flex: 1, padding: "6px 10px", fontSize: 13, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#f0f0f5" }}
                                            />
                                        </div>

                                        {/* Contribution Grid */}
                                        <div style={{ overflowX: "auto", paddingBottom: 8 }}
                                            onMouseLeave={() => setIsPainting(false)}
                                        >
                                            {/* Month labels */}
                                            <div style={{ display: "flex", marginLeft: 32, marginBottom: 4, gap: 0 }}>
                                                {monthLabels.map((ml, i) => (
                                                    <span key={i} style={{
                                                        fontSize: 10, color: "#55556a",
                                                        position: "relative", left: ml.col * 16,
                                                        whiteSpace: "nowrap",
                                                    }}>{ml.label}</span>
                                                ))}
                                            </div>

                                            <div style={{ display: "flex", gap: 0 }}>
                                                {/* Day labels */}
                                                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 6, paddingTop: 0 }}>
                                                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                                                        <span key={i} style={{ fontSize: 9, color: "#55556a", height: 13, lineHeight: "13px", textAlign: "right", width: 24 }}>
                                                            {i % 2 === 1 ? d : ""}
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Grid */}
                                                <div style={{
                                                    display: "grid",
                                                    gridTemplateRows: "repeat(7, 13px)",
                                                    gridAutoFlow: "column",
                                                    gap: 3,
                                                    userSelect: "none",
                                                }}>
                                                    {cells.map((cell) => {
                                                        const level = cell.inRange ? (artIntensities[cell.date] ?? 0) : -1;
                                                        return (
                                                            <div
                                                                key={cell.date}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    if (cell.inRange) { setIsPainting(true); paintCell(cell.date); }
                                                                }}
                                                                onMouseEnter={() => {
                                                                    if (isPainting && cell.inRange) paintCell(cell.date);
                                                                }}
                                                                onMouseUp={() => setIsPainting(false)}
                                                                title={cell.inRange ? `${cell.date}: Level ${level} (${INTENSITY_LABELS[level]?.commits ?? 0}/day)` : cell.date}
                                                                className={level >= 0 ? `contrib-${level}` : ""}
                                                                style={{
                                                                    width: 13, height: 13, borderRadius: 2,
                                                                    cursor: cell.inRange ? "pointer" : "default",
                                                                    opacity: cell.inRange ? 1 : 0.15,
                                                                    backgroundColor: level < 0 ? "#161b22" : undefined,
                                                                    transition: "background-color 0.1s",
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Legend */}
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: "#55556a" }}>
                                            <span>{Object.values(artIntensities).filter(v => v > 0).length} of {artDates.length} days painted</span>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <span>Less</span>
                                                {INTENSITY_LABELS.map((item) => (
                                                    <div key={item.level} className={`contrib-${item.level}`} style={{ width: 12, height: 12, borderRadius: 2 }} />
                                                ))}
                                                <span>More</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </section>

                        {/* File & Content */}
                        <section className="glass-card" style={{ padding: 24 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <FileText style={{ width: 16, height: 16, color: "#bc8cff" }} /> File & Content
                            </h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div>
                                    <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>Target File</label>
                                    <input type="text" value={targetFile} onChange={(e) => setTargetFile(e.target.value)} placeholder="README.md" />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>
                                        Content Template <span style={{ color: "#55556a" }}>{"Variables: {{date}} {{time}} {{commit_number}} {{uuid}}"}</span>
                                    </label>
                                    <textarea value={contentTemplate} onChange={(e) => setContentTemplate(e.target.value)} rows={3} style={{ resize: "none", fontFamily: "monospace", fontSize: 13 }} />
                                </div>
                            </div>
                        </section>

                        {/* AI Config */}
                        <section className="glass-card" style={{ padding: 24 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: useAI ? 16 : 0 }}>
                                <h2 style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                    <Sparkles style={{ width: 16, height: 16, color: "#58a6ff" }} /> AI Commit Messages
                                </h2>
                                <button onClick={() => setUseAI(!useAI)} className={`toggle-switch ${useAI ? "active" : ""}`} />
                            </div>
                            {useAI && (
                                <div className="animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <div>
                                        <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>API Base URL (OpenAI-compatible)</label>
                                        <input type="url" value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} placeholder="https://api.openai.com" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>API Key</label>
                                        <input type="password" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)} placeholder="sk-..." />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 12, color: "#55556a", display: "block", marginBottom: 6 }}>Model ID <span style={{ color: "#55556a" }}>(optional, defaults to gpt-3.5-turbo)</span></label>
                                        <input type="text" value={aiModelId} onChange={(e) => setAiModelId(e.target.value)} placeholder="gpt-4o-mini, claude-3-haiku, deepseek-chat, etc." />
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <button
                                            onClick={async () => {
                                                setAiTesting(true);
                                                setAiTestResult(null);
                                                try {
                                                    const res = await fetch("/api/ai/test", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ baseUrl: aiBaseUrl, apiKey: aiApiKey, modelId: aiModelId }),
                                                    });
                                                    const data = await res.json();
                                                    setAiTestResult(data);
                                                } catch {
                                                    setAiTestResult({ success: false, error: "Network error" });
                                                } finally {
                                                    setAiTesting(false);
                                                }
                                            }}
                                            disabled={!aiBaseUrl || !aiApiKey || aiTesting}
                                            className="btn btn-secondary"
                                            style={{ fontSize: 13, padding: "8px 16px" }}
                                        >
                                            {aiTesting ? <><Loader2 className="spinner" style={{ width: 14, height: 14 }} /> Testing...</> : "⚡ Test Connection"}
                                        </button>
                                        <span style={{ fontSize: 12, color: "#55556a", display: "flex", alignItems: "center", gap: 4 }}>
                                            <Lock style={{ width: 12, height: 12 }} /> Key sent securely, never stored
                                        </span>
                                    </div>
                                    {aiTestResult && (
                                        <div style={{
                                            padding: 12, borderRadius: 10, fontSize: 13,
                                            background: aiTestResult.success ? "rgba(57,211,83,0.1)" : "rgba(248,81,73,0.1)",
                                            border: `1px solid ${aiTestResult.success ? "rgba(57,211,83,0.3)" : "rgba(248,81,73,0.3)"}`,
                                            color: aiTestResult.success ? "#39d353" : "#f85149",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: aiTestResult.details ? 8 : 0 }}>
                                                {aiTestResult.success ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : <XCircle style={{ width: 14, height: 14 }} />}
                                                <span style={{ fontWeight: 500 }}>{aiTestResult.success ? "Connection successful!" : "Connection failed"}</span>
                                            </div>
                                            {aiTestResult.error && <div style={{ fontSize: 12, marginTop: 4, color: "#f85149", opacity: 0.8 }}>{aiTestResult.error}</div>}
                                            {aiTestResult.details?.models && (() => {
                                                const models = aiTestResult.details.models;
                                                return (
                                                    <div style={{ fontSize: 12, color: "#8b8b9e", marginTop: 4 }}>
                                                        Available models: {models.slice(0, 5).join(", ")}
                                                        {models.length > 5 && ` +${models.length - 5} more`}
                                                    </div>
                                                );
                                            })()}
                                            {aiTestResult.details?.response && (
                                                <div style={{ fontSize: 12, color: "#8b8b9e", marginTop: 4 }}>
                                                    Model: {aiTestResult.details.model} — Response: &quot;{aiTestResult.details.response}&quot;
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* ===== RIGHT COLUMN ===== */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        {/* Run Configuration */}
                        <section className="glass-card" style={{ padding: 24, position: "sticky", top: 96 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <Settings2 style={{ width: 16, height: 16, color: "#39d353" }} /> Run Configuration
                            </h2>

                            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <Eye style={{ width: 16, height: 16, color: "#55556a" }} />
                                        <span style={{ fontSize: 14 }}>Dry Run</span>
                                    </div>
                                    <button onClick={() => setDryRun(!dryRun)} className={`toggle-switch ${dryRun ? "active" : ""}`} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <GitPullRequest style={{ width: 16, height: 16, color: "#55556a" }} />
                                        <span style={{ fontSize: 14 }}>Create Pull Request</span>
                                    </div>
                                    <button onClick={() => setCreatePR(!createPR)} className={`toggle-switch ${createPR ? "active" : ""}`} />
                                </div>
                            </div>

                            {/* Summary */}
                            {selectedRepo && (
                                <div style={{
                                    padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.02)",
                                    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24,
                                }}>
                                    <h3 style={{ fontSize: 11, fontWeight: 600, color: "#55556a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                                        Summary
                                    </h3>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "#55556a" }}>Repository</span>
                                            <span style={{ fontWeight: 500 }}>{selectedRepo.name}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "#55556a" }}>Days</span>
                                            <span style={{ fontWeight: 500 }}>{totalDays}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "#55556a" }}>Commits/Day</span>
                                            <span style={{ fontWeight: 500 }}>{INTENSITY_LABELS[intensityLevel].commits}</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 4 }}>
                                            <span style={{ color: "#55556a" }}>Total Commits</span>
                                            <span style={{ fontWeight: 700, color: "#39d353" }}>{totalDays * INTENSITY_LABELS[intensityLevel].commits}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button onClick={startJob} disabled={!selectedRepo || jobRunning || intensityLevel === 0}
                                className="btn btn-primary" style={{ width: "100%", padding: "12px 20px", fontSize: 15 }}>
                                {jobRunning ? (<><Loader2 className="spinner" style={{ width: 20, height: 20 }} /> Running...</>)
                                    : dryRun ? (<><Eye style={{ width: 20, height: 20 }} /> Start Dry Run</>)
                                        : (<><Play style={{ width: 20, height: 20 }} /> Start Backfill</>)}
                            </button>
                        </section>

                        {/* Progress & Logs */}
                        {jobStatus && (
                            <section className="glass-card animate-fade-in-up" style={{ padding: 24 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                    <h2 style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                        <MessageSquare style={{ width: 16, height: 16, color: "#58a6ff" }} /> Execution Log
                                    </h2>
                                    <div>
                                        {jobStatus.status === "running" && (
                                            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#58a6ff" }}>
                                                <Loader2 className="spinner" style={{ width: 12, height: 12 }} /> Running
                                            </span>
                                        )}
                                        {jobStatus.status === "completed" && (
                                            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#39d353" }}>
                                                <CheckCircle2 style={{ width: 12, height: 12 }} /> Complete
                                            </span>
                                        )}
                                        {jobStatus.status === "failed" && (
                                            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#f85149" }}>
                                                <XCircle style={{ width: 12, height: 12 }} /> Failed
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {jobStatus.totalSteps > 0 && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#55556a", marginBottom: 4 }}>
                                            <span>Progress</span>
                                            <span>{jobStatus.progress}/{jobStatus.totalSteps} ({Math.round((jobStatus.progress / jobStatus.totalSteps) * 100)}%)</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div className="progress-bar-fill" style={{ width: `${(jobStatus.progress / jobStatus.totalSteps) * 100}%` }} />
                                        </div>
                                    </div>
                                )}

                                {jobStatus.prUrl && (
                                    <a href={jobStatus.prUrl} target="_blank" rel="noopener noreferrer"
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8, padding: 12, borderRadius: 10,
                                            background: "rgba(57,211,83,0.15)", color: "#39d353", fontSize: 14,
                                            marginBottom: 16, textDecoration: "none", transition: "opacity 0.2s",
                                        }}>
                                        <GitPullRequest style={{ width: 16, height: 16 }} /> View Pull Request
                                    </a>
                                )}

                                <div ref={logContainerRef} style={{
                                    background: "#0d1117", borderRadius: 12, padding: 16,
                                    maxHeight: 500, overflowY: "auto", overflowX: "hidden",
                                    fontFamily: "monospace", fontSize: 12, lineHeight: 1.8,
                                    wordBreak: "break-all", overflowWrap: "break-word",
                                }}>
                                    {jobStatus.logs && jobStatus.logs.length > 0 ? (
                                        jobStatus.logs.map((log, i) => (
                                            <div key={i} className={`log-${log.level}`} style={{ paddingTop: 2, paddingBottom: 2 }}>
                                                <span style={{ color: "#55556a", marginRight: 8 }}>
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </span>
                                                {log.message}
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ color: "#55556a", display: "flex", alignItems: "center", gap: 8 }}>
                                            <Loader2 className="spinner" style={{ width: 12, height: 12 }} /> Waiting for logs...
                                        </div>
                                    )}
                                </div>

                                {(jobStatus.status === "completed" || jobStatus.status === "failed") && (
                                    <button onClick={() => { setJobStatus(null); setCurrentJobId(null); }}
                                        className="btn btn-secondary" style={{ width: "100%", marginTop: 16, fontSize: 14 }}>
                                        <RefreshCw style={{ width: 16, height: 16 }} /> New Job
                                    </button>
                                )}
                            </section>
                        )}
                    </div>
                </div>
            </div>

            {/* Responsive: stack on mobile */}
            <style>{`
        @media (max-width: 1024px) {
          div[style*="grid-template-columns: 1fr 420px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
        </div>
    );
}
