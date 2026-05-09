"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CatalogProduct = {
  id: number;
  title: string;
  handle: string;
  status?: string;
  vendor?: string;
  product_type?: string;
  category?: string;
  tags?: string;
  description?: string;
  variants?: Array<{
    id?: number;
    title?: string;
    price: string;
    compare_at_price?: string | null;
    inventory_quantity?: number;
  }>;
};

type ProductVariantDraft = {
  id?: number;
  title: string;
  price: string;
  compare_at_price: string;
  inventory_quantity: string;
};

type Vendor = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
};

type AdminClientProps = {
  detailProductId?: string;
};

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptyForm = {
  title: "",
  handle: "",
  status: "active",
  vendor: "",
  product_type: "",
  category: "",
  tags: "",
  description: "",
};

const defaultVariantDraft: ProductVariantDraft = {
  title: "Default",
  price: "0",
  compare_at_price: "",
  inventory_quantity: "0",
};

export default function AdminClient({ detailProductId }: AdminClientProps) {
  const router = useRouter();
  const isDetailPage = typeof detailProductId === "string";
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [adminTheme, setAdminTheme] = useState<"dark" | "light">("dark");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [variants, setVariants] = useState<ProductVariantDraft[]>([defaultVariantDraft]);
  const [searchQuery, setSearchQuery] = useState("");

  const selected = useMemo(
    () => products.find((p) => String(p.id) === selectedId) || null,
    [products, selectedId]
  );
  const previewSlug = useMemo(
    () => slugify(form.handle || form.title || selected?.handle || ""),
    [form.handle, form.title, selected?.handle]
  );
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [
        product.title,
        product.handle,
        product.vendor,
        product.product_type,
        product.category,
        product.tags,
        product.status,
        String(product.id),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [products, searchQuery]);

  const loadProducts = async () => {
    const res = await fetch("/api/admin/catalog", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || "Unable to load products");
    const nextProducts = (json.products || []) as CatalogProduct[];
    setProducts(nextProducts);
    if (detailProductId === "new") {
      setSelectedId("");
      setForm(emptyForm);
      setVariants([defaultVariantDraft]);
      setShowEditor(true);
      return;
    }
    if (detailProductId && nextProducts.some((p) => String(p.id) === String(detailProductId))) {
      setSelectedId(String(detailProductId));
    }
  };

  const loadVendors = async () => {
    const res = await fetch("/api/admin/vendor-portal", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || "Unable to load vendors");
    const next = Array.isArray(json?.data?.vendors) ? (json.data.vendors as Vendor[]) : [];
    setVendors(next);
  };

  useEffect(() => {
    Promise.all([loadProducts(), loadVendors()]).catch((e) =>
      setError(e instanceof Error ? e.message : "Unable to load products")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailProductId]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pcgs_cms_admin_theme_mode");
      if (stored === "light" || stored === "dark") setAdminTheme(stored);
    } catch {
      setAdminTheme("dark");
    }
  }, []);

  const toggleAdminTheme = () => {
    const next = adminTheme === "dark" ? "light" : "dark";
    setAdminTheme(next);
    try {
      localStorage.setItem("pcgs_cms_admin_theme_mode", next);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (!selected) {
      if (detailProductId === "new") setShowEditor(true);
      return;
    }
    setShowEditor(true);
    setForm({
      title: selected.title || "",
      handle: selected.handle || "",
      status: selected.status || "active",
      vendor: selected.vendor || "",
      product_type: selected.product_type || "",
      category: selected.category || "",
      tags: selected.tags || "",
      description: selected.description || "",
    });
    const nextVariants =
      selected.variants && selected.variants.length
        ? selected.variants.map((variant) => ({
            id: variant.id,
            title: String(variant.title || "Default"),
            price: String(variant.price || "0"),
            compare_at_price: String(variant.compare_at_price || ""),
            inventory_quantity: String(variant.inventory_quantity ?? 0),
          }))
        : [defaultVariantDraft];
    setVariants(nextVariants);
    const vendorMatch =
      vendors.find((vendor) => vendor.name.trim().toLowerCase() === (selected.vendor || "").trim().toLowerCase()) ||
      null;
    setSelectedVendorId(vendorMatch?.id || "");
  }, [detailProductId, selected, vendors]);

  const productPayload = () => ({
    title: form.title,
    handle: form.handle,
    status: form.status,
    vendor: form.vendor,
    product_type: form.product_type,
    category: form.category,
    tags: form.tags,
    description: form.description,
    vendorId: selectedVendorId || undefined,
    variants: variants.map((variant) => ({
      id: variant.id,
      title: variant.title || "Default",
      price: variant.price || "0",
      compare_at_price: variant.compare_at_price || null,
      inventory_quantity: Number(variant.inventory_quantity || 0),
    })),
  });

  const createProduct = async () => {
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productPayload()),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Unable to create product");
      setMessage("Product created.");
      await loadProducts();
      const newId = String(json.product?.id || "");
      if (newId) {
        setSelectedId(newId);
        if (detailProductId === "new") router.replace(`/admin/products/${newId}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create product");
    }
  };

  const updateProduct = async () => {
    if (!selectedId) return;
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/admin/catalog/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productPayload()),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Unable to update product");
      setMessage("Product updated.");
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update product");
    }
  };

  const deleteProductById = async (id: string) => {
    const res = await fetch(`/api/admin/catalog/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error || "Unable to delete product");
  };

  const deleteProduct = async () => {
    if (!selectedId) return;
    setMessage("");
    setError("");
    try {
      await deleteProductById(selectedId);
      setMessage("Product deleted.");
      setSelectedId("");
      await loadProducts();
      if (isDetailPage) router.push("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete product");
    }
  };

  const deleteSelectedProducts = async () => {
    setMessage("");
    setError("");
    if (!selectedIds.length) {
      setError("Select at least one product.");
      return;
    }
    try {
      for (const id of selectedIds) {
        // eslint-disable-next-line no-await-in-loop
        await deleteProductById(String(id));
      }
      setSelectedIds([]);
      setMessage("Selected products deleted.");
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete selected products");
    }
  };

  const downloadProductSampleCsv = () => {
    const csvSafe = (value: string) => `"${String(value || "").replace(/"/g, "\"\"")}"`;
    const header = [
      "group_key",
      "row_type",
      "title",
      "handle",
      "status",
      "vendor",
      "product_type",
      "category",
      "tags",
      "description",
      "variant_title",
      "variant_price",
      "compare_at_price",
      "inventory_quantity",
      "variants_json",
    ];
    const sample1 = [
      "hp-laptop-i5",
      "product",
      "HP Laptop i5",
      "hp-laptop-i5",
      "active",
      "PCGS",
      "HP",
      "Laptop",
      "featured, laptop",
      "Refurbished business laptop",
      "8GB / 256GB",
      "25000",
      "28000",
      "5",
      "",
    ];
    const sample2 = [
      "hp-laptop-i5",
      "variant",
      "",
      "hp-laptop-i5",
      "",
      "",
      "",
      "",
      "",
      "",
      "16GB / 512GB",
      "32000",
      "35000",
      "3",
      "",
    ];
    const sample3 = [
      "dell-laptop-i7",
      "product",
      "Dell Laptop i7",
      "dell-laptop-i7",
      "active",
      "PCGS",
      "Dell",
      "Laptop",
      "gaming",
      "High performance laptop",
      "",
      "",
      "",
      "",
      '[{"title":"16GB / 512GB","price":"54000","compare_at_price":"58000","inventory_quantity":2},{"title":"32GB / 1TB","price":"68000","compare_at_price":"72000","inventory_quantity":1}]',
    ];
    const csv = `${header.map(csvSafe).join(",")}\n${sample1.map(csvSafe).join(",")}\n${sample2
      .map(csvSafe)
      .join(",")}\n${sample3.map(csvSafe).join(",")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "products-sample-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleBulkProductUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      setError("CSV must contain header and at least one product row.");
      return;
    }
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
    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const grouped = new Map<
      string,
      {
        title: string;
        handle: string;
        status: string;
        vendor: string;
        product_type: string;
        category: string;
        tags: string;
        description: string;
        variants: Array<{
          title: string;
          price: string;
          compare_at_price: string | null;
          inventory_quantity: number;
        }>;
      }
    >();

    for (const rowLine of lines.slice(1)) {
      const cols = parseCsvLine(rowLine);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] || "";
      });
      const rowTitle = String(row.title || "").trim();
      const rowHandle = String(row.handle || "").trim();
      const groupKey = String(row.group_key || rowHandle || slugify(rowTitle)).trim();
      if (!groupKey) continue;
      const handle = rowHandle || slugify(rowTitle || groupKey);
      const existingGroup = grouped.get(groupKey) || {
        title: rowTitle || handle,
        handle,
        status: String(row.status || "active").trim() || "active",
        vendor: String(row.vendor || "").trim(),
        product_type: String(row.product_type || "").trim(),
        category: String(row.category || "").trim(),
        tags: String(row.tags || "").trim(),
        description: String(row.description || "").trim(),
        variants: [],
      };
      if (rowTitle) existingGroup.title = rowTitle;
      if (rowHandle) existingGroup.handle = rowHandle;
      if (String(row.status || "").trim()) existingGroup.status = String(row.status).trim();
      if (String(row.vendor || "").trim()) existingGroup.vendor = String(row.vendor).trim();
      if (String(row.product_type || "").trim()) existingGroup.product_type = String(row.product_type).trim();
      if (String(row.category || "").trim()) existingGroup.category = String(row.category).trim();
      if (String(row.tags || "").trim()) existingGroup.tags = String(row.tags).trim();
      if (String(row.description || "").trim()) existingGroup.description = String(row.description).trim();

      const rawJson = String(row.variants_json || "").trim();
      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson) as Array<Record<string, unknown>>;
          if (Array.isArray(parsed)) {
            parsed.forEach((variant) => {
              existingGroup.variants.push({
                title: String(variant.title || "Default").trim() || "Default",
                price: String(variant.price || "0").trim() || "0",
                compare_at_price: String(variant.compare_at_price || "").trim() || null,
                inventory_quantity: Number(variant.inventory_quantity || 0),
              });
            });
          }
        } catch {
          throw new Error(`Invalid variants_json for product group ${groupKey}.`);
        }
      } else {
        existingGroup.variants.push({
          title: String(row.variant_title || "Default").trim() || "Default",
          price: String(row.variant_price || "0").trim() || "0",
          compare_at_price: String(row.compare_at_price || "").trim() || null,
          inventory_quantity: Number(row.inventory_quantity || 0),
        });
      }
      grouped.set(groupKey, existingGroup);
    }

    let processed = 0;
    const existingMap = new Map(products.map((p) => [p.handle, p]));
    for (const group of grouped.values()) {
      const uniqueVariants = group.variants.filter(
        (variant, idx, arr) =>
          arr.findIndex(
            (v) =>
              v.title === variant.title &&
              v.price === variant.price &&
              String(v.compare_at_price || "") === String(variant.compare_at_price || "") &&
              Number(v.inventory_quantity || 0) === Number(variant.inventory_quantity || 0)
          ) === idx
      );
      const payload = {
        title: group.title || group.handle,
        handle: group.handle,
        status: group.status || "active",
        vendor: group.vendor,
        product_type: group.product_type,
        category: group.category,
        tags: group.tags,
        description: group.description,
        variants: uniqueVariants.length
          ? uniqueVariants
          : [
              {
                title: defaultVariantDraft.title,
                price: defaultVariantDraft.price,
                compare_at_price: defaultVariantDraft.compare_at_price || null,
                inventory_quantity: Number(defaultVariantDraft.inventory_quantity || 0),
              },
            ],
      };
      const existing = existingMap.get(payload.handle);
      const res = await fetch(existing ? `/api/admin/catalog/${existing.id}` : "/api/admin/catalog", {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || `Failed for product: ${payload.title}`);
      }
      processed += 1;
    }
    setMessage(`Bulk product upload completed. ${processed} product(s) processed.`);
    await loadProducts();
    event.target.value = "";
  };

  const addProduct = () => {
    if (!isDetailPage) {
      router.push("/admin/products/new");
      return;
    }
    setShowEditor(true);
    setSelectedId("");
    setSelectedVendorId("");
    setForm(emptyForm);
    setVariants([defaultVariantDraft]);
  };

  return (
    <div className={`admin__panel cms-admin-theme ${adminTheme === "light" ? "cms-admin-theme--light" : "cms-admin-theme--dark"}`}>
      {/*<div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.6rem" }}>
        <button className="theme-toggle-icon" type="button" onClick={toggleAdminTheme} title="Toggle theme">
          {adminTheme === "dark" ? "☀" : "☾"}
        </button>
      </div>*/}
      <h2>Products</h2>
      <p className="hero__subtext">
        Full product and variant control is managed in this CMS.
      </p>

      {isDetailPage ? (
        <div style={{ marginBottom: "0.7rem" }}>
          <button className="secondary" type="button" onClick={() => router.push("/admin")}>Back To Products</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.7rem", flexWrap: "wrap" }}>
            <button className="primary" type="button" onClick={addProduct}>Add Product</button>
            <button className="ghost" type="button" onClick={deleteSelectedProducts}>Delete Selected Product</button>
            <button className="secondary" type="button" onClick={downloadProductSampleCsv}>Download Sample CSV</button>
            <button className="secondary" type="button" onClick={() => csvInputRef.current?.click()}>Bulk Product Upload</button>
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleBulkProductUpload} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title, vendor, category, type, handle"
              style={{ minWidth: 340 }}
            />
          </div>
          <div className="vendor-products-table-wrap" style={{ marginBottom: "0.9rem" }}>
            <table className="vendor-products-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.includes(p.id))}
                      onChange={() =>
                        setSelectedIds((prev) =>
                          filteredProducts.every((p) => prev.includes(p.id))
                            ? prev.filter((id) => !filteredProducts.some((p) => p.id === id))
                            : Array.from(new Set([...prev, ...filteredProducts.map((p) => p.id)]))
                        )
                      }
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
                  const inv = (product.variants || []).reduce((sum, v) => sum + Number(v.inventory_quantity || 0), 0);
                  const variantCount = product.variants?.length || 0;
                  return (
                    <tr key={product.id} onClick={() => router.push(`/admin/products/${product.id}`)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() =>
                            setSelectedIds((prev) =>
                              prev.includes(product.id) ? prev.filter((id) => id !== product.id) : [...prev, product.id]
                            )
                          }
                        />
                      </td>
                      <td>
                        <strong>{product.title}</strong>
                        <small>#{product.id}</small>
                      </td>
                      <td>
                        <span className={`vendor-status-badge status-${product.status || "active"}`}>
                          {product.status || "active"}
                        </span>
                      </td>
                      <td>{inv} in stock for {variantCount} variant{variantCount === 1 ? "" : "s"}</td>
                      <td>{product.category || "-"}</td>
                      <td>{product.product_type || "-"}</td>
                      <td>{product.vendor || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredProducts.length ? <p style={{ marginTop: "0.75rem" }}>No products found.</p> : null}
          </div>
        </>
      )}

      {isDetailPage && showEditor ? (
        <div className="admin__form">
          <h3>Products</h3>
          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Title" />
          <input value={form.handle} onChange={(e) => setForm((p) => ({ ...p, handle: e.target.value }))} placeholder="Handle" />
          <input value={previewSlug} placeholder="Slug (auto)" readOnly />
          <input value={previewSlug ? `/store/${previewSlug}` : "/store/<slug>"} placeholder="Product URL" readOnly />
          <input value={form.vendor} onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))} placeholder="Vendor" />
          <input value={form.product_type} onChange={(e) => setForm((p) => ({ ...p, product_type: e.target.value }))} placeholder="Brand/Product Type" />
          <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Category" />
          <input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma separated)" />
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
          <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" />

          <h3>Variants</h3>
          {variants.map((variant, index) => (
            <div key={`${variant.id || "new"}-${index}`} style={{ display: "grid", gap: "0.45rem", marginBottom: "0.8rem" }}>
              <input
                value={variant.title}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((item, idx) => (idx === index ? { ...item, title: e.target.value } : item))
                  )
                }
                placeholder="Variant title"
              />
              <input
                value={variant.price}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((item, idx) => (idx === index ? { ...item, price: e.target.value } : item))
                  )
                }
                placeholder="Price"
              />
              <input
                value={variant.compare_at_price}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((item, idx) => (idx === index ? { ...item, compare_at_price: e.target.value } : item))
                  )
                }
                placeholder="Compare at price (optional)"
              />
              <input
                value={variant.inventory_quantity}
                onChange={(e) =>
                  setVariants((prev) =>
                    prev.map((item, idx) =>
                      idx === index ? { ...item, inventory_quantity: e.target.value } : item
                    )
                  )
                }
                placeholder="Inventory qty"
              />
              <div>
                <button
                  className="ghost"
                  type="button"
                  onClick={() =>
                    setVariants((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)))
                  }
                >
                  Remove Variant
                </button>
              </div>
            </div>
          ))}
          <button
            className="secondary"
            type="button"
            onClick={() => setVariants((prev) => [...prev, { ...defaultVariantDraft }])}
          >
            Add Variant
          </button>

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button className="primary" onClick={createProduct}>Create Product</button>
            <button className="secondary" onClick={updateProduct} disabled={!selectedId}>Update Product</button>
            <button className="ghost" onClick={deleteProduct} disabled={!selectedId}>Delete Product</button>
          </div>
        </div>
      ) : isDetailPage ? (
        <div className="admin__alert admin__alert--info">Product not found.</div>
      ) : null}

      {message ? <div className="admin__alert admin__alert--success">{message}</div> : null}
      {error ? <div className="admin__alert admin__alert--error">{error}</div> : null}
    </div>
  );
}
