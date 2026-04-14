import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

type EmailCodeRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

type EmailCodeStore = Record<string, EmailCodeRecord>;

const codePath = path.join(process.cwd(), "data", "email-login-codes.json");

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function readStore(): Promise<EmailCodeStore> {
  try {
    const raw = await fs.readFile(codePath, "utf8");
    return JSON.parse(raw) as EmailCodeStore;
  } catch {
    return {};
  }
}

async function writeStore(store: EmailCodeStore) {
  await fs.mkdir(path.dirname(codePath), { recursive: true });
  await fs.writeFile(codePath, JSON.stringify(store, null, 2), "utf8");
}

export function generateEmailLoginCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function saveEmailLoginCode(email: string, code: string, ttlMs: number) {
  const store = await readStore();
  const key = email.trim().toLowerCase();
  store[key] = {
    codeHash: hashCode(code),
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
  };
  await writeStore(store);
}

export async function verifyEmailLoginCode(
  email: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const store = await readStore();
  const key = email.trim().toLowerCase();
  const record = store[key];

  if (!record) {
    return { ok: false, error: "Verification code expired. Request a new code." };
  }

  if (record.expiresAt < Date.now()) {
    delete store[key];
    await writeStore(store);
    return { ok: false, error: "Verification code expired. Request a new code." };
  }

  const codeHash = hashCode(code.trim());
  if (codeHash !== record.codeHash) {
    record.attempts += 1;
    if (record.attempts >= 5) {
      delete store[key];
    } else {
      store[key] = record;
    }
    await writeStore(store);
    return { ok: false, error: "Invalid verification code." };
  }

  delete store[key];
  await writeStore(store);
  return { ok: true };
}

