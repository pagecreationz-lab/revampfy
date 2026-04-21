import "server-only";
import { resolveShopifyConnectionSettings } from "@/lib/shopifyConnection";

export type ShopifyCollection = {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  image?: { src: string } | null;
  collection_type?: "custom" | "smart" | "derived";
};

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  description?: string;
  description_html?: string;
  status?: string;
  tags?: string;
  vendor?: string;
  product_type?: string;
  category?: string;
  collection_handles?: string[];
  collection_titles?: string[];
  images?: { src: string }[];
  variants?: {
    id?: number;
    title?: string;
    price: string;
    compare_at_price?: string | null;
    inventory_quantity?: number;
    requires_shipping?: boolean;
  }[];
  metafields?: {
    namespace: string;
    key: string;
    value: string;
    type?: string;
  }[];
};

export type ShopifyCustomer = {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  state?: string;
  tags?: string;
  orders_count?: number;
  created_at?: string;
};

export type ShopifyOrderSummary = {
  id: number;
  name: string;
  createdAt: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  totalPrice: number;
  statusUrl?: string;
};

export type ShopifySyncPayload = {
  categories: ShopifyCollection[];
  brands: string[];
  vendors: string[];
  products: ShopifyProduct[];
};

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { storeDomain, accessToken, apiVersion } =
    await resolveShopifyConnectionSettings();
  const url = `https://${storeDomain}/admin/api/${apiVersion}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Shopify API error (${res.status}): ${message}`);
  }

  return res.json() as Promise<T>;
}

async function adminFetchWithHeaders<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; linkHeader: string | null }> {
  const { storeDomain, accessToken, apiVersion } =
    await resolveShopifyConnectionSettings();
  const url = `https://${storeDomain}/admin/api/${apiVersion}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Shopify API error (${res.status}): ${message}`);
  }

  const data = (await res.json()) as T;
  return { data, linkHeader: res.headers.get("link") };
}

async function adminGraphqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const { storeDomain, accessToken, apiVersion } =
    await resolveShopifyConnectionSettings();
  const url = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const raw = (await res.json()) as {
    data?: T;
    errors?: unknown;
  };

  if (!res.ok || raw.errors) {
    throw new Error(
      `Shopify GraphQL error (${res.status}): ${JSON.stringify(raw.errors || raw)}`
    );
  }

  return raw.data as T;
}

export async function getCollections(): Promise<ShopifyCollection[]> {
  const [custom, smart] = await Promise.all([
    adminFetch<{ custom_collections: ShopifyCollection[] }>(
      `/custom_collections.json?limit=50&fields=id,title,handle,body_html,image`
    ),
    adminFetch<{ smart_collections: ShopifyCollection[] }>(
      `/smart_collections.json?limit=50&fields=id,title,handle,body_html,image`
    ),
  ]);

  return [
    ...custom.custom_collections.map((item) => ({
      ...item,
      collection_type: "custom" as const,
    })),
    ...smart.smart_collections.map((item) => ({
      ...item,
      collection_type: "smart" as const,
    })),
  ];
}

