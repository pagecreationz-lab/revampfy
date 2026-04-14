import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

type OAuthStateRecord = {
  state: string;
  storeDomain: string;
  apiVersion: string;
  createdAt: number;
};

const statePath = path.join(process.cwd(), "data", "shopify-oauth-state.json");
const TTL_MS = 10 * 60 * 1000;

export async function createOAuthState(storeDomain: string, apiVersion: string): Promise<string> {
  const state = crypto.randomBytes(24).toString("hex");
  const record: OAuthStateRecord = {
    state,
    storeDomain,
    apiVersion,
    createdAt: Date.now(),
  };

  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(record, null, 2), "utf8");
  return state;
}

export async function consumeOAuthState(state: string): Promise<{ storeDomain: string; apiVersion: string } | null> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const record = JSON.parse(raw) as OAuthStateRecord;

    if (!record || record.state !== state) return null;
    if (Date.now() - record.createdAt > TTL_MS) return null;

    await fs.unlink(statePath).catch(() => undefined);
    return {
      storeDomain: record.storeDomain,
      apiVersion: record.apiVersion,
    };
  } catch {
    return null;
  }
}
