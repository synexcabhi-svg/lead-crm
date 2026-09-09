import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead CRM",
  description: "Standalone Lead Management System",
};

// Apply the saved theme colour before paint so there is no flash of default.
const THEME_INIT = `try{var c=localStorage.getItem('crm_primary');if(c){var r=document.documentElement.style;r.setProperty('--primary',c);r.setProperty('--primary-hover','color-mix(in srgb, '+c+' 85%, black)');r.setProperty('--primary-weak','color-mix(in srgb, '+c+' 15%, transparent)');r.setProperty('--bg','color-mix(in srgb, '+c+' 8%, #f5f6f8)');r.setProperty('--surface','color-mix(in srgb, '+c+' 3%, #ffffff)');}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
    </html>
  );
}
