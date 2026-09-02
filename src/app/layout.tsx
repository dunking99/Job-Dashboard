import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Engine",
  description: "Integrated job search, tailoring and interview preparation.",
};

// The root layout is only the document shell. The application chrome (nav,
// scroll container) lives in the (app) route group, so /print can render a bare
// page — the print output must be the document and nothing else.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {/* Applied before paint so a stored theme choice does not flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
