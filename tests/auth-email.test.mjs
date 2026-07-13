import test from "node:test";
import assert from "node:assert/strict";

import { buildAuthRedirectUrl, getAppUrl } from "../src/lib/auth-helpers.ts";

test("auth email redirect points to the app callback route", () => {
  const redirectUrl = buildAuthRedirectUrl({ NEXT_PUBLIC_APP_URL: "https://www.secwyn.com" }, "/dashboard");

  assert.equal(redirectUrl, "https://www.secwyn.com/auth/callback?next=%2Fdashboard");
});

test("auth app url falls back to production domain", () => {
  assert.equal(getAppUrl({}), "https://www.secwyn.com");
});
