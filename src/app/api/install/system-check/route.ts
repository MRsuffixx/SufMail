import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import os from "os";
import type { SystemCheckResult } from "~/types/install";

export async function GET() {
  const results: SystemCheckResult[] = [];

  try {
    const nodeVersion = parseInt(process.version.slice(1).split(".")[0], 10);
    results.push({
      check: "Node.js version",
      status: nodeVersion >= 18 ? "pass" : "fail",
      message: `Node.js ${process.version} (${nodeVersion >= 18 ? "OK" : "need >= 18"})`,
    });
  } catch {
    results.push({ check: "Node.js version", status: "fail", message: "Could not determine Node.js version" });
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memMB = Math.round(usedMem / 1024 / 1024);
  const memStatus = memMB >= 512 ? "pass" : "warn";
  results.push({
    check: "Available memory",
    status: memStatus,
    message: `${memMB}MB in use (${memStatus === "pass" ? "OK" : "warn, need >= 512MB"})`,
  });

  try {
    const testFile = process.cwd() + "/test_write_permission.txt";
    writeFileSync(testFile, "test");
    const { existsSync: fsExists, unlinkSync } = await import("fs");
    if (fsExists(testFile)) unlinkSync(testFile);
    results.push({ check: "Write permission", status: "pass", message: "Project root is writable" });
  } catch {
    results.push({ check: "Write permission", status: "fail", message: "Cannot write to project root" });
  }

  if (process.env.DATABASE_URL) {
    results.push({ check: "DATABASE_URL", status: "pass", message: "Environment variable is set" });
  } else {
    results.push({ check: "DATABASE_URL", status: "warn", message: "Not set — will be configured during install" });
  }

  return NextResponse.json(results);
}