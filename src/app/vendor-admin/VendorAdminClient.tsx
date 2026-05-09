"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonSafe } from "@/lib/httpClient";

type Vendor = {
  id: string;
  name: string;
  code: string;
  email: string;
  states: string[];
  isActive: boolean;
};

type Store = {
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

type CollectionOption = {
  id: number;
  title: string;
  handle: string;
};

type VariantDraft = {
  id?: number;
  title: string;
  price: string;
  compare_at_price: string;
  inventory_quantity: number;
};

type SpecsDraft = {
  performance: {
    memoryTechnology: string;
    displayResolution: string;
    processorFamily: string;
    graphicsCardType: string;
    storageTypesSupported: string;
  };
  software: {
    cosmeticCondition: string;
  };
  moreInfo: {
    colorPattern: string;
    operatingSystem: string;
    connectionType: string;
    keyboardType: string;
    brand: string;
    model: string;
    category: string;
  };
};

type VendorProduct = {
  id: number;
  title: string;
  handle?: string;
  status?: string;
  tags?: string;
  vendor?: string;
  category?: string;
  product_type?: string;
  collection_handles?: string[];
  images?: Array<{ src: string }>;
  variants?: VariantDraft[];
  metafields?: Array<{ namespace: string; key: string; value: string; type?: string }>;
};

type VendorOrder = {
  id: number;
  name: string;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPrice: number;
  statusUrl?: string;
  itemsCount: number;
  vendorAmount: number;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  customerEmail: string;
  rawStatus?: string;
};

type VendorSheetLink = {
  sheetId?: string;
  sheetName: string;
  sheetUrl: string;
  syncStatus: "active" | "inactive" | "failed";
  lastSyncedAt: string;
  lastSyncMessage: string;
  googleConnected?: boolean;
  googleLoginEmail?: string;
  allowedGoogleEmails?: string[];
};
type VendorAccessRequest = {
  id: string;
  requestedGoogleEmail: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  note?: string;
};
type ProductDraftMap = Record<
  number,
  {
    title: string;
    category: string;
    brand: string;
    collection: string;
    tags: string;
    status: string;
    state: string;
    pincode: string;
    images: string[];
    variants: VariantDraft[];
    specs: SpecsDraft;
  }
>;

const emptySpecs: SpecsDraft = {
  performance: {
    memoryTechnology: "",
    displayResolution: "",
    processorFamily: "",
    graphicsCardType: "",
    storageTypesSupported: "",
  },
  software: {
    cosmeticCondition: "",
  },
  moreInfo: {
    colorPattern: "",
    operatingSystem: "",
    connectionType: "",
    keyboardType: "",
    brand: "",
    model: "",
    category: "",
  },
};

const newProductDefault = {
  title: "",
  category: "",
  brand: "",
  collection: "",
  tags: "",
  state: "",
  pincode: "",
  status: "active",
  images: [] as string[],
  variants: [{ title: "Default", price: "0", compare_at_price: "", inventory_quantity: 0 }] as VariantDraft[],
  specs: emptySpecs,
};

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSpecs(product: VendorProduct): SpecsDraft {
  const map = new Map((product.metafields || []).map((entry) => [`${entry.namespace}:${entry.key}`, entry.value]));
  const parse = (key: string): Record<string, string> => {
    const raw = map.get(key);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, String(v ?? "")])
      );
    } catch {
      return {};
    }
  };
  const performance = parse("specs:performance");
  const software = parse("specs:software");
  const moreInfo = parse("specs:moreInfo");
  return {
    performance: {
      memoryTechnology: performance["Memory Technology"] || "",
      displayResolution: performance["Display Resolution"] || "",
      processorFamily: performance["Processor Family"] || "",
      graphicsCardType: performance["Graphics Card Type"] || "",
      storageTypesSupported: performance["Storage Types Supported"] || "",
    },
    software: {
      cosmeticCondition: software["Cosmetic Condition"] || "",
    },
    moreInfo: {
      colorPattern: moreInfo["Color Pattern"] || "",
      operatingSystem: moreInfo["Operating System"] || "",
      connectionType: moreInfo["Connection Type"] || "",
      keyboardType: moreInfo["Keyboard Type"] || "",
      brand: moreInfo["Brand"] || "",
      model: moreInfo["Model"] || "",
      category: moreInfo["Category"] || "",
    },
  };
}

function specsToPayload(specs: SpecsDraft) {
  return {
    performance: {
      "Memory Technology": specs.performance.memoryTechnology,
      "Display Resolution": specs.performance.displayResolution,
      "Processor Family": specs.performance.processorFamily,
      "Graphics Card Type": specs.performance.graphicsCardType,
      "Storage Types Supported": specs.performance.storageTypesSupported,
    },
    software: {
      "Cosmetic Condition": specs.software.cosmeticCondition,
    },
    moreInfo: {
      "Color Pattern": specs.moreInfo.colorPattern,
      "Operating System": specs.moreInfo.operatingSystem,
      "Connection Type": specs.moreInfo.connectionType,
      "Keyboard Type": specs.moreInfo.keyboardType,
      Brand: specs.moreInfo.brand,
      Model: specs.moreInfo.model,
      Category: specs.moreInfo.category,
    },
  };
}

type VendorAdminClientProps = {
  focusProductId?: number | null;
  editorOnly?: boolean;
};