export async function getProducts(options?: {
  limit?: number;
  pageInfo?: string;
  status?: "active" | "draft" | "archived" | "any";
}): Promise<{ products: ShopifyProduct[]; pageInfo?: { next?: string; prev?: string } }> {
  const limit = options?.limit ?? 25;
  const pageInfo = options?.pageInfo;
  const requestedStatus = options?.status || "active";
  const status = requestedStatus === "any" ? "active" : requestedStatus;

  const query = new URLSearchParams({
    limit: String(limit),
    fields: "id,title,handle,status,tags,vendor,product_type,images,variants",
    status,
  });

  if (pageInfo) {
    query.set("page_info", pageInfo);
  }

  const { data, linkHeader } = await adminFetchWithHeaders<{ products: ShopifyProduct[] }>(
    `/products.json?${query.toString()}`
  );

  const pageInfoLinks: { next?: string; prev?: string } = {};
  if (linkHeader) {
    const links = linkHeader.split(",");
    links.forEach((link) => {
      const match = link.match(/<([^>]+)>; rel=\"(next|previous)\"/);
      if (match) {
        const url = new URL(match[1]);
        const info = url.searchParams.get("page_info");
        if (match[2] === "next") pageInfoLinks.next = info || undefined;
        if (match[2] === "previous") pageInfoLinks.prev = info || undefined;
      }
    });
  }

  return { products: data.products, pageInfo: pageInfoLinks };
}

export async function getCustomers(limit = 50): Promise<ShopifyCustomer[]> {
  const data = await adminFetch<{ customers: ShopifyCustomer[] }>(
    `/customers.json?limit=${limit}&fields=id,first_name,last_name,email,state,tags,orders_count,created_at`
  );
  return data.customers || [];
}

export async function upsertCustomerByEmail(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address1?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error("Customer email is required.");
  }

  const search = await adminFetch<{ customers: ShopifyCustomer[] }>(
    `/customers/search.json?query=${encodeURIComponent(
      `email:${email}`
    )}&fields=id,first_name,last_name,email`
  );
  const existing = (search.customers || []).find(
    (customer) => (customer.email || "").toLowerCase() === email
  );

  const customerPayload = {
    email,
    first_name: input.firstName || undefined,
    last_name: input.lastName || undefined,
    phone: input.phone || undefined,
    default_address: input.address1 ? { address1: input.address1 } : undefined,
  };

  if (existing?.id) {
    const data = await adminFetch<{ customer: ShopifyCustomer }>(
      `/customers/${existing.id}.json`,
      {
        method: "PUT",
        body: JSON.stringify({
          customer: {
            id: existing.id,
            ...customerPayload,
          },
        }),
      }
    );
    return data.customer;
  }

  const data = await adminFetch<{ customer: ShopifyCustomer }>("/customers.json", {
    method: "POST",
    body: JSON.stringify({
      customer: customerPayload,
    }),
  });
  return data.customer;
}

export async function getOrdersByEmail(
  email: string,
  limit = 25
): Promise<ShopifyOrderSummary[]> {
  const safeEmail = email.trim().toLowerCase();
  if (!safeEmail) return [];

  const query = `
    query OrdersByEmail($query: String!, $first: Int!) {
      orders(first: $first, query: $query, reverse: true) {
        nodes {
          legacyResourceId
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet {
            shopMoney {
              amount
            }
          }
          statusPageUrl
        }
      }
    }
  `;

  const data: {
    orders: {
      nodes: Array<{
        legacyResourceId: string;
        name: string;
        createdAt: string;
        displayFinancialStatus?: string;
        displayFulfillmentStatus?: string;
        totalPriceSet?: { shopMoney?: { amount?: string } };
        statusPageUrl?: string | null;
      }>;
    };
  } = await adminGraphqlFetch(query, {
    query: `email:${safeEmail}`,
    first: Math.max(1, Math.min(limit, 100)),
  });

  return (data.orders?.nodes || []).map((order) => ({
    id: Number(order.legacyResourceId || 0),
    name: order.name || `#${order.legacyResourceId}`,
    createdAt: order.createdAt,
    financialStatus: order.displayFinancialStatus || "",
    fulfillmentStatus: order.displayFulfillmentStatus || "",
    totalPrice: Number(order.totalPriceSet?.shopMoney?.amount || 0),
    statusUrl: order.statusPageUrl || "",
  }));
}

