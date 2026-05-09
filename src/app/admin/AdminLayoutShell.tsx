"use client";

import { useEffect, useState } from "react";
import AdminQuickMenu from "./AdminQuickMenu";

type AdminLayoutShellProps = {
  children: React.ReactNode;
};

const STORAGE_KEY = "cms_admin_nav_hidden";

export default function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  const [menuHidden, setMenuHidden] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setMenuHidden(true);
    } catch {
      // ignore
    }
  }, []);

  const toggleMenu = () => {
    setMenuHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div
      className={
        menuHidden ? "admin__section-layout admin__section-layout--nav-hidden" : "admin__section-layout"
      }
    >
      {!menuHidden ? <AdminQuickMenu /> : null}
      <div className="admin__section-content">
        <div className="admin__nav-toggle-row">
          <button type="button" className="admin__nav-toggle-btn" onClick={toggleMenu}>
            {menuHidden ? "Show Menu" : "Hide Menu"}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