export default function VendorAdminClient({ focusProductId = null, editorOnly = false }: VendorAdminClientProps) {
  const router = useRouter();
  const [vendorTheme, setVendorTheme] = useState<"dark" | "light">("dark");
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [statesInput, setStatesInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [productDrafts, setProductDrafts] = useState<ProductDraftMap>({});
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [newProduct, setNewProduct] = useState(newProductDefault);
  const [activePanel, setActivePanel] = useState<"addProduct" | "yourProducts" | "manageSpecs" | "ordersCaptured" | "sheetProducts">(editorOnly ? "yourProducts" : "addProduct");
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordCode, setPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sendingPasswordCode, setSendingPasswordCode] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(focusProductId);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [memoryTechInput, setMemoryTechInput] = useState("");
  const [displayResolutionInput, setDisplayResolutionInput] = useState("");
  const [processorFamilyInput, setProcessorFamilyInput] = useState("");
  const [graphicsCardTypeInput, setGraphicsCardTypeInput] = useState("");
  const [storageTypesInput, setStorageTypesInput] = useState("");
  const [cosmeticConditionInput, setCosmeticConditionInput] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [memoryTechOptions, setMemoryTechOptions] = useState<string[]>([]);
  const [displayResolutionOptions, setDisplayResolutionOptions] = useState<string[]>([]);
  const [processorFamilyOptions, setProcessorFamilyOptions] = useState<string[]>([]);
  const [graphicsCardTypeOptions, setGraphicsCardTypeOptions] = useState<string[]>([]);
  const [storageTypesOptions, setStorageTypesOptions] = useState<string[]>([]);
  const [cosmeticConditionOptions, setCosmeticConditionOptions] = useState<string[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [collectionInput, setCollectionInput] = useState("");
  const [collectionOptions, setCollectionOptions] = useState<CollectionOption[]>([]);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "successful" | "failure" | "draft">("all");
  const [orderDateRange, setOrderDateRange] = useState<"today" | "7" | "30">("30");
  const [selectedOrder, setSelectedOrder] = useState<VendorOrder | null>(null);
  const [ordersSummary, setOrdersSummary] = useState({
    grossAmount: 0,
    commissionPercent: 0,
    commissionAmount: 0,
    creditBalance: 0,
  });
  const [sheetLink, setSheetLink] = useState<VendorSheetLink | null>(null);
  const [sheetLogs, setSheetLogs] = useState<Array<{ id: string; at: string; status: string; message: string; productsProcessed: number }>>([]);
  const [vendorSessionEmail, setVendorSessionEmail] = useState("");
  const [accessRequestEmail, setAccessRequestEmail] = useState("");
  const [accessRequests, setAccessRequests] = useState<VendorAccessRequest[]>([]);
  const newProductSlug = useMemo(() => slugify(newProduct.title), [newProduct.title]);
  const filteredOrders = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return orders.filter((order) => {
      const normalized = String(order.rawStatus || order.financialStatus || "").toLowerCase();
      const createdAtMs = new Date(order.createdAt || "").getTime();
      const age = Number.isFinite(createdAtMs) ? now - createdAtMs : Number.MAX_SAFE_INTEGER;
      const matchDate =
        orderDateRange === "today"
          ? age <= dayMs
          : orderDateRange === "7"
            ? age <= 7 * dayMs
            : age <= 30 * dayMs;
      if (!matchDate) return false;
      if (orderStatusFilter === "all") return true;
      if (orderStatusFilter === "successful") return normalized === "completed" || normalized === "paid";
      if (orderStatusFilter === "failure") return normalized === "failed";
      if (orderStatusFilter === "draft") return normalized === "draft" || normalized === "pending";
      return true;
    });
  }, [orders, orderStatusFilter, orderDateRange]);

  const locationOptions = useMemo(
    () =>
      stores
        .filter((store) => store.isActive)
        .map((store) => ({
          key: `${store.state}__${store.pincode}`,
          state: store.state,
          pincode: store.pincode,
          label: `${store.storeName} - ${store.state}${store.pincode ? ` (${store.pincode})` : ""}`,
        })),
    [stores]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const draft = productDrafts[product.id];
      const title = (draft?.title || product.title || "").toLowerCase();
      const productType = (draft?.specs.moreInfo.category || "").toLowerCase();
      const vendorName = String(product.vendor || vendor?.name || "").toLowerCase();
      const search = productSearch.trim().toLowerCase();
      const matchSearch =
        !search ||
        title.includes(search) ||
        productType.includes(search) ||
        vendorName.includes(search) ||
        String(product.id).includes(search);
      const status = (draft?.status || product.status || "active").toLowerCase();
      const matchStatus = productStatusFilter === "all" || status === productStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [products, productDrafts, productSearch, productStatusFilter, vendor?.name]);

  const load = async () => {
    const res = await fetch("/api/vendor/self");
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to load vendor data.");
      return;
    }
    setVendor(json.vendor);
    setStores(json.stores || []);
    setStatesInput((json.vendor?.states || []).join(", "));
    setNameInput(json.vendor?.name || "");

    const productsRes = await fetch("/api/vendor/products?limit=250");
    const productsJson = await readJsonSafe(productsRes);
    if (productsRes.ok && !productsJson.error) {
      const nextProducts = (productsJson.products || []) as VendorProduct[];
      setProducts(nextProducts);
      setSelectedProductId((prev) => prev ?? nextProducts[0]?.id ?? null);
      setProductDrafts(
        Object.fromEntries(
          nextProducts.map((product) => {
            const tags = String(product.tags || "");
            const stateTag = tags.split(",").map((t) => t.trim()).find((t) => t.toLowerCase().startsWith("vendorstate:"));
            const pincodeTag = tags.split(",").map((t) => t.trim()).find((t) => t.toLowerCase().startsWith("vendorpincode:"));
            return [
              product.id,
              {
                title: product.title || "",
                category: product.category || "",
                brand: product.product_type || "",
                collection: (product.collection_handles || []).join(", "),
                tags,
                status: product.status || "active",
                state: stateTag ? stateTag.split(":").slice(1).join(":").trim() : "",
                pincode: pincodeTag ? pincodeTag.split(":").slice(1).join(":").trim() : "",
                images: (product.images || []).map((image) => image.src).filter(Boolean),
                variants:
                  (product.variants || []).map((variant) => ({
                    id: variant.id,
                    title: variant.title || "Default",
                    price: String(variant.price || "0"),
                    compare_at_price: String(variant.compare_at_price || ""),
                    inventory_quantity: Number(variant.inventory_quantity || 0),
                  })) || [],
                specs: parseSpecs(product),
              },
            ];
          })
        )
      );
    }

    const collectionsRes = await fetch("/api/catalog/collections");
    const collectionsJson = await readJsonSafe(collectionsRes);
    if (collectionsRes.ok && !collectionsJson.error) {
      const nextCollections = Array.isArray(collectionsJson.collections) ? collectionsJson.collections : [];
      setCollectionOptions(
        nextCollections
          .map((entry: unknown) => {
            const item = entry as { id?: number; title?: string; handle?: string };
            return {
              id: Number(item.id || 0),
              title: String(item.title || "").trim(),
              handle: String(item.handle || "").trim(),
            };
          })
          .filter((item: CollectionOption) => item.id && item.title && item.handle)
      );
    }

    const ordersRes = await fetch("/api/vendor/orders", { cache: "no-store" });
    const ordersJson = await readJsonSafe(ordersRes);
    if (ordersRes.ok && !ordersJson.error) {
      setOrders(Array.isArray(ordersJson.orders) ? ordersJson.orders : []);
      setOrdersSummary({
        grossAmount: Number(ordersJson?.summary?.grossAmount || 0),
        commissionPercent: Number(ordersJson?.summary?.commissionPercent || 0),
        commissionAmount: Number(ordersJson?.summary?.commissionAmount || 0),
        creditBalance: Number(ordersJson?.summary?.creditBalance || 0),
      });
    }

    const sheetRes = await fetch("/api/vendor/google-sheet", { cache: "no-store" });
    const sheetJson = await readJsonSafe(sheetRes);
    if (sheetRes.ok && !sheetJson.error) {
      setSheetLink((sheetJson.link || null) as VendorSheetLink | null);
      setSheetLogs(Array.isArray(sheetJson.logs) ? sheetJson.logs : []);
      setVendorSessionEmail(String(sheetJson.vendorSessionEmail || ""));
    } else {
      setSheetLink(null);
      setSheetLogs([]);
      setVendorSessionEmail("");
    }

    const reqRes = await fetch("/api/vendor/google-sheet/access-request", { cache: "no-store" });
    const reqJson = await readJsonSafe(reqRes);
    if (reqRes.ok && !reqJson?.error) {
      setAccessRequests(Array.isArray(reqJson.requests) ? reqJson.requests : []);
    } else {
      setAccessRequests([]);
    }

  };

  const syncAssignedSheet = async () => {
    if (!sheetLink?.sheetName) {
      setError("No Google Sheet assigned to this vendor account.");
      return;
    }
    const res = await fetch("/api/vendor/google-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync" }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || "Unable to sync assigned sheet."));
      return;
    }
    setMessage("Assigned sheet synced successfully.");
    await load();
  };


  const requestSheetAccess = async () => {
    const email = accessRequestEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Enter valid Google email for access request.");
      return;
    }
    const res = await fetch("/api/vendor/google-sheet/access-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedGoogleEmail: email }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json?.error) {
      setError(String(json?.error || "Unable to create access request."));
      return;
    }
    setMessage("Access request submitted to CMS admin for approval.");
    setAccessRequestEmail("");
  };

  const exportProductsCsv = () => {
    const header = ["id", "title", "status", "inventory", "category", "vendor", "slug", "url"];
    const rows = filteredProducts.map((product) => {
      const draft = productDrafts[product.id];
      const inventory = (draft?.variants || []).reduce((sum, variant) => sum + Number(variant.inventory_quantity || 0), 0);
      const slug = slugify(draft?.title || product.handle || "");
      const safe = (value: string | number) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
      return [
        safe(product.id),
        safe(draft?.title || product.title || ""),
        safe(draft?.status || product.status || "active"),
        safe(inventory),
        safe(draft?.specs.moreInfo.category || ""),
        safe(product.vendor || vendor?.name || ""),
        safe(slug),
        safe(`/store/${slug || product.handle || product.id}`),
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "vendor-products.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const toggleProductSelection = (productId: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAllFiltered = () => {
    const ids = filteredProducts.map((product) => product.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedProductIds.includes(id));
    setSelectedProductIds(allSelected ? selectedProductIds.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedProductIds, ...ids])));
  };

  const duplicateSelectedProducts = async () => {
    if (!selectedProductIds.length) return;
    for (const productId of selectedProductIds) {
      // eslint-disable-next-line no-await-in-loop
      await duplicateVendorProduct(productId);
    }
    setMessage(`${selectedProductIds.length} product(s) duplicated.`);
  };

  const deleteSelectedProducts = async () => {
    if (!selectedProductIds.length) return;
    for (const productId of selectedProductIds) {
      // eslint-disable-next-line no-await-in-loop
      await deleteVendorProduct(productId);
    }
    setSelectedProductIds([]);
    setSelectedProductId(null);
    setMessage("Selected products deleted.");
  };

  const editSelectedProducts = () => {
    if (!selectedProductIds.length) {
      setError("Select at least one product to edit.");
      return;
    }
    if (editorOnly) {
      setSelectedProductId(selectedProductIds[0]);
    } else {
      router.push(`/vendor-admin/product/${selectedProductIds[0]}`);
    }
    setMessage(`Editing product #${selectedProductIds[0]}.`);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (activePanel !== "sheetProducts") return;
    const timer = window.setInterval(() => {
      void load();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [activePanel]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pcgs_vendor_theme_mode");
      if (stored === "light" || stored === "dark") {
        setVendorTheme(stored);
      }
    } catch {
      setVendorTheme("dark");
    }
  }, []);

  const toggleVendorTheme = () => {
    const next = vendorTheme === "dark" ? "light" : "dark";
    setVendorTheme(next);
    try {
      localStorage.setItem("pcgs_vendor_theme_mode", next);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.remove("vendor-portal-light", "vendor-portal-dark");
    document.body.classList.add(vendorTheme === "light" ? "vendor-portal-light" : "vendor-portal-dark");
    return () => {
      document.body.classList.remove("vendor-portal-light", "vendor-portal-dark");
    };
  }, [vendorTheme]);

  useEffect(() => {
    if (focusProductId) {
      setSelectedProductId(focusProductId);
      setActivePanel("yourProducts");
    }
  }, [focusProductId]);

  useEffect(() => {
    try {
      const memoryTech = JSON.parse(localStorage.getItem("vendor_spec_memory_technology") || "[]");
      const displayResolution = JSON.parse(localStorage.getItem("vendor_spec_display_resolution") || "[]");
      const processorFamily = JSON.parse(localStorage.getItem("vendor_spec_processor_family") || "[]");
      const graphicsCardType = JSON.parse(localStorage.getItem("vendor_spec_graphics_card_type") || "[]");
      const storageTypes = JSON.parse(localStorage.getItem("vendor_spec_storage_types_supported") || "[]");
      const cosmeticCondition = JSON.parse(localStorage.getItem("vendor_spec_cosmetic_condition") || "[]");
      const brands = JSON.parse(localStorage.getItem("vendor_brand_options") || "[]");
      const models = JSON.parse(localStorage.getItem("vendor_model_options") || "[]");
      const categories = JSON.parse(localStorage.getItem("vendor_category_options") || "[]");
      setMemoryTechOptions(Array.isArray(memoryTech) ? memoryTech : []);
      setDisplayResolutionOptions(Array.isArray(displayResolution) ? displayResolution : []);
      setProcessorFamilyOptions(Array.isArray(processorFamily) ? processorFamily : []);
      setGraphicsCardTypeOptions(Array.isArray(graphicsCardType) ? graphicsCardType : []);
      setStorageTypesOptions(Array.isArray(storageTypes) ? storageTypes : []);
      setCosmeticConditionOptions(Array.isArray(cosmeticCondition) ? cosmeticCondition : []);
      setBrandOptions(Array.isArray(brands) ? brands : []);
      setModelOptions(Array.isArray(models) ? models : []);
      setCategoryOptions(Array.isArray(categories) ? categories : []);
    } catch {
      setMemoryTechOptions([]);
      setDisplayResolutionOptions([]);
      setProcessorFamilyOptions([]);
      setGraphicsCardTypeOptions([]);
      setStorageTypesOptions([]);
      setCosmeticConditionOptions([]);
      setBrandOptions([]);
      setModelOptions([]);
      setCategoryOptions([]);
    }
  }, []);

  const saveOptionList = (key: string, values: string[]) => {
    localStorage.setItem(key, JSON.stringify(values));
  };

  const addCollectionOption = async () => {
    const title = collectionInput.trim();
    if (!title) return;
    setError("");
    try {
      const res = await fetch("/api/catalog/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || json.error) {
        setError(json.error || "Unable to create collection.");
        return;
      }
      setCollectionInput("");
      await load();
      setMessage("Collection added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create collection.");
    }
  };

  const addOption = (
    inputValue: string,
    currentOptions: string[],
    setter: (values: string[]) => void,
    key: string,
    clearInput: () => void
  ) => {
    const next = inputValue.trim();
    if (!next) return;
    const merged = Array.from(new Set([...currentOptions, next])).sort((a, b) => a.localeCompare(b));
    setter(merged);
    saveOptionList(key, merged);
    clearInput();
  };

  const uploadFiles = async (files: FileList): Promise<string[]> => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    const res = await fetch("/api/vendor/upload-image", { method: "POST", body: form });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) throw new Error(json.error || "Image upload failed.");
    return (json.urls || []) as string[];
  };

  const handleNewProductImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    try {
      const urls = await uploadFiles(event.target.files);
      setNewProduct((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      setMessage("Images uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      event.target.value = "";
    }
  };

  const handleEditProductImageUpload = async (productId: number, event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    try {
      const urls = await uploadFiles(event.target.files);
      setProductDrafts((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], images: [...(prev[productId]?.images || []), ...urls] },
      }));
      setMessage("Images uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      event.target.value = "";
    }
  };

  const saveProfile = async () => {
    if (!vendor) return;
    const states = statesInput.split(",").map((state) => state.trim()).filter(Boolean);
    const res = await fetch("/api/vendor/self", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput, states }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to update profile.");
      return;
    }
    setVendor(json.vendor);
    setStores(json.stores || []);
    setMessage("Profile updated.");
  };

  const sendPasswordResetCode = async () => {
    if (!vendor?.email) return;
    setSendingPasswordCode(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/vendor-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: vendor.email }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || json.error) {
        setError(json.error || "Unable to send verification code.");
        return;
      }
      setMessage("Password verification code sent to vendor email.");
    } finally {
      setSendingPasswordCode(false);
    }
  };

  const updatePasswordWithCode = async () => {
    if (!vendor?.email) return;
    if (!passwordCode.trim() || !newPassword.trim()) {
      setError("Enter verification code and new password.");
      return;
    }
    setResettingPassword(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/vendor-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: vendor.email,
          code: passwordCode.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || json.error) {
        setError(json.error || "Unable to update password.");
        return;
      }
      setPasswordCode("");
      setNewPassword("");
      setMessage("Password updated successfully.");
    } finally {
      setResettingPassword(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/vendor-login";
  };

  const createVendorProduct = async () => {
    const res = await fetch("/api/vendor/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newProduct.title,
        category: newProduct.specs.moreInfo.category,
        brand: newProduct.specs.moreInfo.brand,
        collection: newProduct.collection,
        tags: newProduct.tags,
        state: newProduct.state,
        pincode: newProduct.pincode,
        status: newProduct.status,
        images: newProduct.images.map((src) => ({ src })),
        variants: newProduct.variants,
        specs: {
          ...specsToPayload(newProduct.specs),
        },
      }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to create product.");
      return;
    }
    setMessage("Product created.");
    setNewProduct(newProductDefault);
    await load();
  };

  const downloadCsvTemplate = () => {
    const csvSafe = (value: string | number) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, "\"\"")}"`;
    };
    const header = [
      "title",
      "category",
      "brand",
      "collection",
      "tags",
      "state",
      "pincode",
      "status",
      "price",
      "compare_at_price",
      "inventory_quantity",
      "image_urls",
      "memory_technology",
      "display_resolution",
      "processor_family",
      "graphics_card_type",
      "storage_types_supported",
      "cosmetic_condition",
      "color_pattern",
      "operating_system",
      "connection_type",
      "keyboard_type",
      "model",
    ];
    const sample = [
      "HP Laptop i5 11th Gen 16GB 256GB SSD",
      "Laptop",
      "HP",
      "frontpage",
      "featured,hp",
      "Tamil Nadu",
      "600126",
      "active",
      "25000",
      "",
      "8",
      "/uploads/vendor/sample-1.jpg|/uploads/vendor/sample-2.jpg",
      "DDR4",
      "1920x1080",
      "Intel i5 11th Gen",
      "Integrated",
      "NVMe SSD",
      "Refurbished",
      "Black",
      "Windows 11",
      "WiFi,Bluetooth",
      "Backlit",
      "440 g7",
    ];
    const csv = `${header.map(csvSafe).join(",")}\n${sample.map(csvSafe).join(",")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendor-products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line: string) => {
    const cols: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (ch === "," && !quoted) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  const handleBulkCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    setError("");
    setMessage("");
    setBulkUploading(true);
    try {
      const file = event.target.files[0];
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("CSV must include header and at least one product row.");
      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      const rows = lines.slice(1);
      let success = 0;
      const failures: string[] = [];

      for (let idx = 0; idx < rows.length; idx += 1) {
        const cols = parseCsvLine(rows[idx]);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = cols[i] || "";
        });
        if (!row.title) {
          failures.push(`Row ${idx + 2}: missing title`);
          continue;
        }

        const images = (row.image_urls || "")
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((src) => ({ src }));

        const payload = {
          title: row.title,
          category: row.category,
          brand: row.brand,
          collection: row.collection,
          tags: row.tags,
          state: row.state,
          pincode: row.pincode,
          status: row.status || "active",
          images,
          variants: [
            {
              title: "Default",
              price: row.price || "0",
              compare_at_price: row.compare_at_price || "",
              inventory_quantity: Number(row.inventory_quantity || 0),
            },
          ],
          specs: {
            performance: {
              "Memory Technology": row.memory_technology || "",
              "Display Resolution": row.display_resolution || "",
              "Processor Family": row.processor_family || "",
              "Graphics Card Type": row.graphics_card_type || "",
              "Storage Types Supported": row.storage_types_supported || "",
            },
            software: {
              "Cosmetic Condition": row.cosmetic_condition || "",
            },
            moreInfo: {
              "Color Pattern": row.color_pattern || "",
              "Operating System": row.operating_system || "",
              "Connection Type": row.connection_type || "",
              "Keyboard Type": row.keyboard_type || "",
              Brand: row.brand || "",
              Model: row.model || "",
              Category: row.category || "",
            },
          },
        };
        const res = await fetch("/api/vendor/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await readJsonSafe(res);
        if (!res.ok || json.error) {
          failures.push(`Row ${idx + 2}: ${json.error || "failed"}`);
        } else {
          success += 1;
        }
      }

      if (failures.length) {
        setError(`Bulk upload completed with issues. Success: ${success}. ${failures.slice(0, 3).join(" | ")}`);
      } else {
        setMessage(`Bulk upload successful. Created ${success} products.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk CSV upload failed.");
    } finally {
      setBulkUploading(false);
      event.target.value = "";
    }
  };

  const duplicateVendorProduct = async (productId: number) => {
    const draft = productDrafts[productId];
    if (!draft) return;
    const res = await fetch("/api/vendor/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${draft.title} Copy`,
        category: draft.specs.moreInfo.category,
        brand: draft.specs.moreInfo.brand,
        collection: draft.collection,
        tags: draft.tags,
        state: draft.state,
        pincode: draft.pincode,
        status: draft.status || "active",
        images: draft.images.map((src) => ({ src })),
        variants: draft.variants,
        specs: {
          ...specsToPayload(draft.specs),
        },
      }),
    });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to duplicate product.");
      return;
    }
    setMessage("Product duplicated.");
    await load();
  };

  const updateVendorProduct = async (productId: number) => {
    const draft = productDrafts[productId];
    if (!draft) return;
    setSavingProductId(productId);
    try {
      const res = await fetch("/api/vendor/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          title: draft.title,
          category: draft.specs.moreInfo.category,
          brand: draft.specs.moreInfo.brand,
          collection: draft.collection,
          tags: draft.tags,
          status: draft.status,
          state: draft.state,
          pincode: draft.pincode,
          images: draft.images.map((src) => ({ src })),
          variants: draft.variants,
          specs: {
            ...specsToPayload(draft.specs),
          },
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok || json.error) {
        setError(json.error || "Unable to update product.");
        return;
      }
      setMessage("Product updated.");
      await load();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to update product. Please check server status and try again.";
      setError(message);
    } finally {
      setSavingProductId(null);
    }
  };

  const deleteVendorProduct = async (productId: number) => {
    const res = await fetch(`/api/vendor/products?id=${productId}`, { method: "DELETE" });
    const json = await readJsonSafe(res);
    if (!res.ok || json.error) {
      setError(json.error || "Unable to delete product.");
      return;
    }
    setMessage("Product deleted.");
    await load();
  };

  return (
    <section className={`admin__panel vendor-admin-theme ${vendorTheme === "light" ? "vendor-admin-theme--light" : "vendor-admin-theme--dark"}`}>
      {!editorOnly ? (
        <div className="vendor-admin__topbar">
          <div className="vendor-admin__left-nav">
            <button
              className={`vendor-admin__nav-btn ${activePanel === "addProduct" ? "is-active" : ""}`}
              onClick={() => setActivePanel("addProduct")}
              type="button"
            >
              Add Product
            </button>
            <button
              className={`vendor-admin__nav-btn ${activePanel === "yourProducts" ? "is-active" : ""}`}
              onClick={() => setActivePanel("yourProducts")}
              type="button"
            >
              Your Products
            </button>
            <button
              className={`vendor-admin__nav-btn ${activePanel === "manageSpecs" ? "is-active" : ""}`}
              onClick={() => setActivePanel("manageSpecs")}
              type="button"
            >
              Technical Specifications
            </button>
            <button
              className={`vendor-admin__nav-btn ${activePanel === "ordersCaptured" ? "is-active" : ""}`}
              onClick={() => setActivePanel("ordersCaptured")}
              type="button"
            >
              Orders Captured
            </button>
            <button
              className={`vendor-admin__nav-btn ${activePanel === "sheetProducts" ? "is-active" : ""}`}
              onClick={() => setActivePanel("sheetProducts")}
              type="button"
            >
              Google Sheet Products
            </button>
            <span className="vendor-credit-balance-icon" title="Credit balance summary">
              Rs {ordersSummary.creditBalance.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="vendor-admin__right-actions">
            <button className="theme-toggle-icon" type="button" onClick={toggleVendorTheme} title="Toggle theme">
              {vendorTheme === "dark" ? "☀" : "☾"}
            </button>
            <button
              className="vendor-admin__profile-btn"
              onClick={() => setProfileOpen((v) => !v)}
              title="Vendor Profile"
              type="button"
            >
              VP
            </button>
            <button className="ghost vendor-admin__logout-btn" onClick={logout} type="button" title="Logout" aria-label="Logout">⎋</button>
          </div>
        </div>
      ) : null}
      {error ? <p style={{ color: "#b73333" }}>{error}</p> : null}
      {message ? <p style={{ color: "#0c8f4f" }}>{message}</p> : null}

      {vendor ? (
        <>
          {profileOpen ? (
            <div className="vendor-profile-drawer-wrap" role="dialog" aria-modal="true">
              <button
                type="button"
                className="vendor-profile-drawer-backdrop"
                aria-label="Close profile panel"
                onClick={() => setProfileOpen(false)}
              />
              <aside className="vendor-modal admin__card vendor-admin__profile-card">
                <div className="vendor-profile-drawer__head">
                  <h3>Vendor Profile</h3>
                  <button className="ghost" type="button" onClick={() => setProfileOpen(false)}>
                    Close
                  </button>
                </div>
                <div className="admin__form">
                  <input value={vendor.email} disabled />
                  <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Vendor name" />
                  <input value={statesInput} onChange={(e) => setStatesInput(e.target.value)} placeholder="States (comma separated)" />
                  <button className="secondary" onClick={saveProfile} type="button">Save Profile</button>
                  <h4 style={{ marginTop: "0.35rem" }}>Update Password</h4>
                  <button className="secondary" type="button" onClick={sendPasswordResetCode} disabled={sendingPasswordCode}>
                    {sendingPasswordCode ? "Sending code..." : "Send Verification Code"}
                  </button>
                  <input value={passwordCode} onChange={(e) => setPasswordCode(e.target.value)} placeholder="Verification code" />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" />
                  <button className="secondary" type="button" onClick={updatePasswordWithCode} disabled={resettingPassword}>
                    {resettingPassword ? "Updating..." : "Update Password"}
                  </button>
                  <button className="ghost" type="button" onClick={logout}>
                    Logout
                  </button>
                </div>
              </aside>
            </div>
          ) : null}

          {activePanel === "addProduct" ? (
          <article className="admin__card vendor-admin__content-card" style={{ marginTop: "1rem" }}>
            <h3>Add Product (Images, Variants, Specs)</h3>
            <div className="vendor-products-toolbar">
              <button type="button" className="secondary vendor-csv-btn" onClick={downloadCsvTemplate}>
                Download CSV Template
              </button>
              <label className="secondary vendor-csv-btn" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", cursor: "pointer" }}>
                {bulkUploading ? "Uploading CSV..." : "Bulk Upload CSV"}
                <input type="file" accept=".csv,text/csv" onChange={handleBulkCsvUpload} style={{ display: "none" }} />
              </label>
            </div>
            <div className="admin__form">
              <input value={newProduct.title} onChange={(e) => setNewProduct((p) => ({ ...p, title: e.target.value }))} placeholder="Product title" />
              <input value={newProductSlug} placeholder="Slug (auto)" readOnly />
              <input value={newProductSlug ? `/store/${newProductSlug}` : "/store/<slug>"} placeholder="Product URL" readOnly />
              <select value={newProduct.collection} onChange={(e) => setNewProduct((p) => ({ ...p, collection: e.target.value }))}>
                <option value="">Select Collection</option>
                {collectionOptions.map((option) => (
                  <option key={`new-collection-${option.id}`} value={option.handle}>
                    {option.title}
                  </option>
                ))}
              </select>
              <select
                value={`${newProduct.state}__${newProduct.pincode}`}
                onChange={(e) => {
                  const [state, pincode] = String(e.target.value || "__").split("__");
                  setNewProduct((p) => ({ ...p, state: state || "", pincode: pincode || "" }));
                }}
              >
                <option value="__">Select service location</option>
                {locationOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
              <input value={newProduct.tags} onChange={(e) => setNewProduct((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (optional)" />

              <label>Upload Images (multiple)</label>
              <input type="file" accept="image/*" multiple onChange={handleNewProductImageUpload} />
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {newProduct.images.map((src) => (
                  <div key={src} style={{ position: "relative" }}>
                    <img src={src} alt="uploaded" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }} />
                    <button
                      type="button"
                      className="ghost"
                      style={{ position: "absolute", top: -8, right: -8, minHeight: "unset", padding: "0.1rem 0.4rem" }}
                      onClick={() => setNewProduct((p) => ({ ...p, images: p.images.filter((item) => item !== src) }))}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>

              <h4>Variants</h4>
              {newProduct.variants.map((variant, index) => (
                <div key={`new-variant-${index}`} className="admin__card" style={{ padding: "0.6rem" }}>
                  <input value={variant.title} onChange={(e) => setNewProduct((p) => {
                    const next = [...p.variants];
                    next[index] = { ...next[index], title: e.target.value };
                    return { ...p, variants: next };
                  })} placeholder="Variant title" />
                  <input value={variant.price} onChange={(e) => setNewProduct((p) => {
                    const next = [...p.variants];
                    next[index] = { ...next[index], price: e.target.value };
                    return { ...p, variants: next };
                  })} placeholder="Price" />
                  <input value={variant.compare_at_price} onChange={(e) => setNewProduct((p) => {
                    const next = [...p.variants];
                    next[index] = { ...next[index], compare_at_price: e.target.value };
                    return { ...p, variants: next };
                  })} placeholder="Compare at price" />
                  <input value={String(variant.inventory_quantity)} onChange={(e) => setNewProduct((p) => {
                    const next = [...p.variants];
                    next[index] = { ...next[index], inventory_quantity: Number(e.target.value || 0) };
                    return { ...p, variants: next };
                  })} placeholder="Inventory quantity" />
                  <button type="button" className="ghost" onClick={() => setNewProduct((p) => ({ ...p, variants: p.variants.filter((_, i) => i !== index) }))}>Remove Variant</button>
                </div>
              ))}
              <button type="button" className="secondary" onClick={() => setNewProduct((p) => ({
                ...p,
                variants: [...p.variants, { title: "Variant", price: "0", compare_at_price: "", inventory_quantity: 0 }],
              }))}>Add Variant</button>

              <h4>Technical Specifications</h4>
              <h5>Performance (Mandatory)</h5>
              <select value={newProduct.specs.performance.memoryTechnology} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, performance: { ...p.specs.performance, memoryTechnology: e.target.value } } }))} required>
                <option value="">Select Memory Technology</option>
                {memoryTechOptions.map((option) => <option key={`new-memory-${option}`} value={option}>{option}</option>)}
              </select>
              <select value={newProduct.specs.performance.displayResolution} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, performance: { ...p.specs.performance, displayResolution: e.target.value } } }))} required>
                <option value="">Select Display Resolution</option>
                {displayResolutionOptions.map((option) => <option key={`new-display-${option}`} value={option}>{option}</option>)}
              </select>
              <select value={newProduct.specs.performance.processorFamily} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, performance: { ...p.specs.performance, processorFamily: e.target.value } } }))} required>
                <option value="">Select Processor Family</option>
                {processorFamilyOptions.map((option) => <option key={`new-processor-${option}`} value={option}>{option}</option>)}
              </select>
              <select value={newProduct.specs.performance.graphicsCardType} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, performance: { ...p.specs.performance, graphicsCardType: e.target.value } } }))} required>
                <option value="">Select Graphics Card Type</option>
                {graphicsCardTypeOptions.map((option) => <option key={`new-graphics-${option}`} value={option}>{option}</option>)}
              </select>
              <select value={newProduct.specs.performance.storageTypesSupported} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, performance: { ...p.specs.performance, storageTypesSupported: e.target.value } } }))} required>
                <option value="">Select Storage Types Supported</option>
                {storageTypesOptions.map((option) => <option key={`new-storage-${option}`} value={option}>{option}</option>)}
              </select>

              <h5>Software (Mandatory)</h5>
              <select value={newProduct.specs.software.cosmeticCondition} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, software: { cosmeticCondition: e.target.value } } }))} required>
                <option value="">Select Cosmetic Condition</option>
                {cosmeticConditionOptions.map((option) => <option key={`new-cosmetic-${option}`} value={option}>{option}</option>)}
              </select>

              <h5>More Info (Mandatory)</h5>
              <input value={newProduct.specs.moreInfo.colorPattern} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, moreInfo: { ...p.specs.moreInfo, colorPattern: e.target.value } } }))} placeholder="Color Pattern" required />
              <input value={newProduct.specs.moreInfo.operatingSystem} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, moreInfo: { ...p.specs.moreInfo, operatingSystem: e.target.value } } }))} placeholder="Operating System" required />
              <input value={newProduct.specs.moreInfo.connectionType} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, moreInfo: { ...p.specs.moreInfo, connectionType: e.target.value } } }))} placeholder="Connection Type" required />
              <input value={newProduct.specs.moreInfo.keyboardType} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, moreInfo: { ...p.specs.moreInfo, keyboardType: e.target.value } } }))} placeholder="Keyboard Type" required />
              <select value={newProduct.specs.moreInfo.brand} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, moreInfo: { ...p.specs.moreInfo, brand: e.target.value } } }))} required>
                <option value="">Select Brand</option>
                {brandOptions.map((option) => <option key={`new-brand-${option}`} value={option}>{option}</option>)}
              </select>
              <select value={newProduct.specs.moreInfo.model} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, moreInfo: { ...p.specs.moreInfo, model: e.target.value } } }))} required>
                <option value="">Select Model</option>
                {modelOptions.map((option) => <option key={`new-model-${option}`} value={option}>{option}</option>)}
              </select>
              <select value={newProduct.specs.moreInfo.category} onChange={(e) => setNewProduct((p) => ({ ...p, specs: { ...p.specs, moreInfo: { ...p.specs.moreInfo, category: e.target.value } } }))} required>
                <option value="">Select Category</option>
                {categoryOptions.map((option) => <option key={`new-category-${option}`} value={option}>{option}</option>)}
              </select>

              <button className="primary" onClick={createVendorProduct}>Create Product</button>
            </div>
          </article>
          ) : null}

          {activePanel === "yourProducts" ? (
          <article className="admin__card vendor-admin__content-card" style={{ marginTop: "1rem" }}>
            <h3>Products ({products.length})</h3>
            {!editorOnly ? <div className="vendor-products-toolbar">
              <select
                value={productStatusFilter}
                onChange={(e) => setProductStatusFilter(e.target.value as "all" | "active" | "draft" | "archived")}
                style={{ maxWidth: 160 }}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search and filter"
                style={{ minWidth: 240, flex: 1 }}
              />
              <button type="button" className="secondary" onClick={exportProductsCsv}>
                Export
              </button>
              <button type="button" className="secondary" onClick={editSelectedProducts} disabled={!selectedProductIds.length}>
                Edit Selected ({selectedProductIds.length})
              </button>
              <button type="button" className="secondary" onClick={duplicateSelectedProducts} disabled={!selectedProductIds.length}>
                Duplicate Selected ({selectedProductIds.length})
              </button>
              <button type="button" className="ghost" onClick={deleteSelectedProducts} disabled={!selectedProductIds.length}>
                Delete Selected ({selectedProductIds.length})
              </button>
              <button type="button" className="secondary vendor-csv-btn" onClick={downloadCsvTemplate}>
                Download CSV Template
              </button>
              <label className="secondary vendor-csv-btn" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", cursor: "pointer" }}>
                {bulkUploading ? "Uploading CSV..." : "Bulk Upload CSV"}
                <input type="file" accept=".csv,text/csv" onChange={handleBulkCsvUpload} style={{ display: "none" }} />
              </label>
            </div> : null}
            {!editorOnly ? <div className="vendor-products-table-wrap">
              <table className="vendor-products-table">
                <thead>
                  <tr>
                    <th style={{ width: 42 }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredProducts.length > 0 &&
                          filteredProducts.every((product) => selectedProductIds.includes(product.id))
                        }
                        onChange={toggleSelectAllFiltered}
                      />
                    </th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Inventory</th>
                    <th>Category</th>
                    <th>Product Type</th>
                    <th>Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const draft = productDrafts[product.id];
                    if (!draft) return null;
                    const inventory = (draft.variants || []).reduce((sum, variant) => sum + Number(variant.inventory_quantity || 0), 0);
                    const variantCount = draft.variants?.length || 0;
                    return (
                      <tr
                        key={`row-${product.id}`}
                        className={selectedProductId === product.id ? "is-selected" : ""}
                        onClick={() => router.push(`/vendor-admin/product/${product.id}`)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => toggleProductSelection(product.id)}
                          />
                        </td>
                        <td>
                          <div className="vendor-products-table__product">
                            <img
                              src={draft.images[0] || "/uploads/vendor/placeholder.png"}
                              alt={draft.title}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = "/uploads/vendor/placeholder.png";
                              }}
                            />
                            <div>
                              <strong>{draft.title || product.title}</strong>
                              <small>#{product.id}</small>
                              {(product.metafields || []).some(
                                (entry) =>
                                  entry.namespace === "integration" &&
                                  entry.key === "synced_from_sheet" &&
                                  String(entry.value || "").toLowerCase() === "true"
                              ) ? <small>Synced from Sheet</small> : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`vendor-status-badge status-${draft.status || "active"}`}>{draft.status || "active"}</span>
                        </td>
                        <td>{inventory} in stock for {variantCount} variant{variantCount === 1 ? "" : "s"}</td>
                        <td>{draft.specs.moreInfo.category || "-"}</td>
                        <td>{draft.specs.moreInfo.brand || "-"}</td>
                        <td>{product.vendor || vendor?.name || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredProducts.length ? <p style={{ marginTop: "0.8rem" }}>No products found for current filter.</p> : null}
            </div> : null}
            {editorOnly && selectedProductId && productDrafts[selectedProductId] ? (() => {
              const product = products.find((item) => item.id === selectedProductId);
              if (!product) return null;
              const draft = productDrafts[selectedProductId];
              return (
                <div key={product.id} className="admin__card vendor-product-card" style={{ marginTop: "1rem", marginBottom: "0.8rem", padding: "0.9rem" }}>
                  {editorOnly ? <h3>{draft.title || product.title} - #{product.id}</h3> : null}
                  <p className="vendor-product-card__meta"><strong>#{product.id}</strong> | Vendor: {product.vendor || vendor.name}</p>
                  <input value={draft.title} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, title: e.target.value } }))} placeholder="Title" />
                  <input value={slugify(draft.title || product.handle || "")} placeholder="Slug (auto)" readOnly />
                  <input
                    value={`/store/${slugify(draft.title || product.handle || "") || product.handle || product.id}`}
                    placeholder="Product URL"
                    readOnly
                  />
                  <select value={draft.collection} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, collection: e.target.value } }))}>
                    <option value="">Select Collection</option>
                    {collectionOptions.map((option) => (
                      <option key={`${product.id}-collection-${option.id}`} value={option.handle}>
                        {option.title}
                      </option>
                    ))}
                  </select>
                  <input value={draft.tags} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, tags: e.target.value } }))} placeholder="Tags" />
                  <select value={draft.status} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, status: e.target.value } }))}>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                  <select value={`${draft.state}__${draft.pincode}`} onChange={(e) => {
                    const [state, pincode] = String(e.target.value || "__").split("__");
                    setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, state: state || "", pincode: pincode || "" } }));
                  }}>
                    <option value="__">Select service location</option>
                    {locationOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>

                  <label>Upload Images (multiple)</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => handleEditProductImageUpload(product.id, e)} />
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {draft.images.map((src) => (
                      <div key={src} style={{ position: "relative" }}>
                        <img src={src} alt="uploaded" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
                        <button
                          type="button"
                          className="ghost"
                          style={{ position: "absolute", top: -8, right: -8, minHeight: "unset", padding: "0.1rem 0.4rem" }}
                          onClick={() =>
                            setProductDrafts((prev) => ({
                              ...prev,
                              [product.id]: { ...draft, images: draft.images.filter((item) => item !== src) },
                            }))
                          }
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>

                  <h4>Variants</h4>
                  {draft.variants.map((variant, index) => (
                    <div key={`edit-variant-${product.id}-${index}`} className="admin__card vendor-product-card__variant" style={{ padding: "0.6rem" }}>
                      <input value={variant.title} onChange={(e) => setProductDrafts((prev) => {
                        const nextVariants = [...draft.variants];
                        nextVariants[index] = { ...nextVariants[index], title: e.target.value };
                        return { ...prev, [product.id]: { ...draft, variants: nextVariants } };
                      })} placeholder="Variant title" />
                      <input value={variant.price} onChange={(e) => setProductDrafts((prev) => {
                        const nextVariants = [...draft.variants];
                        nextVariants[index] = { ...nextVariants[index], price: e.target.value };
                        return { ...prev, [product.id]: { ...draft, variants: nextVariants } };
                      })} placeholder="Price" />
                      <input value={variant.compare_at_price} onChange={(e) => setProductDrafts((prev) => {
                        const nextVariants = [...draft.variants];
                        nextVariants[index] = { ...nextVariants[index], compare_at_price: e.target.value };
                        return { ...prev, [product.id]: { ...draft, variants: nextVariants } };
                      })} placeholder="Compare at price" />
                      <input value={String(variant.inventory_quantity)} onChange={(e) => setProductDrafts((prev) => {
                        const nextVariants = [...draft.variants];
                        nextVariants[index] = { ...nextVariants[index], inventory_quantity: Number(e.target.value || 0) };
                        return { ...prev, [product.id]: { ...draft, variants: nextVariants } };
                      })} placeholder="Inventory quantity" />
                      <button type="button" className="ghost" onClick={() => setProductDrafts((prev) => ({
                        ...prev,
                        [product.id]: { ...draft, variants: draft.variants.filter((_, i) => i !== index) },
                      }))}>Remove Variant</button>
                    </div>
                  ))}
                  <button type="button" className="secondary" onClick={() => setProductDrafts((prev) => ({
                    ...prev,
                    [product.id]: {
                      ...draft,
                      variants: [...draft.variants, { title: "Variant", price: "0", compare_at_price: "", inventory_quantity: 0 }],
                    },
                  }))}>Add Variant</button>

                  <h4>Technical Specifications</h4>
                  <h5>Performance (Mandatory)</h5>
                  <select value={draft.specs.performance.memoryTechnology} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, performance: { ...draft.specs.performance, memoryTechnology: e.target.value } } } }))} required>
                    <option value="">Select Memory Technology</option>
                    {memoryTechOptions.map((option) => <option key={`${product.id}-memory-${option}`} value={option}>{option}</option>)}
                  </select>
                  <select value={draft.specs.performance.displayResolution} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, performance: { ...draft.specs.performance, displayResolution: e.target.value } } } }))} required>
                    <option value="">Select Display Resolution</option>
                    {displayResolutionOptions.map((option) => <option key={`${product.id}-display-${option}`} value={option}>{option}</option>)}
                  </select>
                  <select value={draft.specs.performance.processorFamily} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, performance: { ...draft.specs.performance, processorFamily: e.target.value } } } }))} required>
                    <option value="">Select Processor Family</option>
                    {processorFamilyOptions.map((option) => <option key={`${product.id}-processor-${option}`} value={option}>{option}</option>)}
                  </select>
                  <select value={draft.specs.performance.graphicsCardType} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, performance: { ...draft.specs.performance, graphicsCardType: e.target.value } } } }))} required>
                    <option value="">Select Graphics Card Type</option>
                    {graphicsCardTypeOptions.map((option) => <option key={`${product.id}-graphics-${option}`} value={option}>{option}</option>)}
                  </select>
                  <select value={draft.specs.performance.storageTypesSupported} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, performance: { ...draft.specs.performance, storageTypesSupported: e.target.value } } } }))} required>
                    <option value="">Select Storage Types Supported</option>
                    {storageTypesOptions.map((option) => <option key={`${product.id}-storage-${option}`} value={option}>{option}</option>)}
                  </select>

                  <h5>Software (Mandatory)</h5>
                  <select value={draft.specs.software.cosmeticCondition} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, software: { cosmeticCondition: e.target.value } } } }))} required>
                    <option value="">Select Cosmetic Condition</option>
                    {cosmeticConditionOptions.map((option) => <option key={`${product.id}-cosmetic-${option}`} value={option}>{option}</option>)}
                  </select>

                  <h5>More Info (Mandatory)</h5>
                  <input value={draft.specs.moreInfo.colorPattern} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, moreInfo: { ...draft.specs.moreInfo, colorPattern: e.target.value } } } }))} placeholder="Color Pattern" required />
                  <input value={draft.specs.moreInfo.operatingSystem} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, moreInfo: { ...draft.specs.moreInfo, operatingSystem: e.target.value } } } }))} placeholder="Operating System" required />
                  <input value={draft.specs.moreInfo.connectionType} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, moreInfo: { ...draft.specs.moreInfo, connectionType: e.target.value } } } }))} placeholder="Connection Type" required />
                  <input value={draft.specs.moreInfo.keyboardType} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, moreInfo: { ...draft.specs.moreInfo, keyboardType: e.target.value } } } }))} placeholder="Keyboard Type" required />
                  <select value={draft.specs.moreInfo.brand} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, moreInfo: { ...draft.specs.moreInfo, brand: e.target.value } } } }))} required>
                    <option value="">Select Brand</option>
                    {brandOptions.map((option) => <option key={`${product.id}-brand-${option}`} value={option}>{option}</option>)}
                  </select>
                  <select value={draft.specs.moreInfo.model} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, moreInfo: { ...draft.specs.moreInfo, model: e.target.value } } } }))} required>
                    <option value="">Select Model</option>
                    {modelOptions.map((option) => <option key={`${product.id}-model-${option}`} value={option}>{option}</option>)}
                  </select>
                  <select value={draft.specs.moreInfo.category} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [product.id]: { ...draft, specs: { ...draft.specs, moreInfo: { ...draft.specs.moreInfo, category: e.target.value } } } }))} required>
                    <option value="">Select Category</option>
                    {categoryOptions.map((option) => <option key={`${product.id}-category-${option}`} value={option}>{option}</option>)}
                  </select>

                  <div className="vendor-product-card__actions">
                    <button className="secondary" disabled={savingProductId === product.id} onClick={() => updateVendorProduct(product.id)}>
                      {savingProductId === product.id ? "Saving..." : "Save Product"}
                    </button>
                    <button className="secondary" type="button" onClick={() => duplicateVendorProduct(product.id)}>Duplicate Product</button>
                    <button className="ghost" onClick={() => deleteVendorProduct(product.id)}>Delete Product</button>
                  </div>
                </div>
              );
            })() : editorOnly ? <p style={{ marginTop: "0.8rem" }}>Product not found.</p> : <p style={{ marginTop: "0.8rem" }}>Select a product row to edit.</p>}
          </article>
          ) : null}

          {activePanel === "manageSpecs" ? (
          <article className="admin__card vendor-admin__content-card" style={{ marginTop: "1rem" }}>
            <h3>Technical Specifications</h3>
            <div className="admin__grid">
              <div className="vendor-taxonomy-card">
                <h4>Memory Technology</h4>
                <div className="vendor-taxonomy-row">
                  <input value={memoryTechInput} onChange={(e) => setMemoryTechInput(e.target.value)} placeholder="Add memory technology option" />
                  <button type="button" className="secondary" onClick={() => addOption(memoryTechInput, memoryTechOptions, setMemoryTechOptions, "vendor_spec_memory_technology", () => setMemoryTechInput(""))}>Add</button>
                </div>
                <p>{memoryTechOptions.length ? memoryTechOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Display Resolution</h4>
                <div className="vendor-taxonomy-row">
                  <input value={displayResolutionInput} onChange={(e) => setDisplayResolutionInput(e.target.value)} placeholder="Add display resolution option" />
                  <button type="button" className="secondary" onClick={() => addOption(displayResolutionInput, displayResolutionOptions, setDisplayResolutionOptions, "vendor_spec_display_resolution", () => setDisplayResolutionInput(""))}>Add</button>
                </div>
                <p>{displayResolutionOptions.length ? displayResolutionOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Processor Family</h4>
                <div className="vendor-taxonomy-row">
                  <input value={processorFamilyInput} onChange={(e) => setProcessorFamilyInput(e.target.value)} placeholder="Add processor family option" />
                  <button type="button" className="secondary" onClick={() => addOption(processorFamilyInput, processorFamilyOptions, setProcessorFamilyOptions, "vendor_spec_processor_family", () => setProcessorFamilyInput(""))}>Add</button>
                </div>
                <p>{processorFamilyOptions.length ? processorFamilyOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Graphics Card Type</h4>
                <div className="vendor-taxonomy-row">
                  <input value={graphicsCardTypeInput} onChange={(e) => setGraphicsCardTypeInput(e.target.value)} placeholder="Add graphics card type option" />
                  <button type="button" className="secondary" onClick={() => addOption(graphicsCardTypeInput, graphicsCardTypeOptions, setGraphicsCardTypeOptions, "vendor_spec_graphics_card_type", () => setGraphicsCardTypeInput(""))}>Add</button>
                </div>
                <p>{graphicsCardTypeOptions.length ? graphicsCardTypeOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Storage Types Supported</h4>
                <div className="vendor-taxonomy-row">
                  <input value={storageTypesInput} onChange={(e) => setStorageTypesInput(e.target.value)} placeholder="Add storage types option" />
                  <button type="button" className="secondary" onClick={() => addOption(storageTypesInput, storageTypesOptions, setStorageTypesOptions, "vendor_spec_storage_types_supported", () => setStorageTypesInput(""))}>Add</button>
                </div>
                <p>{storageTypesOptions.length ? storageTypesOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Cosmetic Condition</h4>
                <div className="vendor-taxonomy-row">
                  <input value={cosmeticConditionInput} onChange={(e) => setCosmeticConditionInput(e.target.value)} placeholder="Add cosmetic condition option" />
                  <button type="button" className="secondary" onClick={() => addOption(cosmeticConditionInput, cosmeticConditionOptions, setCosmeticConditionOptions, "vendor_spec_cosmetic_condition", () => setCosmeticConditionInput(""))}>Add</button>
                </div>
                <p>{cosmeticConditionOptions.length ? cosmeticConditionOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Brand</h4>
                <div className="vendor-taxonomy-row">
                  <input value={brandInput} onChange={(e) => setBrandInput(e.target.value)} placeholder="Add brand option" />
                  <button type="button" className="secondary" onClick={() => addOption(brandInput, brandOptions, setBrandOptions, "vendor_brand_options", () => setBrandInput(""))}>Add</button>
                </div>
                <p>{brandOptions.length ? brandOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Model</h4>
                <div className="vendor-taxonomy-row">
                  <input value={modelInput} onChange={(e) => setModelInput(e.target.value)} placeholder="Add model option" />
                  <button type="button" className="secondary" onClick={() => addOption(modelInput, modelOptions, setModelOptions, "vendor_model_options", () => setModelInput(""))}>Add</button>
                </div>
                <p>{modelOptions.length ? modelOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Category</h4>
                <div className="vendor-taxonomy-row">
                  <input value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} placeholder="Add category option" />
                  <button type="button" className="secondary" onClick={() => addOption(categoryInput, categoryOptions, setCategoryOptions, "vendor_category_options", () => setCategoryInput(""))}>Add</button>
                </div>
                <p>{categoryOptions.length ? categoryOptions.join(", ") : "No options yet."}</p>
              </div>
              <div className="vendor-taxonomy-card">
                <h4>Collections</h4>
                <div className="vendor-taxonomy-row">
                  <input value={collectionInput} onChange={(e) => setCollectionInput(e.target.value)} placeholder="Add collection option" />
                  <button type="button" className="secondary" onClick={addCollectionOption}>Add</button>
                </div>
                <p>
                  {collectionOptions.length
                    ? collectionOptions.map((item) => item.title).join(", ")
                    : "No options yet."}
                </p>
              </div>
            </div>
          </article>
          ) : null}

          {activePanel === "ordersCaptured" ? (
          <article className="admin__card vendor-admin__content-card" style={{ marginTop: "1rem" }}>
              <h3>Orders Captured</h3>
              <div className="vendor-products-toolbar">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as "all" | "successful" | "failure" | "draft")}
                >
                  <option value="all">All orders</option>
                  <option value="successful">Successful</option>
                  <option value="failure">Failure</option>
                  <option value="draft">Draft</option>
                </select>
                <select
                  value={orderDateRange}
                  onChange={(e) => setOrderDateRange(e.target.value as "today" | "7" | "30")}
                >
                  <option value="today">Today</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </div>
              <div className="vendor-orders-summary-grid">
              <div className="vendor-orders-summary-card">
                <label>Gross Sales</label>
                <strong>Rs {ordersSummary.grossAmount.toLocaleString("en-IN")}</strong>
              </div>
              <div className="vendor-orders-summary-card">
                <label>Commission ({ordersSummary.commissionPercent}%)</label>
                <strong>Rs {ordersSummary.commissionAmount.toLocaleString("en-IN")}</strong>
              </div>
              <div className="vendor-orders-summary-card">
                <label>Credit Balance</label>
                <strong>Rs {ordersSummary.creditBalance.toLocaleString("en-IN")}</strong>
              </div>
            </div>
            <div className="vendor-products-table-wrap" style={{ marginTop: "0.8rem" }}>
              <table className="vendor-products-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Address</th>
                    <th>Vendor Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={`vendor-order-${order.id}`} onClick={() => setSelectedOrder(order)}>
                      <td>
                        <strong>{order.name}</strong>
                        <small>#{order.id}</small>
                      </td>
                      <td>
                        <span className={`vendor-status-badge status-${
                          String(order.rawStatus || order.financialStatus || "").toLowerCase() === "failed"
                            ? "archived"
                            : order.financialStatus === "paid"
                              ? "active"
                              : "draft"
                        }`}>
                          {order.rawStatus || order.financialStatus}
                        </span>
                      </td>
                      <td>
                        <strong>{order.customerName}</strong>
                        <small>{order.customerEmail}</small>
                      </td>
                      <td>{order.customerMobile || "-"}</td>
                      <td>{order.customerAddress || "-"}</td>
                      <td>Rs {Number(order.vendorAmount || 0).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredOrders.length ? <p style={{ marginTop: "0.8rem" }}>No captured orders for current filter.</p> : null}
            {selectedOrder ? (
              <div className="vendor-profile-drawer-wrap" role="dialog" aria-modal="true">
                <button
                  type="button"
                  className="vendor-profile-drawer-backdrop"
                  aria-label="Close order detail"
                  onClick={() => setSelectedOrder(null)}
                />
                <aside className="vendor-modal admin__card vendor-admin__profile-card">
                  <div className="vendor-profile-drawer__head">
                    <h3>Order Detail</h3>
                    <button className="ghost" type="button" onClick={() => setSelectedOrder(null)}>
                      Close
                    </button>
                  </div>
                  <div className="admin__form">
                    <input value={`${selectedOrder.name} #${selectedOrder.id}`} readOnly />
                    <input value={selectedOrder.rawStatus || selectedOrder.financialStatus} readOnly />
                    <input value={selectedOrder.customerName} readOnly />
                    <input value={selectedOrder.customerEmail} readOnly />
                    <input value={selectedOrder.customerMobile || "-"} readOnly />
                    <textarea value={selectedOrder.customerAddress || "-"} readOnly rows={3} />
                    <input value={`Vendor amount: Rs ${Number(selectedOrder.vendorAmount || 0).toLocaleString("en-IN")}`} readOnly />
                  </div>
                </aside>
              </div>
            ) : null}
          </article>
          ) : null}

          {activePanel === "sheetProducts" ? (
          <article className="admin__card vendor-admin__content-card" style={{ marginTop: "1rem" }}>
              <h3>Google Sheet Products</h3>
              <p>Assigned by CMS admin. Vendor login email is auto-used for sync. Google sign-in is optional for direct Google access.</p>
              {!sheetLink?.googleConnected ? (
                <div className="vendor-products-toolbar" style={{ marginBottom: "0.8rem" }}>
                  <a
                    className="secondary"
                    href="/api/vendor/google-sheet/oauth/start"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                  >
                    Sign in with Google
                  </a>
                  <button type="button" className="secondary" onClick={downloadCsvTemplate}>
                    Download Sheet CSV Template
                  </button>
                  <label className="secondary" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", cursor: "pointer" }}>
                    {bulkUploading ? "Uploading CSV..." : "Upload Filled CSV"}
                    <input type="file" accept=".csv,text/csv" onChange={handleBulkCsvUpload} style={{ display: "none" }} />
                  </label>
                </div>
              ) : null}
              <div className="vendor-products-toolbar" style={{ alignItems: "stretch" }}>
                <input readOnly value={sheetLink?.sheetName || "No sheet assigned"} />
                <input
                  readOnly
                  value={sheetLink?.sheetUrl || "Sheet URL unavailable"}
                  title={sheetLink?.sheetUrl || "Sheet URL unavailable"}
                  style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
                />
                {sheetLink?.sheetUrl ? (
                  <a
                    className="ghost"
                    href={sheetLink.sheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                  >
                    Open Sheet
                  </a>
                ) : null}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void syncAssignedSheet()}
                >
                  Sync Products
                </button>
              </div>
              {sheetLink?.sheetId ? (
                <div className="vendor-products-toolbar" style={{ marginTop: "0.55rem" }}>
                  <input
                    value={accessRequestEmail}
                    onChange={(e) => setAccessRequestEmail(e.target.value)}
                    placeholder="Request access with Google email"
                  />
                  <button type="button" className="ghost" onClick={() => void requestSheetAccess()}>
                    Request Access
                  </button>
                </div>
              ) : null}
              {sheetLink?.allowedGoogleEmails?.length ? (
                <div style={{ display: "grid", gap: "0.25rem", marginTop: "0.5rem" }}>
                  <small>Approved Google Access:</small>
                  <small>{sheetLink.allowedGoogleEmails.join(", ")}</small>
                </div>
              ) : null}
              {accessRequests.length ? (
                <div style={{ marginTop: "0.8rem" }} className="admin__table-wrap">
                  <table className="admin__table">
                    <thead>
                      <tr>
                        <th>Requested Google Email</th>
                        <th>Status</th>
                        <th>Requested At</th>
                        <th>Updated At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessRequests.map((req) => (
                        <tr key={req.id}>
                          <td>{req.requestedGoogleEmail}</td>
                          <td>{req.status}</td>
                          <td>{new Date(req.createdAt).toLocaleString("en-IN")}</td>
                          <td>{new Date(req.updatedAt).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: "0.3rem", marginTop: "0.55rem" }}>
                <small>
                  Status: {sheetLink?.syncStatus || "inactive"} | Last Sync:{" "}
                  {sheetLink?.lastSyncedAt ? new Date(sheetLink.lastSyncedAt).toLocaleString("en-IN") : "Never"}
                </small>
                <small>{sheetLink?.lastSyncMessage || "No sync activity yet."}</small>
              </div>
              <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.8rem" }}>
                {sheetLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="admin__card" style={{ padding: "0.55rem 0.7rem" }}>
                    <strong>{new Date(log.at).toLocaleString("en-IN")} - {log.status}</strong>
                    <p>{log.message}</p>
                    <small>Products processed: {log.productsProcessed}</small>
                  </div>
                ))}
              </div>
          </article>
          ) : null}
        </>
      ) : (
        <p>Loading vendor details...</p>
      )}
    </section>
  );
}
