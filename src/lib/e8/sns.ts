import { createPublicKey, verify } from "node:crypto";

export type SnsEnvelope = {
  type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  messageId: string;
  topicArn: string;
  message: string;
  timestamp: string;
  signature: string;
  signingCertUrl: string;
  subject?: string;
  token?: string;
  subscribeUrl?: string;
};

const MAX_SNS_FIELD = 1_000_000;
const cache = new Map<string, { pem: string; expires: number }>();

export function isTrustedSnsCertUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" &&
      /^sns(?:\.[a-z0-9-]+)?\.amazonaws\.com(?:\.cn)?$/i.test(url.hostname) &&
      /^\/SimpleNotificationService-[A-Za-z0-9_-]+\.pem$/.test(url.pathname) &&
      !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

export function validateSnsEnvelope(input: unknown, allowedTopics: string[]): SnsEnvelope | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (!["Notification", "SubscriptionConfirmation", "UnsubscribeConfirmation"].includes(String(value.Type))) return null;
  const required = ["MessageId", "TopicArn", "Message", "Timestamp", "Signature", "SigningCertURL"];
  if (required.some((key) => typeof value[key] !== "string" || !(value[key] as string).length || (value[key] as string).length > MAX_SNS_FIELD)) return null;
  if (value.SignatureVersion !== "2") return null;
  if (!allowedTopics.includes(value.TopicArn as string)) return null;
  if (!isTrustedSnsCertUrl(value.SigningCertURL as string)) return null;
  const timestampMs = Date.parse(value.Timestamp as string);
  if (Number.isNaN(timestampMs) || timestampMs > Date.now() + 5 * 60 * 1000) return null;
  if (value.Type === "SubscriptionConfirmation" && timestampMs < Date.now() - 60 * 60 * 1000) return null;
  return {
    type: value.Type as SnsEnvelope["type"], messageId: value.MessageId as string,
    topicArn: value.TopicArn as string, message: value.Message as string, timestamp: value.Timestamp as string,
    signature: value.Signature as string, signingCertUrl: value.SigningCertURL as string,
    subject: typeof value.Subject === "string" ? value.Subject : undefined,
    token: typeof value.Token === "string" ? value.Token : undefined,
    subscribeUrl: typeof value.SubscribeURL === "string" ? value.SubscribeURL : undefined,
  };
}

export function snsCanonicalString(envelope: SnsEnvelope) {
  const lines: string[] = [];
  const fields = envelope.type === "Notification"
    ? [["Message", envelope.message], ["MessageId", envelope.messageId], ...(envelope.subject ? [["Subject", envelope.subject]] : []), ["Timestamp", envelope.timestamp], ["TopicArn", envelope.topicArn], ["Type", envelope.type]]
    : [["Message", envelope.message], ["MessageId", envelope.messageId], ["SubscribeURL", envelope.subscribeUrl || ""], ["Timestamp", envelope.timestamp], ["Token", envelope.token || ""], ["TopicArn", envelope.topicArn], ["Type", envelope.type]];
  for (const [name, value] of fields) lines.push(name, value);
  return `${lines.join("\n")}\n`;
}

export function verifySnsSignatureWithPem(envelope: SnsEnvelope, pem: string) {
  try {
    return verify("RSA-SHA256", Buffer.from(snsCanonicalString(envelope)), createPublicKey(pem), Buffer.from(envelope.signature, "base64"));
  } catch {
    return false;
  }
}

async function getCertificate(url: string) {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.pem;
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("SNS_CERT_UNAVAILABLE");
  const pem = await response.text();
  if (pem.length > 64_000 || !pem.includes("BEGIN CERTIFICATE")) throw new Error("SNS_CERT_INVALID");
  cache.set(url, { pem, expires: Date.now() + 60 * 60 * 1000 });
  return pem;
}

export async function verifySnsSignature(envelope: SnsEnvelope) {
  try {
    const pem = await getCertificate(envelope.signingCertUrl);
    return verifySnsSignatureWithPem(envelope, pem);
  } catch {
    return false;
  }
}
