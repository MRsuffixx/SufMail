"use client";

import { useState } from "react";

interface AppSettingsStepProps {
  onNext: (data: {
    name: string;
    url: string;
    tagline: string;
    logo: string;
    theme: {
      defaultMode: "light" | "dark" | "system";
      primaryColor: string;
      density: "compact" | "comfortable" | "spacious";
      mailListLayout: "default" | "preview" | "minimal" | "cards";
      animationsEnabled: boolean;
      sidebarPosition: "left" | "right";
    };
  }) => void;
  onBack: () => void;
  initialData?: AppSettingsStepProps["onNext"] extends (data: infer T) => void ? T : never;
}

export default function AppSettingsStep({
  onNext,
  onBack,
  initialData,
}: AppSettingsStepProps) {
  const [name, setName] = useState(initialData?.name ?? "MailForge");
  const [url, setUrl] = useState(initialData?.url ?? "https://");
  const [tagline, setTagline] = useState(initialData?.tagline ?? "");
  const [logo, setLogo] = useState(initialData?.logo ?? "");
  const [defaultMode, setDefaultMode] = useState<"light" | "dark" | "system">(
    initialData?.theme?.defaultMode ?? "system"
  );
  const [primaryColor, setPrimaryColor] = useState(
    initialData?.theme?.primaryColor ?? "#4f46e5"
  );
  const [density, setDensity] = useState<"compact" | "comfortable" | "spacious">(
    initialData?.theme?.density ?? "comfortable"
  );
  const [mailListLayout, setMailListLayout] = useState<
    "default" | "preview" | "minimal" | "cards"
  >(initialData?.theme?.mailListLayout ?? "default");
  const [animationsEnabled, setAnimationsEnabled] = useState(
    initialData?.theme?.animationsEnabled ?? true
  );
  const [sidebarPosition, setSidebarPosition] = useState<"left" | "right">(
    initialData?.theme?.sidebarPosition ?? "left"
  );
  const [urlError, setUrlError] = useState("");

  const validateUrl = (value: string) => {
    try {
      new URL(value);
      setUrlError("");
      return true;
    } catch {
      setUrlError("Please enter a valid URL");
      return false;
    }
  };

  const handleNext = () => {
    if (!validateUrl(url)) return;
    onNext({
      name,
      url,
      tagline,
      logo,
      theme: {
        defaultMode,
        primaryColor,
        density,
        mailListLayout,
        animationsEnabled,
        sidebarPosition,
      },
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Application Settings</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Customize your MailForge instance appearance and behavior.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>App Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>App URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => validateUrl(url)}
            placeholder="https://mail.yourdomain.com"
            style={{ ...inputStyle, borderColor: urlError ? "#ef4444" : undefined }}
          />
          {urlError && <span style={{ color: "#ef4444", fontSize: 12 }}>{urlError}</span>}
        </div>

        <div>
          <label style={labelStyle}>Tagline (optional)</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            style={inputStyle}
            placeholder="A powerful, open-source webmail client"
          />
        </div>

        <div>
          <label style={labelStyle}>Logo URL (optional)</label>
          <input
            type="text"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            style={inputStyle}
            placeholder="/logo.svg"
          />
          {logo && (
            <div style={{ marginTop: 8, padding: 12, background: "#f8fafc", borderRadius: 8, display: "inline-block" }}>
              <img src={logo} alt="Logo preview" style={{ maxHeight: 40 }} onError={(e) => (e.currentTarget.style.display = "none")} />
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Default Theme</label>
          <select value={defaultMode} onChange={(e) => setDefaultMode(e.target.value as typeof defaultMode)} style={inputStyle}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Primary Color</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              style={{ width: 40, height: 36, padding: 2, borderRadius: 6, border: "1px solid #cbd5e1", cursor: "pointer" }}
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Interface Density</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["compact", "comfortable", "spacious"] as const).map((d) => (
              <label key={d} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderRadius: 6, border: `1px solid ${density === d ? "#4f46e5" : "#cbd5e1"}`, background: density === d ? "#eef2ff" : "white", cursor: "pointer", fontSize: 14 }}>
                <input type="radio" checked={density === d} onChange={() => setDensity(d)} style={{ display: "none" }} />
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Mail List Layout</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {(["default", "preview", "minimal", "cards"] as const).map((layout) => (
              <label key={layout} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", borderRadius: 6, border: `1px solid ${mailListLayout === layout ? "#4f46e5" : "#cbd5e1"}`, background: mailListLayout === layout ? "#eef2ff" : "white", cursor: "pointer", fontSize: 13 }}>
                <input type="radio" checked={mailListLayout === layout} onChange={() => setMailListLayout(layout)} style={{ display: "none" }} />
                {layout.charAt(0).toUpperCase() + layout.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input type="checkbox" checked={animationsEnabled} onChange={(e) => setAnimationsEnabled(e.target.checked)} id="animations" />
          <label htmlFor="animations" style={{ fontSize: 14, cursor: "pointer" }}>Enable animations</label>
        </div>

        <div>
          <label style={labelStyle}>Sidebar Position</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["left", "right"] as const).map((pos) => (
              <label key={pos} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 12px", borderRadius: 6, border: `1px solid ${sidebarPosition === pos ? "#4f46e5" : "#cbd5e1"}`, background: sidebarPosition === pos ? "#eef2ff" : "white", cursor: "pointer", fontSize: 14 }}>
                <input type="radio" checked={sidebarPosition === pos} onChange={() => setSidebarPosition(pos)} style={{ display: "none" }} />
                {pos.charAt(0).toUpperCase() + pos.slice(1)}
              </label>
            ))}
          </div>
        </div>
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
const backButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontSize: 15 };
const primaryButtonStyle: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "none", background: "#4f46e5", color: "white", fontWeight: 500, fontSize: 15 };