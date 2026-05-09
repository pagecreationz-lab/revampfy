"use client";

import { usePathname, useRouter } from "next/navigation";

const menuItems = [
  { href: "/admin/vendors", label: "Vendor Portal" },
  { href: "/admin/users", label: "Users Admin" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/assign-roles", label: "Assign Roles" },
  { href: "/admin/payment-gateway-settings", label: "Payment Gateway Settings" },
  { href: "/admin/google-sheet-integration", label: "Google Sheet Integration" },
  { href: "/admin/integrations", label: "n8n Integrations" },
  { href: "/admin/login-methods", label: "Login Methods" },
  { href: "/admin/email-integration", label: "Email Integration" },
  { href: "/admin", label: "Products" },
];

export default function AdminQuickMenu() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin-login");
      router.refresh();
    }
  };

  return (
    <aside className="admin__quick-links" aria-label="CMS admin quick menu">
      <div className="admin__quick-links-title">Revampfy Admin</div>
      {menuItems.map((item) => (
        <a
          key={item.href + item.label}
          href={item.href}
          className={pathname === item.href ? "admin__quick-link is-active" : "admin__quick-link"}
        >
          {item.label}
        </a>
      ))}
      <button type="button" className="admin__quick-link admin__quick-link--logout" onClick={logout}>
        Logout
      </button>
    </aside>
  );
}
