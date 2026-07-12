import { describe, expect, it } from "vitest";
import { buildAuthRedirectUrl, getAppUrl } from "@/lib/auth-helpers";

describe("auth redirect URLs", () => {
  it("falls back to the Secwyn production origin when no app URL is configured", () => {
    expect(getAppUrl({} as NodeJS.ProcessEnv)).toBe("https://www.secwyn.com");
    expect(buildAuthRedirectUrl({} as NodeJS.ProcessEnv, "/reset-password")).toBe(
      "https://www.secwyn.com/auth/callback?next=%2Freset-password"
    );
  });

  it("uses an explicitly configured app origin", () => {
    expect(buildAuthRedirectUrl({ NEXT_PUBLIC_APP_URL: "https://preview.example.com" } as NodeJS.ProcessEnv, "/reset-password")).toBe(
      "https://preview.example.com/auth/callback?next=%2Freset-password"
    );
  });
});
