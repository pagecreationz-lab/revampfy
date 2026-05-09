import "server-only";
import crypto from "node:crypto";

function getSecret() {
  return process.env.AUTH_SECRET || "pcgs-demo-secret-change-in-production";
}

function deriveKey() {
  return crypto.createHash("sha256").update(getSecret()).digest();
}

export function encryptConfigValue(raw: string): string {
  const value = String(raw || "");
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const key = deriveKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptConfigValue(input: string): string {
  const value = String(input || "");
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) return value;
  const [, , ivText, tagText, dataText] = value.split(":");
  if (!ivText || !tagText || !dataText) return "";
  try {
    const iv = Buffer.from(ivText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    const data = Buffer.from(dataText, "base64url");
    const key = deriveKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
