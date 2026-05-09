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
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
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
  paymentId?: string;
  transactionStatus?: string;
  paymentMethod?: string;
  trackingId?: string;
  trackingStatus?: string;
  courierPartner?: string;
  trackingTimeline?: Array<{ at: string; status: string; note?: string }>;
  invoiceUrl?: string;
  lineItems: Array<{ variantId: number; quantity: number }>;
  createdAt: string;
};

const cwd = process.cwd();
const isReadonlyServerlessCwd = cwd.startsWith("/var/task");
const runtimeDataDir =
  process.env.RUNTIME_DATA_DIR?.trim() ||
  (process.env.VERCEL || isReadonlyServerlessCwd
    ? path.join("/tmp", "laptop-reseller-data")
    : path.join(cwd, "data"));
const seedDataDir = path.join(cwd, "data");

const usersPath = path.join(runtimeDataDir, "customer-users.json");
const ordersPath = path.join(runtimeDataDir, "customer-orders.json");
const usersSeedPath = path.join(seedDataDir, "customer-users.json");
const ordersSeedPath = path.join(seedDataDir, "customer-orders.json");
const DRAFT_EXPIRY_MS = 10 * 60 * 1000;

const demoCustomer: CustomerUser = {
  email: "user@revampfy.in",
  passwordHash: hashPassword("User@123"),
  name: "Revampfy User",
  mobile: "8248003564",
  address: "",
  street: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
  paymentMode: "UPI",
  needsProfileCompletion: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

async function readJsonFile<T>(filePath: string, fallback: T, seedPath?: string): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    if (seedPath) {
      try {
        const seedRaw = await fs.readFile(seedPath, "utf8");
        return JSON.parse(seedRaw) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, payload: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function shouldPruneDraftOrder(order: CustomerOrder, nowMs: number): boolean {
  const status = String(order.status || "").toLowerCase();
  if (!status.includes("draft")) return false;
  const createdMs = new Date(order.createdAt || "").getTime();
  if (!Number.isFinite(createdMs)) return false;
  return nowMs - createdMs >= DRAFT_EXPIRY_MS;
}

async function readOrdersAndPruneExpiredDrafts(): Promise<CustomerOrder[]> {
  const all = await readJsonFile<CustomerOrder[]>(ordersPath, [], ordersSeedPath);
  const now = Date.now();
  const filtered = all.filter((order) => !shouldPruneDraftOrder(order, now));
  if (filtered.length !== all.length) {
    await writeJsonFile(ordersPath, filtered);
  }
  return filtered;
}

export async function getCustomerUsers(): Promise<CustomerUser[]> {
  const users = await readJsonFile<Partial<CustomerUser>[]>(usersPath, [], usersSeedPath);
  const normalized: CustomerUser[] = users
    .filter((user) => user?.email && user?.passwordHash)
    .map((user) => ({
      email: String(user.email || "").trim().toLowerCase(),
      passwordHash: String(user.passwordHash || ""),
      name: String(user.name || "New User"),
      mobile: String(user.mobile || ""),
      address: String(user.address || ""),
      street: String(user.street || ""),
      area: String(user.area || ""),
      city: String(user.city || ""),
      state: String(user.state || ""),
      pincode: String(user.pincode || ""),
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
  const mobile = (input.mobile || "").trim();
  const users = await getCustomerUsers();
  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Account already exists with this email.");
  }
  if (mobile && users.some((user) => String(user.mobile || "").trim() === mobile)) {
    throw new Error("Account already exists with this mobile number.");
  }

  const now = new Date().toISOString();
  const newUser: CustomerUser = {
    email,
    passwordHash: hashPassword(input.password),
    name: (input.name || "New User").trim(),
    mobile,
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
      | "email"
      | "name"
      | "mobile"
      | "address"
      | "street"
      | "area"
      | "city"
      | "state"
      | "pincode"
      | "paymentMode"
      | "needsProfileCompletion"
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
  const nextMobile =
    typeof patch.mobile === "string" ? patch.mobile.trim() : String(current.mobile || "").trim();
  if (
    nextMobile &&
    users.some((user, i) => i !== index && String(user.mobile || "").trim() === nextMobile)
  ) {
    throw new Error("Mobile number already exists for another user.");
  }

  const next: CustomerUser = {
    ...current,
    email: nextEmail,
    name: typeof patch.name === "string" ? patch.name.trim() : current.name,
    mobile: nextMobile,
    address: typeof patch.address === "string" ? patch.address.trim() : current.address,
    street: typeof patch.street === "string" ? patch.street.trim() : String(current.street || ""),
    area: typeof patch.area === "string" ? patch.area.trim() : String(current.area || ""),
    city: typeof patch.city === "string" ? patch.city.trim() : String(current.city || ""),
    state: typeof patch.state === "string" ? patch.state.trim() : String(current.state || ""),
    pincode: typeof patch.pincode === "string" ? patch.pincode.trim() : String(current.pincode || ""),
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

export async function updateCustomerPasswordByEmail(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  const users = await getCustomerUsers();
  const index = users.findIndex((user) => user.email.toLowerCase() === email);
  if (index < 0) {
    throw new Error("Customer account not found.");
  }
  users[index] = {
    ...users[index],
    passwordHash: hashPassword(password),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(usersPath, users);
  return users[index];
}

export async function adminCreateCustomerUser(input: {
  email: string;
  password: string;
  name: string;
  mobile?: string;
  address?: string;
  paymentMode?: PaymentMode;
}) {
  const user = await registerCustomerUser({
    email: input.email,
    password: input.password,
    name: input.name,
    mobile: input.mobile || "",
  });
  return updateCustomerProfile(user.email, {
    address: input.address || "",
    paymentMode: input.paymentMode || "UPI",
    needsProfileCompletion: false,
  });
}

export async function adminDeleteCustomerUser(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const users = await getCustomerUsers();
  const nextUsers = users.filter((user) => user.email.toLowerCase() !== email);
  if (nextUsers.length === users.length) {
    throw new Error("Customer account not found.");
  }
  await writeJsonFile(usersPath, nextUsers);

  const orders = await readJsonFile<CustomerOrder[]>(ordersPath, [], ordersSeedPath);
  const nextOrders = orders.filter((order) => order.email.toLowerCase() !== email);
  await writeJsonFile(ordersPath, nextOrders);
}

export async function listCustomerOrders(email: string): Promise<CustomerOrder[]> {
  const all = await readOrdersAndPruneExpiredDrafts();
  const lower = email.trim().toLowerCase();
  return all
    .filter((order) => order.email.toLowerCase() === lower)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function appendCustomerOrder(order: Omit<CustomerOrder, "id" | "createdAt">) {
  const all = await readOrdersAndPruneExpiredDrafts();
  const next: CustomerOrder = {
    ...order,
    id: `ord_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  all.push(next);
  await writeJsonFile(ordersPath, all);
  return next;
}
