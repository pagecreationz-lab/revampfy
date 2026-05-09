import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { decryptConfigValue, encryptConfigValue } from "@/lib/secureConfig";

export type PaymentProvider = "manual" | "razorpay" | "payu" | "cod";

export type CatalogCommerceConfig = {
  enablePayments: boolean;
  enableCheckout: boolean;
  enableCustomerAccounts: boolean;
  enableShippingDelivery: boolean;
  enableTaxesDuties: boolean;
  enableInventoryStock: boolean;
  enableNotifications: boolean;
  enableCustomerPolicy: boolean;
  enableTwoWaySync: boolean;
  notificationEmail: string;
  shippingPolicy: string;
  returnsPolicy: string;
  warrantyPolicy: string;
  privacyPolicy: string;
  taxRatePct: number;
  shippingFlatRate: number;
  paymentGateway: PaymentProvider;
  razorpayEnabled: boolean;
  enableCod: boolean;
  requireGpsForCod: boolean;
  requireGpsForAllPayments: boolean;
  payuEnabled: boolean;
  payuKey: string;
  payuSalt: string;
  payuAuthHeader: string;
  payuWebhookSecret: string;
  shiprocketEnabled: boolean;
  shiprocketEmail: string;
  shiprocketPassword: string;
  shiprocketPickupLocation: string;
  shiprocketWebhookSecret: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
};

const cwd = process.cwd();
const isReadonlyServerlessCwd = cwd.startsWith("/var/task");
const runtimeDataDir =
  process.env.RUNTIME_DATA_DIR?.trim() ||
  (process.env.VERCEL || isReadonlyServerlessCwd
    ? path.join("/tmp", "laptop-reseller-data")
    : path.join(cwd, "data"));
const seedDataDir = path.join(cwd, "data");
const configPath = path.join(runtimeDataDir, "catalog-commerce.json");
const seedConfigPath = path.join(seedDataDir, "catalog-commerce.json");

export const defaultCatalogCommerceConfig: CatalogCommerceConfig = {
  enablePayments: true,
  enableCheckout: true,
  enableCustomerAccounts: true,
  enableShippingDelivery: true,
  enableTaxesDuties: true,
  enableInventoryStock: true,
  enableNotifications: true,
  enableCustomerPolicy: true,
  enableTwoWaySync: false,
  notificationEmail: "support@revampfy.in",
  shippingPolicy: "Orders are dispatched in 24-48 hours with tracking updates.",
  returnsPolicy: "Returns accepted within 7 days for eligible products.",
  warrantyPolicy: "Certified products include warranty support as listed on product pages.",
  privacyPolicy: "Customer data is used for fulfilment, support, and compliance only.",
  taxRatePct: 18,
  shippingFlatRate: 199,
  paymentGateway: "manual",
  razorpayEnabled: true,
  enableCod: true,
  requireGpsForCod: true,
  requireGpsForAllPayments: true,
  payuEnabled: false,
  payuKey: "",
  payuSalt: "",
  payuAuthHeader: "",
  payuWebhookSecret: "",
  shiprocketEnabled: false,
  shiprocketEmail: "",
  shiprocketPassword: "",
  shiprocketPickupLocation: "Primary",
  shiprocketWebhookSecret: "",
  razorpayKeyId: "",
  razorpayKeySecret: "",
};

