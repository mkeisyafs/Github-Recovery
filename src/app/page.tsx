"use client";

import { useEffect, useState } from "react";
import { Github, GitBranch, Calendar, Zap, Shield, ArrowRight, Sparkles } from "lucide-react";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="bg-grid" style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* Background Orbs */}
      <div className="orb orb-green" style={{ top: "10%", left: "5%" }} />
      <div className="orb orb-blue" style={{ top: "60%", right: "10%" }} />
      <div className="orb orb-purple" style={{ top: "30%", right: "30%" }} />

      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #39d353, #58a6ff)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GitBranch style={{ width: 20, height: 20, color: "#000" }} />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700 }}>Git Recovery</span>
        </div>
        <a href="/api/auth/login" className="btn btn-secondary" style={{ fontSize: 14 }}>
          <Github style={{ width: 16, height: 16 }} /> Sign In
        </a>
      </header>

      {/* Hero */}
      <main style={{
        position: "relative", zIndex: 10, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "80px 24px 128px",
      }}>
        <div style={{
          textAlign: "center", maxWidth: 900, margin: "0 auto",
          transition: "all 0.7s", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(32px)",
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.06)", background: "rgba(17,17,24,0.6)",
            marginBottom: 32,
          }}>
            <Sparkles style={{ width: 16, height: 16, color: "#39d353" }} />
            <span style={{ fontSize: 14, color: "#8b8b9e" }}>Powered by GitHub App — Secure & Token-based</span>
          </div>

          <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 24, letterSpacing: "-0.02em" }}>
            Recover Your<br />
            <span className="gradient-text">Git Contributions</span>
          </h1>

          <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "#8b8b9e", maxWidth: 640, margin: "0 auto 48px", lineHeight: 1.6 }}>
            Create backdated commits on your GitHub repositories with precision.
            Fill contribution gaps, recover lost history, and maintain your streak — all through a secure GitHub App.
          </p>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 80 }}>
            <a href="/api/auth/login" className="btn btn-primary" style={{ fontSize: 16, padding: "14px 32px" }}>
              <Github style={{ width: 20, height: 20 }} />
              Get Started with GitHub
              <ArrowRight style={{ width: 16, height: 16 }} />
            </a>
          </div>

          {/* Contribution Graph Preview */}
          <div className="glass-card" style={{
            padding: 32, maxWidth: 720, margin: "0 auto",
            transition: "all 0.7s 0.3s", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(32px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <div className="animate-pulse-glow" style={{ width: 8, height: 8, borderRadius: "50%", background: "#39d353" }} />
              <span style={{ fontSize: 14, color: "#8b8b9e", fontWeight: 500 }}>Contribution Graph Preview</span>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(52, 1fr)", gap: 3,
            }}>
              {Array.from({ length: 364 }).map((_, i) => {
                const level = Math.random() > 0.6 ? Math.floor(Math.random() * 5) : 0;
                return <div key={i} className={`contrib-${level}`} style={{ aspectRatio: "1", borderRadius: 3 }} />;
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 16 }}>
              <span style={{ fontSize: 12, color: "#55556a", marginRight: 8 }}>Less</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <div key={level} className={`contrib-${level}`} style={{ width: 12, height: 12, borderRadius: 3 }} />
              ))}
              <span style={{ fontSize: 12, color: "#55556a", marginLeft: 8 }}>More</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24,
          maxWidth: 960, margin: "80px auto 0", width: "100%",
          transition: "all 0.7s 0.5s", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(32px)",
        }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: "rgba(57,211,83,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <Calendar style={{ width: 24, height: 24, color: "#39d353" }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Date Range Picker</h3>
            <p style={{ fontSize: 14, color: "#8b8b9e", lineHeight: 1.6 }}>
              Select any date range or provide custom dates. Commits are randomized throughout the day for natural-looking activity.
            </p>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: "rgba(88,166,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <Zap style={{ width: 24, height: 24, color: "#58a6ff" }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Configurable Intensity</h3>
            <p style={{ fontSize: 14, color: "#8b8b9e", lineHeight: 1.6 }}>
              From light (1 commit/day) to extreme (10 commits/day). Control exactly how your contribution graph fills up.
            </p>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: "rgba(188,140,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <Shield style={{ width: 24, height: 24, color: "#bc8cff" }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Secure by Design</h3>
            <p style={{ fontSize: 14, color: "#8b8b9e", lineHeight: 1.6 }}>
              Uses GitHub App installation tokens. No personal access tokens stored. Temporary repos are cleaned up automatically.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 10, borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "24px 48px",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, color: "#55556a" }}>Git Recovery — Use responsibly</span>
          <span style={{ fontSize: 14, color: "#55556a" }}>Powered by GitHub App</span>
        </div>
      </footer>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
