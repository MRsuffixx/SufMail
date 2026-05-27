"use client";

import { useState } from "react";

interface MailServerStepProps {
  onNext: (data: {
    imap: { host: string; port: number; tls: boolean };
    smtp: { host: string; port: number; secure: boolean };
    syncInterval: number;
    maxAttachmentSize: number;
    allowedDomains: string[];
  }) => void;
  onBack: () => void;
  initialData?: {
    imap: { host: string; port: number; tls: boolean };
    smtp: { host: string; port: number; secure: boolean };
    syncInterval: number;
    maxAttachmentSize: number;
    allowedDomains: string[];
  };
}

export default function MailServerStep({ onNext, onBack, initialData }: MailServerStepProps) {
  const [imapHost, setImapHost] = useState(initialData?.imap.host ?? "imap.gmail.com");
  const [imapPort, setImapPort] = useState(initialData?.imap.port ?? 993);
  const [imapTls, setImapTls] = useState(initialData?.imap.tls ?? true);
  const [smtpHost, setSmtpHost] = useState(initialData?.smtp.host ?? "smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(initialData?.smtp.port ?? 587);
  const [smtpSecure, setSmtpSecure] = useState(initialData?.smtp.secure ?? false);
  const [syncInterval, setSyncInterval] = useState(initialData?.syncInterval ?? 60);
  const [maxAttachmentSize, setMaxAttachmentSize] = useState(initialData?.maxAttachmentSize ?? 25);
  const [allowedDomains, setAllowedDomains] = useState<string[]>(initialData?.allowedDomains ?? []);
  const [domainInput, setDomainInput] = useState("");
  const [testImapStatus, setTestImapStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testSmtpStatus, setTestSmtpStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState("");

  const testImap = async (user: string, password: string) => {
    setTestImapStatus("testing");
    setTestResult("");
    try {
      const res = await fetch("/api/install/test-imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: imapHost, port: imapPort, tls: imapTls, user, password }),
      });
      const data = await res.json();
      if (data.success) {
        setTestImapStatus("success");
        setTestResult(`Connected! Capabilities: ${data.capabilities?.join(", ")} (${data.latencyMs}ms)`);
      } else {
        setTestImapStatus("error");
        setTestResult(data.error ?? "Connection failed");
      }
    } catch {
      setTestImapStatus("error");
      setTestResult("Network error");
    }
  };

  const testSmtp = async (user: string, password: string) => {
    setTestSmtpStatus("testing");
    setTestResult("");
    try {
      const res = await fetch("/api/install/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: smtpHost, port: smtpPort, secure: smtpSecure, user, password }),
      });
      const data = await res.json();
      if (data.success) {
        setTestSmtpStatus("success");
        setTestResult(`SMTP connected (${data.latencyMs}ms)`);
      } else {
        setTestSmtpStatus("error");
        setTestResult(data.error ?? "Connection failed");
      }
    } catch {
      setTestSmtpStatus("error");
      setTestResult("Network error");
    }
  };

  const addDomain = () => {
    const d = domainInput.trim().toLowerCase();
    if (d && !allowedDomains.includes(d)) {
      setAllowedDomains([...allowedDomains, d]);
    }
    setDomainInput("");
  };

  const removeDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domain));
  };

  const formatInterval = (s: number) => {
    if (s < 60) return `${s} seconds`;
    return `${Math.round(s / 60)} minute${s >= 120 ? "s" : ""}`;
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Mail Server</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Configure your IMAP and SMTP server settings.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, margin: 0 }}>
          <legend style={{ fontWeight: 600, padding: "0 8px" }}>IMAP</legend>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Host</label>
              <input type="text" value={imapHost} onChange={(e) => setImapHost(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Port</label>
              <input type="number" value={imapPort} onChange={(e) => setImapPort(parseInt(e.target.value) || 993)} style={inputStyle} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input type="checkbox" checked={imapTls} onChange={(e) => setImapTls(e.target.checked)} />
            <span style={{ fontSize: 14 }}>Use TLS/SSL</span>
          </label>
        </fieldset>

        <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, margin: 0 }}>
          <legend style={{ fontWeight: 600, padding: "0 8px" }}>SMTP</legend>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Host</label>
              <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Port</label>
              <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)} style={inputStyle} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} />
            <span style={{ fontSize: 14 }}>Use TLS/SSL (secure)</span>
          </label>
        </fieldset>

        <div>
          <label style={labelStyle}>Sync Interval: every {formatInterval(syncInterval)}</label>
          <input
            type="range"
            min={30}
            max={3600}
            step={30}
            value={syncInterval}
            onChange={(e) => setSyncInterval(parseInt(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={labelStyle}>Max Attachment Size: {maxAttachmentSize}MB</label>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={maxAttachmentSize}
            onChange={(e) => setMaxAttachmentSize(parseInt(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={labelStyle}>Allowed Domains (leave empty = allow all)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDomain())}
              placeholder="example.com"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addDomain} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>Add</button>
          </div>
          {allowedDomains.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {allowedDomains.map((d) => (
                <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#eef2ff", borderRadius: 16, fontSize: 13 }}>
                  {d}
                  <button onClick={() => removeDomain(d)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <button onClick={onBack} style={backButtonStyle}>Back</button>
        <button onClick={() => onNext({ imap: { host: imapHost, port: imapPort, tls: imapTls }, smtp: { host: smtpHost, port: smtpPort, secure: smtpSecure }, syncInterval, maxAttachmentSize, allowedDomains })} style={primaryButtonStyle}>Continue</button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" };
const backButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontSize: 15 };
const primaryButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "none", background: "#4f46e5", color: "white", fontWeight: 500, fontSize: 15 };