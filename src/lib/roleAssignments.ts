import "server-only";
import fs from "fs/promises";
import path from "path";

export type PortalRole = "user" | "vendor_admin" | "cms_admin";

export type RoleAssignment = {
  email: string;
  role: PortalRole;
  updatedAt: string;
};

const filePath = path.join(process.cwd(), "data", "role-assignments.json");

async function readAssignments(): Promise<RoleAssignment[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as RoleAssignment[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        email: String(item.email || "").trim().toLowerCase(),
        role: (item.role || "user") as PortalRole,
        updatedAt: String(item.updatedAt || new Date().toISOString()),
      }))
      .filter((item) => item.email);
  } catch {
    return [];
  }
}

async function writeAssignments(assignments: RoleAssignment[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(assignments, null, 2), "utf8");
}

export async function getRoleAssignments() {
  return readAssignments();
}

export async function setRoleAssignment(emailInput: string, role: PortalRole) {
  const email = String(emailInput || "").trim().toLowerCase();
  if (!email) throw new Error("Email is required.");
  if (!["user", "vendor_admin", "cms_admin"].includes(role)) {
    throw new Error("Invalid role.");
  }
  const all = await readAssignments();
  const now = new Date().toISOString();
  const idx = all.findIndex((item) => item.email === email);
  const next: RoleAssignment = { email, role, updatedAt: now };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  await writeAssignments(all);
  return next;
}
