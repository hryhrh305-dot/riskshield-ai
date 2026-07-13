import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDir).find((name) => name.endsWith("_initialize_new_free_account_credits.sql"));
const migrationPath = migrationName ? join(migrationsDir, migrationName) : "";
const migration = migrationPath && existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("new account free credit initialization", () => {
  it("atomically grants the first free cycle whenever a free profile is created", () => {
    expect(migrationName).toBeTruthy();
    expect(migration).toContain("create or replace function public.initialize_new_free_credit_cycle()");
    expect(migration).toContain("after insert on public.profiles");
    expect(migration).toContain("public.grant_free_cycle_credits(");
    expect(migration).toContain("public.credit_cycle_boundary(");
    expect(migration).toContain("revoke all on function public.handle_new_user() from public, anon, authenticated;");
  });

  it("repairs existing free profiles missing their current cycle without incrementing the mirror directly", () => {
    expect(migration).toContain("for profile_row in");
    expect(migration).toContain("source_type='free_cycle'");
    expect(migration).toContain("raise exception 'FREE_PROFILE_CREDIT_GRANT_MISSING'");
    expect(migration).not.toContain("credits_remaining + 50");
    expect(migration).not.toContain("credits_remaining=credits_remaining+50");
  });
});
