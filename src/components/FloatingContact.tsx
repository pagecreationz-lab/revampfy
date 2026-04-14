"use client";

import { useState } from "react";

type ContactMode = "whatsapp" | "phone";

const PHONE_NUMBER = "+918248003564";
const WHATSAPP_LINK =
  "https://wa.me/918248003564?text=Hi%20Revampfy%2C%20I%20need%20help%20with%20products.";

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4.5A3.5 3.5 0 0 1 7.5 1h9A3.5 3.5 0 0 1 20 4.5v7A3.5 3.5 0 0 1 16.5 15H10l-4.1 3.4c-.77.64-1.9.08-1.9-.92V15A3.5 3.5 0 0 1 .5 11.5v-7A3.5 3.5 0 0 1 4 4.5ZM7 7.75a1 1 0 1 0 0 2h10a1 1 0 1 0 0-2H7Zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11.8A8 8 0 1 0 6.5 17.5L5 22l4.7-1.4A8 8 0 1 0 20 11.8Zm-8 6.6a6.6 6.6 0 0 1-3.4-.9l-.25-.15-2.8.83.86-2.7-.16-.28a6.6 6.6 0 1 1 5.75 3.2Zm3.62-4.98c-.2-.1-1.16-.57-1.34-.64-.18-.07-.3-.1-.43.1-.13.2-.5.64-.62.77-.11.13-.22.15-.42.05-.2-.1-.83-.31-1.59-.98-.59-.53-.98-1.18-1.1-1.38-.11-.2-.01-.31.08-.41.08-.08.2-.22.29-.33.1-.11.13-.2.2-.34.07-.13.03-.25-.02-.35-.05-.1-.43-1.03-.6-1.41-.16-.37-.33-.32-.43-.33h-.37c-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.61s.7 1.88.8 2.01c.1.13 1.37 2.09 3.32 2.94.46.2.82.31 1.1.4.46.14.88.12 1.2.07.37-.06 1.16-.47 1.32-.93.16-.46.16-.85.11-.93-.05-.08-.18-.13-.38-.23Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.62 10.79a15.53 15.53 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24 11.72 11.72 0 0 0 3.68.59 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.27a1 1 0 0 1 1 1 11.72 11.72 0 0 0 .59 3.68 1 1 0 0 1-.24 1Z" />
    </svg>
  );
}

export function FloatingContact() {
  const [mode, setMode] = useState<ContactMode | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const activeMode = mode ?? "chat";

  return (
    <div className="contact-float-wrap">
      {isOpen ? (
        <div className="contact-float-menu" role="menu" aria-label="Contact options">
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noreferrer"
            className="contact-float-menu__item"
            onClick={() => {
              setMode("whatsapp");
              setIsOpen(false);
            }}
            role="menuitem"
          >
            <WhatsAppIcon />
            <span>WhatsApp</span>
          </a>
          <a
            href={`tel:${PHONE_NUMBER}`}
            className="contact-float-menu__item"
            onClick={() => {
              setMode("phone");
              setIsOpen(false);
            }}
            role="menuitem"
          >
            <PhoneIcon />
            <span>Call</span>
          </a>
        </div>
      ) : null}

      <div className="contact-float-shell">
        <button
          type="button"
          className={`contact-float contact-float--${activeMode}`}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Open contact options"
          aria-expanded={isOpen}
        >
          {mode === "whatsapp" ? <WhatsAppIcon /> : mode === "phone" ? <PhoneIcon /> : <ChatIcon />}
        </button>
        <button
          type="button"
          className="contact-float__mode-toggle"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? "X" : "Chat"}
        </button>
      </div>
    </div>
  );
}