type GraphqlProductNode = {
  legacyResourceId: string;
  title: string;
  handle: string;
  description?: string;
  descriptionHtml?: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  tags: string[];
  vendor: string;
  productType: string;
  category?: { fullName?: string; name?: string } | null;
  featuredImage?: { url: string } | null;
  images?: {
    nodes: Array<{ url: string }>;
  };
  variants?: {
    nodes: Array<{
      id?: string | null;
      legacyResourceId?: string | null;
      title?: string;
      price: string;
      compareAtPrice?: string | null;
      inventoryQuantity?: number | null;
    }>;
  };
  collections?: {
    nodes: Array<{
      handle?: string | null;
      title?: string | null;
    }>;
  };
  metafields?: {
    nodes: Array<{
      namespace?: string | null;
      key?: string | null;
      value?: string | null;
      type?: string | null;
      reference?: {
        __typename?: string | null;
        id?: string | null;
        displayName?: string | null;
        fields?: Array<{
          key?: string | null;
          value?: string | null;
          type?: string | null;
        }> | null;
      } | null;
      references?: {
        nodes?: Array<{
          __typename?: string | null;
          id?: string | null;
          displayName?: string | null;
          fields?: Array<{
            key?: string | null;
            value?: string | null;
            type?: string | null;
          }> | null;
        }>;
      } | null;
    }>;
  };
};

function parseGraphqlNumericId(value?: string | null): number | undefined {
  if (!value) return undefined;
  const part = value.split("/").pop();
  const parsed = Number(part);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isLikelyGidValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("gid://")) return true;
  if (trimmed.startsWith("[") && trimmed.includes("gid://shopify/")) return true;
  return false;
}

function getMetaobjectBestValue(
  item:
    | {
        displayName?: string | null;
        fields?: Array<{ key?: string | null; value?: string | null; type?: string | null }> | null;
      }
    | null
    | undefined
): string {
  if (!item) return "";
  const fields = item.fields || [];
  const preferredField = fields.find((field) => {
    const key = (field.key || "").toLowerCase();
    const value = String(field.value || "").trim();
    if (!value || isLikelyGidValue(value)) return false;
    return (
      key.includes("title") ||
      key.includes("name") ||
      key.includes("label") ||
      key.includes("model") ||
      key.includes("text") ||
      key.includes("value")
    );
  });
  if (preferredField?.value) return String(preferredField.value).trim();
  const firstUseful = fields.find((field) => {
    const value = String(field.value || "").trim();
    return Boolean(value) && !isLikelyGidValue(value);
  });
  if (firstUseful?.value) return String(firstUseful.value).trim();
  return String(item.displayName || "").trim();
}

function resolveMetafieldValue(node: {
  value?: string | null;
  type?: string | null;
  reference?: {
    displayName?: string | null;
    fields?: Array<{ key?: string | null; value?: string | null; type?: string | null }> | null;
  } | null;
  references?: {
    nodes?: Array<{
      displayName?: string | null;
      fields?: Array<{ key?: string | null; value?: string | null; type?: string | null }> | null;
    }>;
  } | null;
}): string {
  const fromReferences = (node.references?.nodes || [])
    .map((item) => getMetaobjectBestValue(item))
    .filter(Boolean);
  if (fromReferences.length) {
    return fromReferences.join(", ");
  }

  const fromReference = getMetaobjectBestValue(node.reference);
  if (fromReference) return fromReference;

  const raw = String(node.value || "").trim();
  if (!raw) return "";

  if (isLikelyGidValue(raw)) {
    // Hide unresolved Shopify GIDs from the frontend if references were not available.
    return "";
  }
  return raw;
}

