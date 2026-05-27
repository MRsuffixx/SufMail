"use client";

import { useState, useEffect } from "react";
import type { InstallPayload } from "~/types/install";

interface ReviewStepProps {
  onNext: () => void;
  onBack: () => void;
  onEdit: (step: number) => void;
  installData: Partial<InstallPayload>;
}

export default function ReviewStep({ onNext, onBack, onEdit, installData }: ReviewStepProps) {
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const addProgress = (msg: string) => setProgress((p) => [...p, msg]);

  const startInstall = async () => {
    setInstalling(true);
    setProgress([]);

    try {
      const steps = [
        "Generating secrets...",
        "Writing .env file...",
        "Writing config.ts...",
        "Running database migrations...",
        "Running database seed...",
        "Creating admin account...",
        "Creating mail account...",
        "Creating install.lock...",
        "Done!",
      ];

      for (const step of steps) {
        addProgress(step);
        await new Promise((r) => setTimeout(r, 600));
      }

      const res = await fetch("/api/install/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(installData),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error ?? "Install failed");
      }

      setDone(true);
      setTimeout(() => {
        window.location.href = data.redirectTo ?? "/";
      }, 2000);
    } catch (err) {
      setInstalling(false);
      setProgress((p) => [...p, `Error: ${err instanceof Error ? err.message : "Unknown error"}`]);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Review & Install</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Review your settings before installing MailForge.
      </p>

      {installing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {progress.map((msg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: msg.startsWith("Error") ? "#fef2f2" : "#f0fdf4", border: `1px solid ${msg.startsWith("Error") ? "#fecaca" : "#bbf7d0"}`, fontSize: 14 }}>
              <span style={{ fontSize: 16 }}>{msg.startsWith("Error") ? "❌" : msg === "Done!" ? "✅" : "⏳"}</span>
              <span style={{ color: msg.startsWith("Error") ? "#dc2626" : "#166534" }}>{msg}</span>
            </div>
          ))}
        </div>
      ) : done ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Installation Complete!</h3>
          <p style={{ color: "#64748b" }}>Redirecting to MailForge...</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SummaryCard title="Database" onEdit={() => onEdit(2)}>
              <div style={summaryValue}>{(installData.database?.useDocker ? "Bundled PostgreSQL (Docker)" : "External database")}</div>
              <div style={summaryMono}>{installData.database?.connectionString?.replace(/:[^:@]+@/, ":****@")}</div>
            </SummaryCard>

            <SummaryCard title="Application" onEdit={() => onEdit(3)}>
              <div style={summaryValue}>{installData.app?.name}</div>
              <div style={summaryMono}>{installData.app?.url}</div>
              <div style={summaryTag}>{installData.app?.theme?.defaultMode} · {installData.app?.theme?.density} density · {installData.app?.theme?.mailListLayout} layout</div>
            </SummaryCard>

            <SummaryCard title="Mail Server" onEdit={() => onEdit(4)}>
              <div style={summaryGrid}>
                <div><span style={summaryLabel}>IMAP</span> {installData.mail?.imap?.host}:{installData.mail?.imap?.port} {installData.mail?.imap?.tls ? "TLS" : "plain"}</div>
                <div><span style={summaryLabel}>SMTP</span> {installData.mail?.smtp?.host}:{installData.mail?.smtp?.port} {installData.mail?.smtp?.secure ? "TLS" : "plain"}</div>
                <div><span style={summaryLabel}>Sync</span> every {installData.mail?.syncInterval}s · Max attachment {installData.mail?.maxAttachmentSize}MB</div>
              </div>
            </SummaryCard>

            <SummaryCard title="Auth & Security" onEdit={() => onEdit(5)}>
              <div style={summaryTag}>
                {installData.auth?.allowRegistration ? "Registration open" : "Registration closed"}
                {installData.auth?.requireEmailVerification ? " · Email verification required" : ""}
                {installData.auth?.enable2FA ? " · 2FA enabled" : ""}
              </div>
              <div style={summaryGrid}>
                <span>Session: {installData.auth?.sessionDays} days</span>
              </div>
            </SummaryCard>

            <SummaryCard title="Admin Account" onEdit={() => onEdit(6)}>
              <div style={summaryValue}>{installData.admin?.name}</div>
              <div style={summaryMono}>{installData.admin?.email}</div>
              {installData.mailAccount && (
                <>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>Mail account: {installData.mailAccount.email}</div>
                </>
              )}
            </SummaryCard>
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
            <button onClick={onBack} style={backButtonStyle}>Back</button>
            <button onClick={startInstall} style={{ ...primaryButtonStyle, background: "#16a34a" }}>Install MailForge</button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, children, onEdit }: { title: string; children: React.ReactNode; onEdit: () => void }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "#4f46e5", fontSize: 13, padding: 0 }}>Edit</button>
      </div>
      {children}
    </div>
  );
}

const summaryValue: React.CSSProperties = { fontSize: 15, fontWeight: 500 };
const summaryMono: React.CSSProperties = { fontSize: 12, color: "#64748b", fontFamily: "monospace" };
const summaryTag: React.CSSProperties = { fontSize: 12, color: "#64748b", marginTop: 4 };
const summaryLabel: React.CSSProperties = { fontSize: 11, color: "#94a3b8", textTransform: "uppercase" };
const summaryGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 13, marginTop: 4 };
const backButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontSize: 15 };
const primaryButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "none", color: "white", fontWeight: 500, fontSize: 15 };