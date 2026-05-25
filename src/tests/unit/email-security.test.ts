/**
 * Unit tests for EmailSecurityService.
 */

import { describe, it, expect } from "vitest";
import { EmailSecurityService } from "~/server/security/email-security.service";

describe("EmailSecurityService.parseAuthHeaders", () => {
  it("parses SPF pass", () => {
    const result = EmailSecurityService.parseAuthHeaders({
      "authentication-results": "mx.example.com; spf=pass",
    });
    expect(result.spf).toBe("pass");
  });

  it("parses DKIM fail", () => {
    const result = EmailSecurityService.parseAuthHeaders({
      "authentication-results": "mx.example.com; dkim=fail",
    });
    expect(result.dkim).toBe("fail");
  });

  it("parses DMARC pass", () => {
    const result = EmailSecurityService.parseAuthHeaders({
      "authentication-results": "mx.example.com; dmarc=pass",
    });
    expect(result.dmarc).toBe("pass");
  });

  it("returns none for missing headers", () => {
    const result = EmailSecurityService.parseAuthHeaders({});
    expect(result.spf).toBe("none");
    expect(result.dkim).toBe("none");
    expect(result.dmarc).toBe("none");
  });

  it("parses all three from single header", () => {
    const result = EmailSecurityService.parseAuthHeaders({
      "authentication-results":
        "mx.google.com; spf=pass; dkim=pass; dmarc=fail",
    });
    expect(result.spf).toBe("pass");
    expect(result.dkim).toBe("pass");
    expect(result.dmarc).toBe("fail");
  });
});

describe("EmailSecurityService.scorePhishing", () => {
  const baseAuth = {
    spf: "pass" as const,
    dkim: "pass" as const,
    dmarc: "pass" as const,
  };

  it("returns low risk for clean email", () => {
    const result = EmailSecurityService.scorePhishing({
      auth: baseAuth,
      subject: "Hey there",
      fromEmail: "alice@example.com",
      bodyText: "Just checking in.",
      urls: [],
    });
    expect(result.riskLevel).toBe("low");
    expect(result.score).toBeLessThan(25);
  });

  it("increments score for SPF fail", () => {
    const result = EmailSecurityService.scorePhishing({
      auth: { ...baseAuth, spf: "fail" },
      subject: "Hey",
      fromEmail: "x@y.com",
      bodyText: "Normal email",
      urls: [],
    });
    expect(result.flags).toContain("spf_fail");
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it("increments score for DMARC fail", () => {
    const result = EmailSecurityService.scorePhishing({
      auth: { ...baseAuth, dmarc: "fail" },
      subject: "Hey",
      fromEmail: "x@y.com",
      bodyText: "Normal email",
      urls: [],
    });
    expect(result.flags).toContain("dmarc_fail");
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it("detects urgent keywords", () => {
    const result = EmailSecurityService.scorePhishing({
      auth: baseAuth,
      subject: "URGENT action required",
      fromEmail: "x@y.com",
      bodyText: "Your account has been compromised. Act now.",
      urls: [],
    });
    expect(result.flags.some((f) => f.startsWith("urgent_keyword:"))).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it("returns critical for multiple auth fails + urgent keywords", () => {
    const result = EmailSecurityService.scorePhishing({
      auth: { spf: "fail", dkim: "fail", dmarc: "fail" },
      subject: "Verify your account immediately",
      fromEmail: "x@y.com",
      bodyText: "act now or account will be closed verify now",
      urls: [],
    });
    expect(result.riskLevel).toMatch(/high|critical/);
  });
});

describe("EmailSecurityService.scoreDomain", () => {
  it("flags suspicious TLD", () => {
    const result = EmailSecurityService.scoreDomain(
      "http://example.xyz/phish",
      "example.xyz",
    );
    expect(result.flags.some((f) => f.startsWith("suspicious_tld"))).toBe(true);
  });

  it("flags IP address as domain", () => {
    const result = EmailSecurityService.scoreDomain(
      "http://192.168.1.1/login",
      "192.168.1.1",
    );
    expect(result.flags).toContain("ip_address_url");
  });

  it("flags lookalike domain", () => {
    const result = EmailSecurityService.scoreDomain(
      "http://paypa1.com/login",
      "paypa1.com",
    );
    // Either lookalike or typosquat flag should be present
    expect(
      result.flags.some(
        (f) => f.includes("lookalike_domain") || f.includes("typosquat_domain"),
      ),
    ).toBe(true);
  });

  it("clean domain gets low score", () => {
    const result = EmailSecurityService.scoreDomain(
      "https://google.com/search",
      "google.com",
    );
    expect(result.reputationScore).toBeLessThan(10);
  });
});