export async function getCatalogCommerceConfig(): Promise<CatalogCommerceConfig> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<CatalogCommerceConfig>;
    return {
      ...defaultCatalogCommerceConfig,
      ...parsed,
      taxRatePct: Number.isFinite(Number(parsed.taxRatePct))
        ? Number(parsed.taxRatePct)
        : defaultCatalogCommerceConfig.taxRatePct,
      shippingFlatRate: Number.isFinite(Number(parsed.shippingFlatRate))
        ? Number(parsed.shippingFlatRate)
        : defaultCatalogCommerceConfig.shippingFlatRate,
      paymentGateway: ["manual", "razorpay", "payu", "cod"].includes(String(parsed.paymentGateway || ""))
        ? (parsed.paymentGateway as PaymentProvider)
        : "manual",
      enableCod: Boolean(parsed.enableCod ?? defaultCatalogCommerceConfig.enableCod),
      requireGpsForCod: Boolean(parsed.requireGpsForCod ?? defaultCatalogCommerceConfig.requireGpsForCod),
      razorpayEnabled: Boolean(parsed.razorpayEnabled ?? defaultCatalogCommerceConfig.razorpayEnabled),
      requireGpsForAllPayments: Boolean(
        parsed.requireGpsForAllPayments ?? defaultCatalogCommerceConfig.requireGpsForAllPayments
      ),
      payuEnabled: Boolean(parsed.payuEnabled ?? defaultCatalogCommerceConfig.payuEnabled),
      payuKey: String(parsed.payuKey || "").trim(),
      payuSalt: decryptConfigValue(String(parsed.payuSalt || "").trim()),
      payuAuthHeader: decryptConfigValue(String(parsed.payuAuthHeader || "").trim()),
      payuWebhookSecret: decryptConfigValue(String(parsed.payuWebhookSecret || "").trim()),
      shiprocketEnabled: Boolean(parsed.shiprocketEnabled ?? defaultCatalogCommerceConfig.shiprocketEnabled),
      shiprocketEmail: String(parsed.shiprocketEmail || "").trim(),
      shiprocketPassword: decryptConfigValue(String(parsed.shiprocketPassword || "").trim()),
      shiprocketPickupLocation: String(parsed.shiprocketPickupLocation || defaultCatalogCommerceConfig.shiprocketPickupLocation).trim(),
      shiprocketWebhookSecret: decryptConfigValue(String(parsed.shiprocketWebhookSecret || "").trim()),
      razorpayKeyId: String(parsed.razorpayKeyId || "").trim(),
      razorpayKeySecret: decryptConfigValue(String(parsed.razorpayKeySecret || "").trim()),
    };
  } catch {
    try {
      const seedRaw = await fs.readFile(seedConfigPath, "utf8");
      const parsed = JSON.parse(seedRaw) as Partial<CatalogCommerceConfig>;
      return {
        ...defaultCatalogCommerceConfig,
        ...parsed,
        taxRatePct: Number.isFinite(Number(parsed.taxRatePct))
          ? Number(parsed.taxRatePct)
          : defaultCatalogCommerceConfig.taxRatePct,
        shippingFlatRate: Number.isFinite(Number(parsed.shippingFlatRate))
          ? Number(parsed.shippingFlatRate)
          : defaultCatalogCommerceConfig.shippingFlatRate,
        paymentGateway: ["manual", "razorpay", "payu", "cod"].includes(String(parsed.paymentGateway || ""))
          ? (parsed.paymentGateway as PaymentProvider)
          : "manual",
        enableCod: Boolean(parsed.enableCod ?? defaultCatalogCommerceConfig.enableCod),
        requireGpsForCod: Boolean(parsed.requireGpsForCod ?? defaultCatalogCommerceConfig.requireGpsForCod),
        razorpayEnabled: Boolean(parsed.razorpayEnabled ?? defaultCatalogCommerceConfig.razorpayEnabled),
        requireGpsForAllPayments: Boolean(
          parsed.requireGpsForAllPayments ?? defaultCatalogCommerceConfig.requireGpsForAllPayments
        ),
        payuEnabled: Boolean(parsed.payuEnabled ?? defaultCatalogCommerceConfig.payuEnabled),
        payuKey: String(parsed.payuKey || "").trim(),
        payuSalt: decryptConfigValue(String(parsed.payuSalt || "").trim()),
        payuAuthHeader: decryptConfigValue(String(parsed.payuAuthHeader || "").trim()),
        payuWebhookSecret: decryptConfigValue(String(parsed.payuWebhookSecret || "").trim()),
        shiprocketEnabled: Boolean(parsed.shiprocketEnabled ?? defaultCatalogCommerceConfig.shiprocketEnabled),
        shiprocketEmail: String(parsed.shiprocketEmail || "").trim(),
        shiprocketPassword: decryptConfigValue(String(parsed.shiprocketPassword || "").trim()),
        shiprocketPickupLocation: String(parsed.shiprocketPickupLocation || defaultCatalogCommerceConfig.shiprocketPickupLocation).trim(),
        shiprocketWebhookSecret: decryptConfigValue(String(parsed.shiprocketWebhookSecret || "").trim()),
        razorpayKeyId: String(parsed.razorpayKeyId || "").trim(),
        razorpayKeySecret: decryptConfigValue(String(parsed.razorpayKeySecret || "").trim()),
      };
    } catch {
      return defaultCatalogCommerceConfig;
    }
  }
}

