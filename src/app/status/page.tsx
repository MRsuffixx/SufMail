"use client";

import { useState, useEffect } from "react";

interface HealthData {
  status: "ok" | "degraded" | "down";
  version: string;
  installed: boolean;
  services: {
    database: { status: "ok" | "error"; latencyMs: number };
    redis: { status: "ok" | "error"; latencyMs: number };
    queue: { status: "ok" | "error"; pendingJobs: number };
  };
  uptime: number;
  timestamp: string;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error("Failed");
        setHealth(await res.json());
        setError(false);
      } catch {
        setError(true);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    if (status === "ok") return "#22c55e";
    if (status === "degraded") return "#eab308";
    return "#ef4444";
  };

  const getStatusText = (status: string) => {
    if (status === "ok") return "Healthy";
    if (status === "degraded") return "Degraded";
    return "Down";
  };

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>MailForge Status</h1>
          <p style={{ color: "#64748b" }}>System health and service status</p>
        </div>

        {error ? (
          <div style={{ textAlign: "center", padding: 40, background: "white", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Cannot reach health endpoint</h2>
            <p style={{ color: "#64748b" }}>The server may be down or unreachable.</p>
          </div>
        ) : health ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Overall Status</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 24 }}>{health.status === "ok" ? "✅" : health.status === "degraded" ? "⚠️" : "❌"}</span>
                    <span style={{ fontSize: 20, fontWeight: 600, color: getStatusColor(health.status) }}>{getStatusText(health.status)}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: "#64748b" }}>Version</div>
                  <div style={{ fontWeight: 600 }}>{health.version}</div>
                </div>
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
              <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Services</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    { name: "Database", key: "database" as const },
                    { name: "Redis", key: "redis" as const },
                    { name: "Queue Worker", key: "queue" as const },
                  ].map(({ name, key }) => (
                    <tr key={key} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 0", fontSize: 15 }}>{name}</td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: getStatusColor(health.services[key].status), display: "inline-block" }} />
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{getStatusText(health.services[key].status)}</span>
                          {health.services[key].status === "ok" && (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>({health.services[key].latencyMs}ms)</span>
                          )}
                          {key === "queue" && health.services[key].status === "ok" && (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>({health.services[key].pendingJobs} pending)</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
              <h3 style={{ fontWeight: 600, marginBottom: 16 }}>System</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase" }}>Uptime</div>
                  <div style={{ fontWeight: 500, fontSize: 15, marginTop: 2 }}>{formatUptime(health.uptime)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase" }}>Installed</div>
                  <div style={{ fontWeight: 500, fontSize: 15, marginTop: 2 }}>{health.installed ? "Yes" : "No"}</div>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase" }}>Last Check</div>
                  <div style={{ fontWeight: 500, fontSize: 15, marginTop: 2 }}>{new Date(health.timestamp).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
              Auto-refreshes every 10 seconds
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div>Loading...</div>
          </div>
        )}
      </div>
    </div>
  );
}