import "server-only";
import fs from "fs/promises";
import path from "path";
import { hashPassword } from "@/lib/auth";

export type PaymentMode = "UPI" | "Card" | "NetBanking" | "COD";

export type CustomerUser = {
  email: string;
  passwordHash: string;
  name: string;
  mobile: string;
  address: string;
  paymentMode: PaymentMode;
  needsProfileCompletion: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerOrder = {
  id: string;
  email: string;
  orderRef: string;
  status: string;
  total: number;
  invoiceUrl?: string;
  lineItems: Array<{ variantId: number; quantity: number }>;
  createdAt: string;
};

const usersPath = path.join(process.cwd(), "data", "customer-users.json");
const ordersPath = path.join(process.cwd(), "data", "customer-orders.json");

const demoCustomer: CustomerUser = {
  email: "user@revampfy.in",
  passwordHash: hashPassword("User@123"),
  name: "Revampfy User",
  mobile: "8248003564",
  address: "",
  paymentMode: "UPI",
  needsProfileCompletion: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, payload: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

export async function getCustomerUsers(): Promise<CustomerUser[]> {
  const users = await readJsonFile<Partial<CustomerUser>[]>(usersPath, []);
  const normalized = users
    .filter((user) => user?.email && user?.passwordHash)
    .map((user) => ({
      email: String(user.email || "").trim().toLowerCase(),
      passwordHash: String(user.passwordHash || ""),
      name: String(user.name || "New User"),
      mobile: String(user.mobile || ""),
      address: String(user.address || ""),
      paymentMode: (user.paymentMode as PaymentMode) || "UPI",
      needsProfileCompletion: Boolean(user.needsProfileCompletion),
      createdAt: String(user.createdAt || new Date().toISOString()),
      updatedAt: String(user.updatedAt || new Date().toISOString()),
    }));
  if (!normalized.find((u) => u.email.toLowerCase() === demoCustomer.email.toLowerCase())) {
    normalized.unshift(demoCustomer);
    await writeJsonFile(usersPath, normalized);
  }
  return normalized;
}

export async function getCustomerByEmail(email: string): Promise<CustomerUser | null> {
  const users = await getCustomerUsers();
  const lower = email.trim().toLowerCase();
  return users.find((user) => user.email.toLowerCase() === lower) || null;
}

export async function registerCustomerUser(input: {
  email: string;
  password: string;
  name?: string;
  mobile?: string;
}): Promise<CustomerUser> {
  const email = input.email.trim().toLowerCase();
  const users = await getCustomerUsers();
  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Account already exists with this email.");
  }

  const now = new Date().toISOString();
  const newUser: CustomerUser = {
    email,
    passwordHash: hashPassword(input.password),
    name: (input.name || "New User").trim(),
    mobile: (input.mobile || "").trim(),
    address: "",
    paymentMode: "UPI",
    needsProfileCompletion: false,
    createdAt: now,
    updatedAt: now,
  };

  const nextUsers = [...users, newUser];
  await writeJsonFile(usersPath, nextUsers);
  return newUser;
}

export async function ensureCustomerUserByEmail(
  emailInput: string,
  name?: string
): Promise<CustomerUser> {
  const email = emailInput.trim().toLowerCase();
  const users = await getCustomerUsers();
  const existing = users.find((user) => user.email.toLowerCase() === email);
  if (existing) return existing;

  const now = new Date().toISOString();
  const newUser: CustomerUser = {
    email,
    passwordHash: hashPassword(`${Date.now()}-${Math.random()}-${email}`),
    name: (name || email.split("@")[0] || "New User").trim(),
    mobile: "",
    address: "",
    paymentMode: "UPI",
    needsProfileCompletion: false,
    createdAt: now,
    updatedAt: now,
  };

  const nextUsers = [...users, newUser];
  await writeJsonFile(usersPath, nextUsers);
  return newUser;
}

export async function updateCustomerProfile(
  email: string,
  patch: Partial<
    Pick<
      CustomerUser,
      "email" | "name" | "mobile" | "address" | "paymentMode" | "needsProfileCompletion"
    >
  >
): Promise<CustomerUser> {
  const users = await getCustomerUsers();
  const lower = email.trim().toLowerCase();
  const index = users.findIndex((user) => user.email.toLowerCase() === lower);
  if (index < 0) {
    throw new Error("Customer account not found.");
  }

  const current = users[index];
  const requestedEmail =
    typeof patch.email === "string" ? patch.email.trim().toLowerCase() : current.email;
  const nextEmail = requestedEmail || current.email;
  const conflictIndex = users.findIndex(
    (user, i) => i !== index && user.email.toLowerCase() === nextEmail.toLowerCase()
  );
  if (conflictIndex >= 0) {
    throw new Error("Email already exists for another user.");
  }

  const next: CustomerUser = {
    ...current,
    email: nextEmail,
    name: typeof patch.name === "string" ? patch.name.trim() : current.name,
    mobile: typeof patch.mobile === "string" ? patch.mobile.trim() : current.mobile,
    address: typeof patch.address === "string" ? patch.address.trim() : current.address,
    paymentMode: patch.paymentMode || current.paymentMode,
    needsProfileCompletion:
      typeof patch.needsProfileCompletion === "boolean"
        ? patch.needsProfileCompletion
        : current.needsProfileCompletion,
    updatedAt: new Date().toISOString(),
  };
  users[index] = next;
  await writeJsonFile(usersPath, users);

  if (nextEmail.toLowerCase() !== lower) {
    const orders = await readJsonFile<CustomerOrder[]>(ordersPath, []);
    const migrated = orders.map((order) =>
      order.email.toLowerCase() === lower ? { ...order, email: nextEmail } : order
    );
    await writeJsonFile(ordersPath, migrated);
  }

  return next;
}

export async function listCustomerOrders(email: string): Promise<CustomerOrder[]> {
  const all = await readJsonFile<CustomerOrder[]>(ordersPath, []);
  const lower = email.trim().toLowerCase();
  return all
    .filter((order) => order.email.toLowerCase() === lower)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function appendCustomerOrder(order: Omit<CustomerOrder, "id" | "createdAt">) {
  const all = await readJsonFile<CustomerOrder[]>(ordersPath, []);
  const next: CustomerOrder = {
    ...order,
    id: `ord_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  all.push(next);
  await writeJsonFile(ordersPath, all);
  return next;
}
