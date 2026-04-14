export type SitePageKey =
  | "homePage"
  | "aboutUsPage"
  | "partnersPage"
  | "storesPage"
  | "contactUsPage"
  | "bulkOrdersPage"
  | "companyPage"
  | "policiesPage";

export type SiteThemeMode = "dark" | "light";

export type SiteBlockTheme = "light" | "dark";
export type SiteBlockType = "hero" | "text" | "featureGrid";

export type SiteBuilderItem = {
  id: string;
  title: string;
  description: string;
};

export type SitePageBlock = {
  id: string;
  type: SiteBlockType;
  theme: SiteBlockTheme;
  eyebrow?: string;
  title?: string;
  content?: string;
  ctaLabel?: string;
  ctaHref?: string;
  items?: SiteBuilderItem[];
};

export type SiteContent = {
  themeMode: SiteThemeMode;
  home: {
    title: string;
    subtitle: string;
    heroImageUrl: string;
    programsImageUrl: string;
  };
  contactUs: string;
  aboutUs: string;
  partners: string;
  storeLocator: string;
  pageBuilder: Record<SitePageKey, SitePageBlock[]>;
};

export const SITE_PAGE_OPTIONS: { key: SitePageKey; label: string }[] = [
  { key: "homePage", label: "Home" },
  { key: "aboutUsPage", label: "About Us" },
  { key: "partnersPage", label: "Partners" },
  { key: "storesPage", label: "Stores" },
  { key: "contactUsPage", label: "Contact Us" },
  { key: "bulkOrdersPage", label: "Bulk Orders Enquiry" },
  { key: "companyPage", label: "Company" },
  { key: "policiesPage", label: "Policies" },
];

export function getDefaultPageBuilder(content: {
  homeTitle: string;
  homeSubtitle: string;
  aboutUs: string;
  partners: string;
  storeLocator: string;
  contactUs: string;
}): Record<SitePageKey, SitePageBlock[]> {
  return {
    homePage: [
      {
        id: "home-hero",
        type: "hero",
        theme: "dark",
        eyebrow: "Revampfy",
        title: content.homeTitle,
        content: content.homeSubtitle,
        ctaLabel: "Shop Deals",
        ctaHref: "/#deals",
      },
    ],
    aboutUsPage: [
      {
        id: "about-hero",
        type: "hero",
        theme: "light",
        eyebrow: "Company",
        title: "About Us",
        content: content.aboutUs,
      },
      {
        id: "about-text",
        type: "text",
        theme: "light",
        content:
          "Revampfy focuses on tested refurbished devices with transparent pricing and reliable after-sales support.",
      },
    ],
    partnersPage: [
      {
        id: "partners-hero",
        type: "hero",
        theme: "dark",
        eyebrow: "Company",
        title: "Partners",
        content: content.partners,
      },
      {
        id: "partners-grid",
        type: "featureGrid",
        theme: "dark",
        items: [
          {
            id: "p-item-1",
            title: "Campus Partners",
            description: "Student communities, labs, and placement cells for tech programs.",
          },
          {
            id: "p-item-2",
            title: "Reseller Partners",
            description: "Regional partners for fulfillment, deployment, and support.",
          },
          {
            id: "p-item-3",
            title: "Institution Partners",
            description: "Schools and training institutes for large-volume device rollouts.",
          },
        ],
      },
    ],
    storesPage: [
      {
        id: "stores-hero",
        type: "hero",
        theme: "light",
        eyebrow: "Company",
        title: "Stores",
        content: content.storeLocator,
      },
      {
        id: "stores-grid",
        type: "featureGrid",
        theme: "light",
        items: [
          {
            id: "s-item-1",
            title: "Chennai Hub",
            description: "Click for More Details",
          },
          {
            id: "s-item-2",
            title: "Bangalore Partner Desk",
            description: "Click for More Details",
          },
          {
            id: "s-item-3",
            title: "Remote Support",
            description: "Stores - Reach us for Remote Store Locator",
          },
        ],
      },
    ],
    contactUsPage: [
      {
        id: "contact-hero",
        type: "hero",
        theme: "light",
        eyebrow: "Businesses",
        title: "Contact Us",
        content: content.contactUs,
      },
    ],
    bulkOrdersPage: [
      {
        id: "bulk-hero",
        type: "hero",
        theme: "dark",
        eyebrow: "Bulk Orders",
        title: "Bulk Orders Enquiry",
        content: "Share your product and quantity requirement.",
      },
    ],
    companyPage: [
      {
        id: "company-hero",
        type: "hero",
        theme: "dark",
        eyebrow: "Company",
        title: "Explore Company Pages",
        content: "Navigate all company information and support pages.",
      },
      {
        id: "company-grid",
        type: "featureGrid",
        theme: "dark",
        items: [
          {
            id: "company-item-1",
            title: "About Us",
            description: "Our story, mission, and quality standards.",
          },
          {
            id: "company-item-2",
            title: "Partners",
            description: "Programs for campuses, institutions, and resellers.",
          },
          {
            id: "company-item-3",
            title: "Stores",
            description: "Store points, service hubs, and support desk.",
          },
        ],
      },
    ],
    policiesPage: [
      {
        id: "policies-hero",
        type: "hero",
        theme: "dark",
        eyebrow: "Company",
        title: "Policies",
        content: "Warranty, shipping, return, and privacy policy overview.",
      },
      {
        id: "policies-grid",
        type: "featureGrid",
        theme: "dark",
        items: [
          {
            id: "policy-item-1",
            title: "Warranty Policy",
            description:
              "Most devices include up to 12 months warranty based on model and grade.",
          },
          {
            id: "policy-item-2",
            title: "Shipping Policy",
            description: "Orders are dispatched within 24-48 hours with tracking updates.",
          },
          {
            id: "policy-item-3",
            title: "Return Policy",
            description: "Returns are accepted for eligible products as per invoice terms.",
          },
          {
            id: "policy-item-4",
            title: "Privacy Policy",
            description:
              "Customer data is used only for fulfilment, service, and support communications.",
          },
        ],
      },
    ],
  };
}