function mapGraphqlProductNode(node: GraphqlProductNode): ShopifyProduct {
  const mappedVariants = (node.variants?.nodes || [])
    .map((variant) => {
      const variantId =
        parseGraphqlNumericId(variant.id) ||
        Number(variant.legacyResourceId || 0) ||
        undefined;
      if (!variantId) return null;
      return {
        id: variantId,
        title: variant.title || "Default",
        price: variant.price,
        compare_at_price: variant.compareAtPrice || null,
        inventory_quantity: Number(variant.inventoryQuantity || 0),
        requires_shipping: false,
      };
    })
    .filter((variant) => Boolean(variant)) as NonNullable<ShopifyProduct["variants"]>;

  const galleryImages = (node.images?.nodes || [])
    .map((image) => image.url)
    .filter(Boolean)
    .map((src) => ({ src }));

  return {
    id: Number(node.legacyResourceId),
    title: node.title,
    handle: node.handle,
    description: node.description || "",
    description_html: node.descriptionHtml || node.description || "",
    status: node.status.toLowerCase(),
    tags: (node.tags || []).join(", "),
    vendor: node.vendor || "",
    product_type: node.productType || "",
    category: node.category?.name || node.category?.fullName || "",
    collection_handles: (node.collections?.nodes || [])
      .map((entry) => (entry.handle || "").trim())
      .filter(Boolean),
    collection_titles: (node.collections?.nodes || [])
      .map((entry) => (entry.title || "").trim())
      .filter(Boolean),
    images: galleryImages.length
      ? galleryImages
      : node.featuredImage?.url
        ? [{ src: node.featuredImage.url }]
        : [],
    variants: mappedVariants,
    metafields: (node.metafields?.nodes || [])
      .map((entry) => ({
        namespace: (entry.namespace || "custom").trim(),
        key: String(entry.key || "").trim(),
        value: resolveMetafieldValue(entry),
        type: entry.type || undefined,
      }))
      .filter((entry) => Boolean(entry.key && entry.value))
      .map((entry) => ({
        namespace: entry.namespace,
        key: entry.key,
        value: entry.value,
        type: entry.type,
      })),
  } satisfies ShopifyProduct;
}

export async function getProductById(id: number): Promise<ShopifyProduct | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const query = `
    query ProductById($id: ID!) {
      product(id: $id) {
        legacyResourceId
        title
        handle
        description
        descriptionHtml
        status
        tags
        vendor
        productType
        category {
          fullName
          name
        }
        featuredImage {
          url
        }
        images(first: 12) {
          nodes {
            url
          }
        }
        variants(first: 40) {
          nodes {
            id
            legacyResourceId
            title
            price
            compareAtPrice
            inventoryQuantity
          }
        }
        collections(first: 20) {
          nodes {
            handle
            title
          }
        }
        metafields(first: 40) {
          nodes {
            namespace
            key
            value
            type
            reference {
              __typename
              ... on Metaobject {
                id
                displayName
                fields {
                  key
                  value
                  type
                }
              }
            }
            references(first: 20) {
              nodes {
                __typename
                ... on Metaobject {
                  id
                  displayName
                  fields {
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const result: { product: GraphqlProductNode | null } = await adminGraphqlFetch(query, {
    id: `gid://shopify/Product/${id}`,
  });
  if (!result.product) return null;
  return mapGraphqlProductNode(result.product);
}

export async function getAllProducts(maxPages = 8): Promise<ShopifyProduct[]> {
  let cursor: string | null = null;
  let pages = 0;
  const all: ShopifyProduct[] = [];

  const productQuery = `
    query ProductsSync($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          legacyResourceId
          title
          handle
          description
          descriptionHtml
          status
          tags
          vendor
          productType
          category {
            fullName
            name
          }
          featuredImage {
            url
          }
          images(first: 8) {
            nodes {
              url
            }
          }
          variants(first: 20) {
            nodes {
              id
              legacyResourceId
              title
              price
              compareAtPrice
              inventoryQuantity
            }
          }
          collections(first: 20) {
            nodes {
              handle
              title
            }
          }
          metafields(first: 40) {
            nodes {
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  `;

  while (pages < maxPages) {
    const graphqlResult: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        nodes: GraphqlProductNode[];
      };
    } = await adminGraphqlFetch(productQuery, { first: 100, after: cursor });

    const mapped = graphqlResult.products.nodes.map((node) => mapGraphqlProductNode(node));

    all.push(...mapped);

    const hasNextPage = graphqlResult.products.pageInfo.hasNextPage;
    cursor = graphqlResult.products.pageInfo.endCursor || null;
    pages += 1;
    if (!hasNextPage || !cursor) break;
  }

  return all;
}

