"use client";

import { useState } from "react";

interface DatabaseStepProps {
  onNext: (data: { connectionString: string; useDocker: boolean }) => void;
  onBack: () => void;
  initialData?: { connectionString: string; useDocker: boolean };
}

export default function DatabaseStep({
  onNext,
  onBack,
  initialData,
}: DatabaseStepProps) {
  const [useDocker, setUseDocker] = useState(initialData?.useDocker ?? true);
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("mailforge");
  const [user, setUser] = useState("postgres");
  const [password, setPassword] = useState("");
  const [useSsl, setUseSsl] = useState(false);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const connectionString =
    useDocker
      ? `postgresql://${user}:${password}@postgres:5432/${database}`
      : `postgresql://${user}:${password}@${host}:${port}/${database}${useSsl ? "?sslmode=require" : ""}`;

  const testConnection = async () => {
    setTestStatus("testing");
    setTestMessage("");
    try {
      const res = await fetch("/api/install/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus("success");
        setLatencyMs(data.latencyMs);
        setTestMessage(`Connected successfully (${data.latencyMs}ms)`);
      } else {
        setTestStatus("error");
        setTestMessage(data.error ?? "Connection failed");
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Network error");
    }
  };

  const handleNext = () => {
    onNext({ connectionString, useDocker });
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Database</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Configure your PostgreSQL database connection.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="radio"
            name="dbType"
            checked={useDocker}
            onChange={() => setUseDocker(true)}
          />
          <span>Use bundled PostgreSQL (Docker)</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="radio"
            name="dbType"
            checked={!useDocker}
            onChange={() => setUseDocker(false)}
          />
          <span>Use external database</span>
        </label>

        {!useDocker && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>
                Host
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>
                Port
              </label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>
                Database
              </label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>
                User
              </label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        {!useDocker && (
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={useSsl}
              onChange={(e) => setUseSsl(e.target.checked)}
            />
            <span style={{ fontSize: 14 }}>Use SSL connection</span>
          </label>
        )}

        <div>
          <label style={{ fontSize: 13, color: "#64748b", display: "block", marginBottom: 4 }}>
            Connection String
          </label>
          <input
            type="text"
            value={connectionString}
            readOnly
            style={{ ...inputStyle, background: "#f1f5f9", color: "#64748b" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={testConnection}
            disabled={testStatus === "testing"}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "white",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {testStatus === "testing" ? "Testing..." : "Test Connection"}
          </button>
          {testStatus !== "idle" && (
            <span
              style={{
                color: testStatus === "success" ? "#22c55e" : "#ef4444",
                fontSize: 14,
              }}
            >
              {testMessage}
            </span>
          )}
        </div>

        {testStatus === "success" && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              fontSize: 13,
              color: "#166534",
            }}
          >
            Schema will be migrated automatically on finish.
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
        <button onClick={onBack} style={backButtonStyle}>
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!password}
          style={{
            ...primaryButtonStyle,
            opacity: !password ? 0.5 : 1,
            cursor: !password ? "not-allowed" : "pointer",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  boxSizing: "border-box",
};

const backButtonStyle: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  fontSize: 15,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  background: "#4f46e5",
  color: "white",
  fontWeight: 500,
  fontSize: 15,
};