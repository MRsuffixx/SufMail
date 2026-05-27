import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());

describe("Install API Routes", () => {
  describe("GET /api/install/system-check", () => {
    it("returns array of check results", async () => {
      const res = await fetch("http://localhost:3000/api/install/system-check");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      data.forEach((item: { check: string; status: string; message: string }) => {
        expect(item).toHaveProperty("check");
        expect(item).toHaveProperty("status");
        expect(item).toHaveProperty("message");
        expect(["pass", "fail", "warn"]).toContain(item.status);
      });
    });
  });

  describe("POST /api/install/test-db", () => {
    it("rejects missing connection string", async () => {
      const res = await fetch("http://localhost:3000/api/install/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    it("rejects invalid connection string", async () => {
      const res = await fetch("http://localhost:3000/api/install/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: "postgresql://invalid:invalid@localhost:9999/nonexistent" }),
      });
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/install/test-imap", () => {
    it("rejects missing fields", async () => {
      const res = await fetch("http://localhost:3000/api/install/test-imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe("POST /api/install/test-smtp", () => {
    it("rejects missing fields", async () => {
      const res = await fetch("http://localhost:3000/api/install/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });
});