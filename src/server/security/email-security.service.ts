/**
 * MailForge — Email Security Service
 *
 * Parses email authentication headers (SPF/DKIM/DMARC) and performs
 * heuristic phishing detection on message content.
 */

import { JSDOM } from "jsdom";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthenticationResults {
  spf: "pass" | "fail" | "softfail" | "neutral" | "none" | "unknown";
  dkim: "pass" | "fail" | "none" | "unknown";
  dmarc: "pass" | "fail" | "none" | "unknown";
  rawHeader?: string;
}

export interface PhishingResult {
  score: number; // 0–100
  flags: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface UrlScanResult {
  url: string;
  domain: string;
  reputationScore: number;
  flags: string[];
}

export interface SecurityMeta {
  auth: AuthenticationResults;
  phishing: PhishingResult;
  urls: UrlScanResult[];
  analyzedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_DOMAINS = [
  "paypal.com", "apple.com", "google.com", "microsoft.com",
  "amazon.com", "netflix.com", "facebook.com", "instagram.com",
  "twitter.com", "x.com", "linkedin.com", "dropbox.com",
  "icloud.com", "outlook.com", "yahoo.com", "ebay.com",
  "bankofamerica.com", "wellsfargo.com", "chase.com", "citibank.com",
];

const SUSPICIOUS_TLDS = new Set([
  ".xyz", ".tk", ".ml", ".ga", ".cf", ".gq",
  ".top", ".work", ".click", ".pw", ".cc",
  ".download", ".loan", ".online", ".icu",
]);

const URGENT_KEYWORDS = [
  "verify your account", "verify now", "account suspended",
  "account will be closed", "unauthorized access", "confirm your identity",
  "click here immediately", "act now", "urgent action required",
  "your account has been compromised", "update your payment",
  "your card was declined", "won a prize", "you have been selected",
  "claim your reward", "limited time offer", "immediate response required",
];

const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "ow.ly", "goo.gl", "rb.gy", "is.gd",
]);

// ─── Email Security Service ───────────────────────────────────────────────────

export class EmailSecurityService {
  /**
   * Full security analysis pipeline for an email message.
   */
  static async analyzeMessage(params: {
    headers: Record<string, string>;
    subject: string;
    fromEmail: string;
    bodyHtml?: string;
    bodyText?: string;
  }): Promise<SecurityMeta> {
    const auth = EmailSecurityService.parseAuthHeaders(params.headers);
    const urls = EmailSecurityService.extractAndScanUrls(
      params.bodyHtml ?? "",
      params.bodyText ?? "",
    );
    const phishing = EmailSecurityService.scorePhishing({
      auth,
      subject: params.subject,
      fromEmail: params.fromEmail,
      bodyText: params.bodyText ?? "",
      urls,
    });

    return {
      auth,
      phishing,
      urls,
      analyzedAt: new Date().toISOString(),
    };
  }

  // ─── Authentication Header Parsing ────────────────────────────────────────

  /**
   * Parses SPF / DKIM / DMARC results from the Authentication-Results header.
   */
  static parseAuthHeaders(
    headers: Record<string, string>,
  ): AuthenticationResults {
    const authHeader =
      headers["authentication-results"] ??
      headers["Authentication-Results"] ??
      "";

    const extract = (protocol: string): string => {
      const re = new RegExp(`${protocol}=([a-z]+)`, "i");
      return re.exec(authHeader)?.[1]?.toLowerCase() ?? "none";
    };

    const toSpfResult = (
      val: string,
    ): AuthenticationResults["spf"] => {
      const valid = ["pass", "fail", "softfail", "neutral", "none"];
      return valid.includes(val)
        ? (val as AuthenticationResults["spf"])
        : "unknown";
    };

    const toDkimResult = (val: string): AuthenticationResults["dkim"] => {
      const valid = ["pass", "fail", "none"];
      return valid.includes(val)
        ? (val as AuthenticationResults["dkim"])
        : "unknown";
    };

    const toDmarcResult = (val: string): AuthenticationResults["dmarc"] => {
      const valid = ["pass", "fail", "none"];
      return valid.includes(val)
        ? (val as AuthenticationResults["dmarc"])
        : "unknown";
    };

    return {
      spf: toSpfResult(extract("spf")),
      dkim: toDkimResult(extract("dkim")),
      dmarc: toDmarcResult(extract("dmarc")),
      rawHeader: authHeader || undefined,
    };
  }

  // ─── URL Extraction & Scanning ────────────────────────────────────────────

