import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

type ResetCodeRecord = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
};

type ResetCodeStore = Record<string, ResetCodeRecord>;

const resetCodePath = path.join(process.cwd(), "data", "password-reset-codes.json");

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function readStore(): Promise<ResetCodeStore> {
  try {
    const raw = await fs.readFile(resetCodePath, "utf8");
    return JSON.parse(raw) as ResetCodeStore;
  } catch {
    return {};
  }
}

async function writeStore(store: ResetCodeStore) {
  await fs.mkdir(path.dirname(resetCodePath), { recursive: true });
  await fs.writeFile(resetCodePath, JSON.stringify(store, null, 2), "utf8");
}

export function generatePasswordResetCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function savePasswordResetCode(email: string, code: string, ttlMs: number) {
  const store = await readStore();
  const key = email.trim().toLowerCase();
  store[key] = {
    codeHash: hashCode(code),
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
  };
  await writeStore(store);
}

export async function verifyPasswordResetCode(
  email: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const store = await readStore();
  const key = email.trim().toLowerCase();
  const record = store[key];

  if (!record) {
    return { ok: false, error: "Reset code expired. Request a new code." };
  }
  if (record.expiresAt < Date.now()) {
    delete store[key];
    await writeStore(store);
    return { ok: false, error: "Reset code expired. Request a new code." };
  }

  const codeHash = hashCode(code.trim());
  if (record.codeHash !== codeHash) {
    record.attempts += 1;
    if (record.attempts >= 5) delete store[key];
    else store[key] = record;
    await writeStore(store);
    return { ok: false, error: "Invalid reset code." };
  }

  delete store[key];
  await writeStore(store);
  return { ok: true };
}

