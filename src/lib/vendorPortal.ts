import "server-only";
import fs from "fs/promises";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/auth";

export type VendorRecord = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone?: string;
  contactPerson?: string;
  businessName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  passwordHash: string;
  states: string[];
  isActive: boolean;
  commissionPercent?: number;
};

export type VendorStoreLocation = {
  id: string;
  vendorId: string;
  state: string;
  city: string;
  storeName: string;
  address: string;
  phone: string;
  pincode: string;
  isActive: boolean;
};

export type VendorPortalData = {
  vendors: VendorRecord[];
  stores: VendorStoreLocation[];
  updatedAt: string;
};

const dataPath = path.join(process.cwd(), "data", "vendor-portal.json");

const emptyData: VendorPortalData = {
  vendors: [],
  stores: [],
  updatedAt: new Date(0).toISOString(),
};

function toId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export async function getVendorPortalData(): Promise<VendorPortalData> {
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<VendorPortalData>;
    return {
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
      stores: Array.isArray(parsed.stores) ? parsed.stores : [],
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return emptyData;
  }
}

export async function saveVendorPortalData(input: VendorPortalData) {
  const normalized: VendorPortalData = {
    vendors: input.vendors.map((vendor) => ({
      ...vendor,
      id: vendor.id || toId("vendor"),
      name: String(vendor.name || "").trim(),
      code: String(vendor.code || "").trim(),
      email: normalizeEmail(vendor.email),
      phone: String(vendor.phone || "").trim(),
      contactPerson: String(vendor.contactPerson || "").trim(),
      businessName: String(vendor.businessName || "").trim(),
      address: String(vendor.address || "").trim(),
      city: String(vendor.city || "").trim(),
      state: String(vendor.state || "").trim(),
      pincode: String(vendor.pincode || "").trim(),
      states: Array.isArray(vendor.states)
        ? vendor.states.map((state) => String(state || "").trim()).filter(Boolean)
        : [],
      isActive: Boolean(vendor.isActive),
      commissionPercent: Number.isFinite(Number(vendor.commissionPercent))
        ? Math.min(100, Math.max(0, Number(vendor.commissionPercent)))
        : 10,
      passwordHash: String(vendor.passwordHash || ""),
    })),
    stores: input.stores.map((store) => ({
      ...store,
      id: store.id || toId("store"),
      vendorId: String(store.vendorId || "").trim(),
      state: String(store.state || "").trim(),
      city: String(store.city || "").trim(),
      storeName: String(store.storeName || "").trim(),
      address: String(store.address || "").trim(),
      phone: String(store.phone || "").trim(),
      pincode: String(store.pincode || "").trim(),
      isActive: Boolean(store.isActive),
    })),
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export async function setVendorPassword(vendorId: string, plainPassword: string) {
  const data = await getVendorPortalData();
  const index = data.vendors.findIndex((vendor) => vendor.id === vendorId);
  if (index < 0) throw new Error("Vendor not found.");
  if (plainPassword.trim().length < 6) throw new Error("Password must be at least 6 characters.");
  data.vendors[index] = {
    ...data.vendors[index],
    passwordHash: hashPassword(plainPassword.trim()),
  };
  return saveVendorPortalData(data);
}

export async function authenticateVendor(email: string, password: string) {
  const data = await getVendorPortalData();
  const normalized = normalizeEmail(email);
  const vendor = data.vendors.find((item) => normalizeEmail(item.email) === normalized && item.isActive);
  if (!vendor || !vendor.passwordHash) return null;
  if (!verifyPassword(password, vendor.passwordHash)) return null;
  return vendor;
}

export async function getVendorByEmail(email: string) {
  const data = await getVendorPortalData();
  const normalized = normalizeEmail(email);
  return data.vendors.find((vendor) => normalizeEmail(vendor.email) === normalized) || null;
}

export async function setVendorPasswordByEmail(email: string, plainPassword: string) {
  const data = await getVendorPortalData();
  const normalized = normalizeEmail(email);
  const index = data.vendors.findIndex((vendor) => normalizeEmail(vendor.email) === normalized);
  if (index < 0) throw new Error("Vendor not found.");
  if (plainPassword.trim().length < 6) throw new Error("Password must be at least 6 characters.");
  data.vendors[index] = {
    ...data.vendors[index],
    passwordHash: hashPassword(plainPassword.trim()),
  };
  return saveVendorPortalData(data);
}

export async function getVendorStores(vendorId: string) {
  const data = await getVendorPortalData();
  return data.stores.filter((store) => store.vendorId === vendorId);
}

export async function listStoresByState(state?: string) {
  const data = await getVendorPortalData();
  const stateNorm = String(state || "").trim().toLowerCase();
  const vendorById = new Map(data.vendors.map((vendor) => [vendor.id, vendor]));
  return data.stores
    .filter((store) => store.isActive)
    .filter((store) => !stateNorm || store.state.trim().toLowerCase() === stateNorm)
    .map((store) => ({
      ...store,
      vendorName: vendorById.get(store.vendorId)?.name || "Unknown Vendor",
    }));
}

export async function deleteVendor(vendorId: string) {
  const data = await getVendorPortalData();
  const exists = data.vendors.some((vendor) => vendor.id === vendorId);
  if (!exists) throw new Error("Vendor not found.");
  const next: VendorPortalData = {
    vendors: data.vendors.filter((vendor) => vendor.id !== vendorId),
    stores: data.stores.filter((store) => store.vendorId !== vendorId),
    updatedAt: new Date().toISOString(),
  };
  return saveVendorPortalData(next);
}


