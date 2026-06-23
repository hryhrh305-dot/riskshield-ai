import test from "node:test";
import assert from "node:assert/strict";

import { buildAuthRedirectUrl, getAppUrl } from "../src/lib/auth-helpers.ts";

test("auth email redirect points to the app callback route", () => {
  const redirectUrl = buildAuthRedirectUrl({ NEXT_PUBLIC_APP_URL: "https://www.574269.xyz" }, "/dashboard");

  assert.equal(redirectUrl, "https://www.574269.xyz/auth/callback?next=%2Fdashboard");
});

test("auth app url falls back to production domain", () => {
  assert.equal(getAppUrl({}), "https://www.574269.xyz");
});
