import { createHmac } from "node:crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hmacIdentity(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function hashEmail(email: string, secret: string) {
  return hmacIdentity(normalizeEmail(email), secret);
}
