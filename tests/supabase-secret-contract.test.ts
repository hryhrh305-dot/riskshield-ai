import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("Supabase secret-key contract", () => {
  it("uses the new server-only secret variable in the privileged adapter", () => {
    const admin = readFileSync(resolve(process.cwd(), "src/lib/supabase/admin.ts"), "utf8");
    expect(admin).toContain('import "server-only"');
    expect(admin).toContain("process.env.SUPABASE_SECRET_KEY");
    expect(admin).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not retain a secret-key literal in current application source", () => {
    const source = sourceFiles(resolve(process.cwd(), "src"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(source).not.toMatch(/sb_secret_[A-Za-z0-9._-]+/);
  });
});