export async function saveCatalogCommerceConfig(
  next: Partial<CatalogCommerceConfig>
): Promise<CatalogCommerceConfig> {
  const current = await getCatalogCommerceConfig();
  const normalized: CatalogCommerceConfig = {
    ...current,
    ...next,
    taxRatePct: Number.isFinite(Number(next.taxRatePct))
      ? Number(next.taxRatePct)
      : current.taxRatePct,
    shippingFlatRate: Number.isFinite(Number(next.shippingFlatRate))
      ? Number(next.shippingFlatRate)
      : current.shippingFlatRate,
    paymentGateway: ["manual", "razorpay", "payu", "cod"].includes(String(next.paymentGateway || ""))
      ? (next.paymentGateway as PaymentProvider)
      : current.paymentGateway,
    enableCod:
      typeof next.enableCod === "boolean"
        ? next.enableCod
        : current.enableCod,
    razorpayEnabled:
      typeof next.razorpayEnabled === "boolean"
        ? next.razorpayEnabled
        : current.razorpayEnabled,
    requireGpsForCod:
      typeof next.requireGpsForCod === "boolean"
        ? next.requireGpsForCod
        : current.requireGpsForCod,
    requireGpsForAllPayments:
      typeof next.requireGpsForAllPayments === "boolean"
        ? next.requireGpsForAllPayments
        : current.requireGpsForAllPayments,
    payuEnabled:
      typeof next.payuEnabled === "boolean"
        ? next.payuEnabled
        : current.payuEnabled,
    payuKey:
      typeof next.payuKey === "string"
        ? next.payuKey.trim()
        : current.payuKey,
    payuSalt:
      typeof next.payuSalt === "string"
        ? next.payuSalt.trim() || current.payuSalt
        : current.payuSalt,
    payuAuthHeader:
      typeof next.payuAuthHeader === "string"
        ? next.payuAuthHeader.trim() || current.payuAuthHeader
        : current.payuAuthHeader,
    payuWebhookSecret:
      typeof next.payuWebhookSecret === "string"
        ? next.payuWebhookSecret.trim() || current.payuWebhookSecret
        : current.payuWebhookSecret,
    shiprocketEnabled:
      typeof next.shiprocketEnabled === "boolean"
        ? next.shiprocketEnabled
        : current.shiprocketEnabled,
    shiprocketEmail:
      typeof next.shiprocketEmail === "string"
        ? next.shiprocketEmail.trim()
        : current.shiprocketEmail,
    shiprocketPassword:
      typeof next.shiprocketPassword === "string"
        ? next.shiprocketPassword.trim() || current.shiprocketPassword
        : current.shiprocketPassword,
    shiprocketPickupLocation:
      typeof next.shiprocketPickupLocation === "string"
        ? next.shiprocketPickupLocation.trim() || current.shiprocketPickupLocation
        : current.shiprocketPickupLocation,
    shiprocketWebhookSecret:
      typeof next.shiprocketWebhookSecret === "string"
        ? next.shiprocketWebhookSecret.trim() || current.shiprocketWebhookSecret
        : current.shiprocketWebhookSecret,
    razorpayKeyId:
      typeof next.razorpayKeyId === "string"
        ? next.razorpayKeyId.trim() || current.razorpayKeyId
        : current.razorpayKeyId,
    razorpayKeySecret:
      typeof next.razorpayKeySecret === "string"
        ? next.razorpayKeySecret.trim() || current.razorpayKeySecret
        : current.razorpayKeySecret,
  };
  const persisted: CatalogCommerceConfig = {
    ...normalized,
    razorpayKeySecret: normalized.razorpayKeySecret
      ? encryptConfigValue(normalized.razorpayKeySecret)
      : "",
    payuSalt: normalized.payuSalt ? encryptConfigValue(normalized.payuSalt) : "",
    payuAuthHeader: normalized.payuAuthHeader ? encryptConfigValue(normalized.payuAuthHeader) : "",
    payuWebhookSecret: normalized.payuWebhookSecret
      ? encryptConfigValue(normalized.payuWebhookSecret)
      : "",
    shiprocketPassword: normalized.shiprocketPassword
      ? encryptConfigValue(normalized.shiprocketPassword)
      : "",
    shiprocketWebhookSecret: normalized.shiprocketWebhookSecret
      ? encryptConfigValue(normalized.shiprocketWebhookSecret)
      : "",
  };
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(persisted, null, 2), "utf8");
  return normalized;
}

