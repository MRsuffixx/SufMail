"use client";

import { useState } from "react";

interface AuthStepProps {
  onNext: (data: {
    allowRegistration: boolean;
    allowedDomains: string[];
    requireEmailVerification: boolean;
    enable2FA: boolean;
    require2FA: boolean;
    sessionDays: number;
    providers: {
      google: boolean;
      github: boolean;
      microsoft: boolean;
      magicLink: boolean;
      credentials: boolean;
      googleClientId?: string;
      googleClientSecret?: string;
      githubClientId?: string;
      githubClientSecret?: string;
      microsoftClientId?: string;
      microsoftClientSecret?: string;
    };
  }) => void;
  onBack: () => void;
  initialData?: AuthStepProps["onNext"] extends (data: infer T) => void ? T : never;
}

export default function AuthStep({ onNext, onBack, initialData }: AuthStepProps) {
  const [allowRegistration, setAllowRegistration] = useState(initialData?.allowRegistration ?? true);
  const [allowedDomains, setAllowedDomains] = useState<string[]>(initialData?.allowedDomains ?? []);
  const [domainInput, setDomainInput] = useState("");
  const [requireEmailVerification, setRequireEmailVerification] = useState(initialData?.requireEmailVerification ?? false);
  const [enable2FA, setEnable2FA] = useState(initialData?.enable2FA ?? false);
  const [require2FA, setRequire2FA] = useState(initialData?.require2FA ?? false);
  const [sessionDays, setSessionDays] = useState(initialData?.sessionDays ?? 30);
  const [providers, setProviders] = useState(initialData?.providers ?? {
    google: false,
    github: false,
    microsoft: false,
    magicLink: false,
    credentials: true,
  });
  const [showDomainInput, setShowDomainInput] = useState(false);

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

  const updateProvider = (key: keyof typeof providers, value: boolean | string) => {
    setProviders((prev) => ({ ...prev, [key]: value }));
  };

  const sessionOptions = [
    { value: 1, label: "1 day" },
    { value: 7, label: "7 days" },
    { value: 30, label: "30 days" },
    { value: 365, label: "1 year" },
  ];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Auth & Security</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Configure user registration, authentication methods, and security settings.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="checkbox" checked={allowRegistration} onChange={(e) => setAllowRegistration(e.target.checked)} id="allowReg" />
          <label htmlFor="allowReg" style={{ fontSize: 15, cursor: "pointer" }}>Allow public registration</label>
        </div>

        {allowRegistration && (
          <div style={{ paddingLeft: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={showDomainInput} onChange={(e) => setShowDomainInput(e.target.checked)} />
              <span style={{ fontSize: 14 }}>Restrict to specific email domains</span>
            </label>
            {showDomainInput && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDomain())} placeholder="example.com" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={addDomain} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}>Add</button>
                </div>
                {allowedDomains.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {allowedDomains.map((d) => (
                      <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#eef2ff", borderRadius: 16, fontSize: 13 }}>
                        {d}
                        <button onClick={() => removeDomain(d)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <input type="checkbox" checked={requireEmailVerification} onChange={(e) => setRequireEmailVerification(e.target.checked)} />
              <span style={{ fontSize: 14 }}>Require email verification</span>
            </label>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="checkbox" checked={enable2FA} onChange={(e) => setEnable2FA(e.target.checked)} id="enable2fa" />
          <label htmlFor="enable2fa" style={{ fontSize: 15, cursor: "pointer" }}>Enable 2FA</label>
        </div>

        {enable2FA && (
          <div style={{ paddingLeft: 24 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={require2FA} onChange={(e) => setRequire2FA(e.target.checked)} />
              <span style={{ fontSize: 14 }}>Require 2FA for all users</span>
            </label>
          </div>
        )}

        <div>
          <label style={labelStyle}>Session Duration</label>
          <select value={sessionDays} onChange={(e) => setSessionDays(parseInt(e.target.value))} style={inputStyle}>
            {sessionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, margin: 0 }}>
          <legend style={{ fontWeight: 600, padding: "0 8px", fontSize: 14 }}>OAuth Providers</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(["google", "github", "microsoft", "magicLink", "credentials"] as const).map((provider) => (
              <div key={provider} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <input
                  type="checkbox"
                  checked={Boolean(providers[provider])}
                  onChange={(e) => updateProvider(provider, e.target.checked)}
                  id={`provider-${provider}`}
                  style={{ marginTop: 4 }}
                />
                <div style={{ flex: 1 }}>
                  <label htmlFor={`provider-${provider}`} style={{ fontSize: 14, cursor: "pointer", fontWeight: 500 }}>
                    {provider === "google" ? "Google OAuth" : provider === "github" ? "GitHub OAuth" : provider === "microsoft" ? "Microsoft OAuth" : provider === "magicLink" ? "Magic Link Email" : "Credentials / Password Login"}
                  </label>
                  {providers[provider] && !["magicLink", "credentials"].includes(provider) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                      <input type="text" placeholder="Client ID" value={(providers as Record<string, string | boolean>)[`${provider}ClientId`] as string || ""} onChange={(e) => updateProvider(`${provider}ClientId` as keyof typeof providers, e.target.value)} style={inputStyle} />
                      <input type="password" placeholder="Client Secret" value={(providers as Record<string, string | boolean>)[`${provider}ClientSecret`] as string || ""} onChange={(e) => updateProvider(`${provider}ClientSecret` as keyof typeof providers, e.target.value)} style={inputStyle} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div style={{ padding: "12px 16px", background: "#fffbeb", border: "1px solid #fef08a", borderRadius: 8, fontSize: 13, color: "#92400e" }}>
          Client secrets are stored encrypted using AES-256-GCM.
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <button onClick={onBack} style={backButtonStyle}>Back</button>
        <button onClick={() => onNext({ allowRegistration, allowedDomains, requireEmailVerification, enable2FA, require2FA, sessionDays, providers: providers as AuthStepProps["onNext"] extends (data: infer T) => void ? T["providers"] : never })} style={primaryButtonStyle}>Continue</button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" };
const backButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontSize: 15 };
const primaryButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "none", background: "#4f46e5", color: "white", fontWeight: 500, fontSize: 15 };