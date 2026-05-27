"use client";

import { useState, useEffect } from "react";
import type { SystemCheckResult } from "~/types/install";

interface SystemCheckProps {
  onNext: (data: { passed: boolean }) => void;
}

export default function SystemCheck({ onNext }: SystemCheckProps) {
  const [checks, setChecks] = useState<SystemCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    fetch("/api/install/system-check")
      .then((res) => res.json())
      .then((data: SystemCheckResult[]) => {
        setChecks(data);
        setCanContinue(data.every((c) => c.status !== "fail"));
      })
      .catch(() => {
        setChecks([
          {
            check: "Network",
            status: "fail",
            message: "Could not reach system check endpoint",
          },
        ]);
        setCanContinue(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const getIcon = (status: SystemCheckResult["status"]) => {
    if (status === "pass") return "✅";
    if (status === "warn") return "⚠️";
    return "❌";
  };

  const getColor = (status: SystemCheckResult["status"]) => {
    if (status === "pass") return "#22c55e";
    if (status === "warn") return "#eab308";
    return "#ef4444";
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>System Check</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Verifying your environment is ready for MailForge.
      </p>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 18 }}>Running checks...</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {checks.map((check, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 16,
                borderRadius: 8,
                border: `1px solid ${getColor(check.status)}22`,
                background: `${getColor(check.status)}08`,
              }}
            >
              <span style={{ fontSize: 20 }}>{getIcon(check.status)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{check.check}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{check.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onNext({ passed: canContinue })}
          disabled={loading || !canContinue}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: canContinue && !loading ? "#4f46e5" : "#94a3b8",
            color: "white",
            fontWeight: 500,
            cursor: canContinue && !loading ? "pointer" : "not-allowed",
            fontSize: 15,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}