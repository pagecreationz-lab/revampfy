"use client";

import { useState } from "react";

type EnquiryFormMode = "contact" | "bulk";

export function EnquiryForm({ mode }: { mode: EnquiryFormMode }) {
  const [businessName, setBusinessName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitLabel = mode === "bulk" ? "Submit Bulk Enquiry" : "Submit Enquiry";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          businessName,
          contactPerson,
          email,
          mobile,
          details,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Unable to submit enquiry.");
      }
      setStatus("Enquiry sent successfully to support@revampfy.in.");
      setBusinessName("");
      setContactPerson("");
      setEmail("");
      setMobile("");
      setDetails("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit enquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="admin__form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder={mode === "bulk" ? "Organization name" : "Business name"}
        value={businessName}
        onChange={(event) => setBusinessName(event.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Contact person"
        value={contactPerson}
        onChange={(event) => setContactPerson(event.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input
        type="tel"
        placeholder="Mobile number"
        value={mobile}
        onChange={(event) => setMobile(event.target.value)}
        required
      />
      <textarea
        rows={5}
        placeholder={mode === "bulk" ? "Products and quantities" : "Requirement details"}
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        required
      />
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? "Sending..." : submitLabel}
      </button>
      {status ? <p className="hero__subtext">{status}</p> : null}
    </form>
  );
}

