export const roleBasedPrefixes = new Set([
  "admin", "abuse", "billing", "careers", "compliance", "contact", "hello", "help", "hr", "info", "jobs", "legal",
  "marketing", "media", "noreply", "no-reply", "operations", "ops", "postmaster", "press", "privacy", "sales", "security", "support",
  "nobody", "team", "service", "office", "webmaster", "root", "hostmaster", "usenet", "news", "ftp", "www",
]);

export function canonicalRoleLocalPart(emailOrLocalPart: string): string {
  const localPart = emailOrLocalPart.includes("@") ? emailOrLocalPart.slice(0, emailOrLocalPart.lastIndexOf("@")) : emailOrLocalPart;
  return localPart.trim().toLowerCase().split("+")[0];
}

export function isRoleBasedEmail(emailOrLocalPart: string): boolean {
  return roleBasedPrefixes.has(canonicalRoleLocalPart(emailOrLocalPart));
}
