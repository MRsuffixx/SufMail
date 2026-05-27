"use client";

import { useState } from "react";

interface AdminAccountStepProps {
  onNext: (data: {
    name: string;
    email: string;
    password: string;
    mailAccount?: {
      email: string;
      imap: { host: string; port: number; tls: boolean };
      smtp: { host: string; port: number; secure: boolean };
      displayName: string;
      color: string;
      emoji: string;
    };
  }) => void;
  onBack: () => void;
  initialData?: AdminAccountStepProps["onNext"] extends (data: infer T) => void ? T : never;
}

export default function AdminAccountStep({ onNext, onBack, initialData }: AdminAccountStepProps) {
  const [adminName, setAdminName] = useState(initialData?.name ?? "");
  const [adminEmail, setAdminEmail] = useState(initialData?.email ?? "");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [addMailAccount, setAddMailAccount] = useState(true);
  const [mailEmail, setMailEmail] = useState("");
  const [mailImapHost, setMailImapHost] = useState("imap.gmail.com");
  const [mailImapPort, setMailImapPort] = useState(993);
  const [mailImapTls, setMailImapTls] = useState(true);
  const [mailImapUser, setMailImapUser] = useState("");
  const [mailImapPassword, setMailImapPassword] = useState("");
  const [mailSmtpHost, setMailSmtpHost] = useState("smtp.gmail.com");
  const [mailSmtpPort, setMailSmtpPort] = useState(587);
  const [mailSmtpSecure, setMailSmtpSecure] = useState(false);
  const [mailSmtpUser, setMailSmtpUser] = useState("");
  const [mailSmtpPassword, setMailSmtpPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState("#4f46e5");
  const [emoji, setEmoji] = useState("📧");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState({ subject: "", from: "", date: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!adminName.trim()) errs.name = "Full name is required";
    if (!validateEmail(adminEmail)) errs.email = "Valid email is required";
    if (adminPassword.length < 12) errs.password = "Password must be at least 12 characters";
    if (!/[A-Z]/.test(adminPassword)) errs.password = "Password must contain an uppercase letter";
    if (!/[a-z]/.test(adminPassword)) errs.password = "Password must contain a lowercase letter";
    if (!/[0-9]/.test(adminPassword)) errs.password = "Password must contain a number";
    if (!/[^A-Za-z0-9]/.test(adminPassword)) errs.password = "Password must contain a symbol";
    if (adminPassword !== adminPasswordConfirm) errs.passwordConfirm = "Passwords do not match";
    if (addMailAccount && !validateEmail(mailEmail)) errs.mailEmail = "Valid email is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const testMailAccount = async () => {
    setTestStatus("testing");
    try {
      const res = await fetch("/api/install/test-mail-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: mailEmail,
          imap: { host: mailImapHost, port: mailImapPort, tls: mailImapTls, user: mailImapUser, password: mailImapPassword },
          smtp: { host: mailSmtpHost, port: mailSmtpPort, secure: mailSmtpSecure, user: mailSmtpUser, password: mailSmtpPassword },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus("success");
        setTestMessage({ subject: data.subject ?? "", from: data.from ?? "", date: data.date ?? "" });
      } else {
        setTestStatus("error");
        setTestMessage({ subject: "", from: "", date: "" });
        errors.mailTest = data.error ?? "Test failed";
      }
    } catch {
      setTestStatus("error");
      errors.mailTest = "Network error";
    }
    setErrors({ ...errors });
  };

  const handleNext = () => {
    if (!validate()) return;
    onNext({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      mailAccount: addMailAccount
        ? {
            email: mailEmail,
            imap: { host: mailImapHost, port: mailImapPort, tls: mailImapTls },
            smtp: { host: mailSmtpHost, port: mailSmtpPort, secure: mailSmtpSecure },
            displayName: displayName || adminName,
            color,
            emoji,
          }
        : undefined,
    });
  };

  const strength = getPasswordStrength(adminPassword);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Admin Account & Mail Account</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Create your admin account and optionally add your first mail account.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, margin: 0 }}>
          <legend style={{ fontWeight: 600, padding: "0 8px" }}>Admin Account</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} style={inputStyle} />
              {errors.name && <span style={errorStyle}>{errors.name}</span>}
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={inputStyle} />
              {errors.email && <span style={errorStyle}>{errors.email}</span>}
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={inputStyle} />
              {adminPassword && (
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: strengthColor[strength] }}>Strength: {strengthLabel[strength]}</span>
                  <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2, marginTop: 4 }}>
                    <div style={{ height: "100%", width: `${(strength / 5) * 100}%`, background: strengthColor[strength], borderRadius: 2 }} />
                  </div>
                </div>
              )}
              {errors.password && <span style={errorStyle}>{errors.password}</span>}
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" value={adminPasswordConfirm} onChange={(e) => setAdminPasswordConfirm(e.target.value)} style={inputStyle} />
              {errors.passwordConfirm && <span style={errorStyle}>{errors.passwordConfirm}</span>}
            </div>
          </div>
        </fieldset>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="checkbox" checked={addMailAccount} onChange={(e) => setAddMailAccount(e.target.checked)} id="addMail" />
          <label htmlFor="addMail" style={{ fontSize: 15, cursor: "pointer" }}>Add mail account now</label>
        </div>

        {addMailAccount && (
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, margin: 0 }}>
            <legend style={{ fontWeight: 600, padding: "0 8px" }}>First Mail Account</legend>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={mailEmail} onChange={(e) => setMailEmail(e.target.value)} style={inputStyle} />
                {errors.mailEmail && <span style={errorStyle}>{errors.mailEmail}</span>}
              </div>
              <div>
                <label style={labelStyle}>IMAP Host</label>
                <input type="text" value={mailImapHost} onChange={(e) => setMailImapHost(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>IMAP User</label>
                  <input type="text" value={mailImapUser} onChange={(e) => setMailImapUser(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>IMAP Port</label>
                  <input type="number" value={mailImapPort} onChange={(e) => setMailImapPort(parseInt(e.target.value) || 993)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>TLS</label>
                  <input type="checkbox" checked={mailImapTls} onChange={(e) => setMailImapTls(e.target.checked)} style={{ marginTop: 8 }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>IMAP Password</label>
                <input type="password" value={mailImapPassword} onChange={(e) => setMailImapPassword(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>SMTP Host</label>
                <input type="text" value={mailSmtpHost} onChange={(e) => setMailSmtpHost(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>SMTP User</label>
                  <input type="text" value={mailSmtpUser} onChange={(e) => setMailSmtpUser(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>SMTP Port</label>
                  <input type="number" value={mailSmtpPort} onChange={(e) => setMailSmtpPort(parseInt(e.target.value) || 587)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Secure</label>
                  <input type="checkbox" checked={mailSmtpSecure} onChange={(e) => setMailSmtpSecure(e.target.checked)} style={{ marginTop: 8 }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>SMTP Password</label>
                <input type="password" value={mailSmtpPassword} onChange={(e) => setMailSmtpPassword(e.target.value)} style={inputStyle} />
              </div>
              <button onClick={testMailAccount} disabled={testStatus === "testing" || !mailEmail || !mailImapPassword} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontSize: 14, alignSelf: "flex-start" }}>
                {testStatus === "testing" ? "Testing..." : "Verify & Fetch Test Message"}
              </button>
              {testStatus === "success" && (
                <div style={{ padding: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 13 }}>
                  <div><strong>Subject:</strong> {testMessage.subject}</div>
                  <div><strong>From:</strong> {testMessage.from}</div>
                  <div><strong>Date:</strong> {testMessage.date}</div>
                </div>
              )}
              {testStatus === "error" && errors.mailTest && <span style={errorStyle}>{errors.mailTest}</span>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} placeholder={adminName} />
                </div>
                <div>
                  <label style={labelStyle}>Color</label>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: "100%", height: 36, padding: 2, borderRadius: 6, border: "1px solid #cbd5e1", cursor: "pointer" }} />
                </div>
                <div>
                  <label style={labelStyle}>Emoji</label>
                  <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} style={inputStyle} placeholder="📧" maxLength={2} />
                </div>
              </div>
            </div>
          </fieldset>
        )}
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <button onClick={onBack} style={backButtonStyle}>Back</button>
        <button onClick={handleNext} style={primaryButtonStyle}>Continue</button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" };
const errorStyle: React.CSSProperties = { fontSize: 12, color: "#ef4444", marginTop: 2, display: "block" };
const backButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontSize: 15 };
const primaryButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "none", background: "#4f46e5", color: "white", fontWeight: 500, fontSize: 15 };