  /**
   * Extracts all URLs from HTML and plain text, then scores each domain.
   */
  static extractAndScanUrls(
    bodyHtml: string,
    bodyText: string,
  ): UrlScanResult[] {
    const urls = new Set<string>();

    if (bodyHtml) {
      try {
        const dom = new JSDOM(bodyHtml);
        dom.window.document.querySelectorAll("a[href]").forEach((el) => {
          const href = el.getAttribute("href");
          if (href?.startsWith("http")) urls.add(href);
        });
      } catch {
        // Malformed HTML — skip
      }
    }

    const urlRe = /https?:\/\/[^\s"'<>()]+/gi;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(bodyText)) !== null) {
      if (m[0]) urls.add(m[0]);
    }

    const results: UrlScanResult[] = [];
    for (const url of urls) {
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname.toLowerCase();
        results.push(EmailSecurityService.scoreDomain(url, domain));
      } catch {
        // Invalid URL
      }
    }
    return results;
  }

  /**
   * Scores a domain's reputation using local heuristic rules.
   */
  static scoreDomain(url: string, domain: string): UrlScanResult {
    const flags: string[] = [];
    let score = 0;

    // Suspicious TLD
    const tldMatch = /\.[a-z]{2,}$/.exec(domain);
    if (tldMatch?.[0] && SUSPICIOUS_TLDS.has(tldMatch[0])) {
      score += 30;
      flags.push(`suspicious_tld:${tldMatch[0]}`);
    }

    // Lookalike domain
    for (const brand of BRAND_DOMAINS) {
      const brandRoot = brand.split(".")[0]!;
      if (domain !== brand && domain.includes(brandRoot)) {
        score += 40;
        flags.push(`lookalike_domain:${brand}`);
        break;
      }
      const domainRoot = domain.replace(/\..+$/, "");
      if (
        domainRoot !== brandRoot &&
        levenshtein(domainRoot, brandRoot) <= 2 &&
        domain !== brand
      ) {
        score += 35;
        flags.push(`typosquat_domain:${brand}`);
        break;
      }
    }

    // IP address as domain
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
      score += 25;
      flags.push("ip_address_url");
    }

    // Excessive subdomains
    if (domain.split(".").length > 4) {
      score += 15;
      flags.push("excessive_subdomains");
    }

    // URL shorteners
    if (URL_SHORTENERS.has(domain)) {
      score += 10;
      flags.push("url_shortener");
    }

    return {
      url,
      domain,
      reputationScore: Math.min(score, 100),
      flags,
    };
  }

  // ─── Phishing Score ───────────────────────────────────────────────────────

  /**
   * Composite phishing score from auth results, content heuristics, and URL analysis.
   */
  static scorePhishing(params: {
    auth: AuthenticationResults;
    subject: string;
    fromEmail: string;
    bodyText: string;
    urls: UrlScanResult[];
  }): PhishingResult {
    const flags: string[] = [];
    let score = 0;

    // Authentication failures
    if (params.auth.spf === "fail") { score += 20; flags.push("spf_fail"); }
    if (params.auth.spf === "softfail") { score += 10; flags.push("spf_softfail"); }
    if (params.auth.dkim === "fail") { score += 25; flags.push("dkim_fail"); }
    if (params.auth.dmarc === "fail") { score += 30; flags.push("dmarc_fail"); }

    // Urgent keywords in subject or body
    const lowerBody = params.bodyText.toLowerCase();
    const lowerSubject = params.subject.toLowerCase();
    for (const kw of URGENT_KEYWORDS) {
      if (lowerBody.includes(kw) || lowerSubject.includes(kw)) {
        score += 10;
        flags.push(`urgent_keyword:${kw.replace(/\s+/g, "_").slice(0, 30)}`);
      }
    }

    // High-risk URLs
    const highRiskUrls = params.urls.filter((u) => u.reputationScore >= 30);
    if (highRiskUrls.length > 0) {
      score += Math.min(highRiskUrls.length * 15, 40);
      flags.push(`high_risk_urls:${highRiskUrls.length}`);
    }

    // URL domain mismatch vs sender domain
    const senderDomain = params.fromEmail.split("@")[1]?.toLowerCase() ?? "";
    for (const urlResult of params.urls) {
      if (
        senderDomain &&
        urlResult.domain !== senderDomain &&
        !urlResult.domain.endsWith(`.${senderDomain}`)
      ) {
        score += 5;
        if (!flags.includes("url_domain_mismatch")) {
          flags.push("url_domain_mismatch");
        }
      }
    }

    const capped = Math.min(score, 100);
    const riskLevel: PhishingResult["riskLevel"] =
      capped >= 70 ? "critical"
      : capped >= 50 ? "high"
      : capped >= 25 ? "medium"
      : "low";

    return { score: capped, flags: [...new Set(flags)], riskLevel };
  }
}

// ─── Levenshtein Distance ─────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}
