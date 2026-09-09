import type { Metadata } from "next";
import { LeadForm } from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Contact us",
  robots: { index: false },
};

/**
 * Public lead-capture form. No authentication. Submits to /api/public/leads,
 * which runs the SAME LeadService as the admin app and writes to the SAME
 * lead table. This page never talks to the database directly.
 */
export default function PublicLeadFormPage() {
  return (
    <div className="center-page">
      <div className="stack" style={{ width: "100%", maxWidth: 560 }}>
        <div>
          <h1>Get in touch</h1>
          <p className="muted">
            Leave your details and the team will get back to you.
          </p>
        </div>
        <div className="card">
          <LeadForm mode="public" />
        </div>
        <p className="hint">Your information is stored securely and used only to contact you.</p>
      </div>
    </div>
  );
}