export async function getShopifySyncPayload(): Promise<ShopifySyncPayload> {
  const [collections, allProducts] = await Promise.all([getCollections(), getAllProducts()]);

  const categoryNames = Array.from(
    new Set(
      allProducts
        .map((p) => (p.category || p.product_type || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const collectionByHandle = new Map(collections.map((c) => [c.handle, c]));
  const derivedCategories: ShopifyCollection[] = categoryNames
    .map((name, index) => {
      const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const existing = collectionByHandle.get(handle);
      if (existing) return existing;
        return {
          id: -(index + 1),
          title: name,
          handle: handle || `category-${index + 1}`,
          body_html: name,
          collection_type: "derived" as const,
        };
    })
    .filter(Boolean);

  const categories =
    collections.length > 0 && !(
      collections.length === 1 && collections[0].handle.toLowerCase() === "frontpage"
    )
      ? collections
      : derivedCategories.length
        ? derivedCategories
        : collections;

  const brands = Array.from(
    new Set(
      allProducts
        .map((p) => (p.product_type || p.category || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const vendors = Array.from(
    new Set(allProducts.map((p) => (p.vendor || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return {
    categories,
    brands,
    vendors,
    products: allProducts,
  };
}

export async function updateProduct(input: {
  id: number;
  title?: string;
  tags?: string;
  status?: string;
}): Promise<ShopifyProduct> {
  const data = await adminFetch<{ product: ShopifyProduct }>(`/products/${input.id}.json`, {
    method: "PUT",
    body: JSON.stringify({
      product: {
        id: input.id,
        title: input.title,
        tags: input.tags,
        status: input.status,
      },
    }),
  });

  return data.product;
}

export async function updateCollection(input: {
  id: number;
  title?: string;
  body_html?: string;
  collection_type?: "custom" | "smart" | "derived";
}): Promise<ShopifyCollection> {
  if (input.id <= 0) {
    throw new Error(
      "This category is derived from product data and not a real Shopify collection. Create/edit it in Shopify Collections first."
    );
  }

  const payload = {
    id: input.id,
    title: input.title,
    body_html: input.body_html,
  };

  const updateCustom = async () => {
    const data = await adminFetch<{ custom_collection: ShopifyCollection }>(
      `/custom_collections/${input.id}.json`,
      {
        method: "PUT",
        body: JSON.stringify({ custom_collection: payload }),
      }
    );
    return { ...data.custom_collection, collection_type: "custom" as const };
  };

  const updateSmart = async () => {
    const data = await adminFetch<{ smart_collection: ShopifyCollection }>(
      `/smart_collections/${input.id}.json`,
      {
        method: "PUT",
        body: JSON.stringify({ smart_collection: payload }),
      }
    );
    return { ...data.smart_collection, collection_type: "smart" as const };
  };

  if (input.collection_type === "custom") return updateCustom();
  if (input.collection_type === "smart") return updateSmart();

  try {
    return await updateCustom();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("(404)")) {
      throw error;
    }
    return updateSmart();
  }
}

export async function createDraftOrder(input: {
  email: string;
  lineItems: Array<{ variantId: number; quantity: number }>;
  note?: string;
}): Promise<{
  id: number;
  name?: string;
  status?: string;
  invoice_url?: string;
}> {
  const data = await adminFetch<{
    draft_order: { id: number; name?: string; status?: string; invoice_url?: string };
  }>("/draft_orders.json", {
    method: "POST",
    body: JSON.stringify({
      draft_order: {
        email: input.email,
        note: input.note || "Order from Revampfy customer portal",
        line_items: input.lineItems.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
      },
    }),
  });

  return data.draft_order;
}

export function stripHtml(value?: string | null): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, "").trim();
}
