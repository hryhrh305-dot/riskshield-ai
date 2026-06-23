import test from "node:test";
import assert from "node:assert/strict";

import {
  extractAccessTokenFromCookieValue,
  readAuthCookieValue,
} from "../src/lib/auth-cookie.ts";

test("extractAccessTokenFromCookieValue decodes base64 JSON cookie payloads", () => {
  const payload = {
    access_token: "access-token-123",
    refresh_token: "refresh-token-456",
  };
  const raw = "base64-" + Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

  assert.equal(extractAccessTokenFromCookieValue(raw), "access-token-123");
});

test("extractAccessTokenFromCookieValue reads legacy JSON array cookies", () => {
  const raw = JSON.stringify(["legacy-access-token", "legacy-refresh-token"]);

  assert.equal(extractAccessTokenFromCookieValue(raw), "legacy-access-token");
});

test("readAuthCookieValue rejoins chunked auth cookies", () => {
  const cookies = {
    "sb-project-auth-token.0": "part-0",
    "sb-project-auth-token.1": "part-1",
    "sb-project-auth-token.2": "part-2",
  };

  assert.equal(readAuthCookieValue(cookies, "sb-project-auth-token"), "part-0part-1part-2");
});
