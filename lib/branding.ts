/**
 * Leadfy Branding Configuration
 * 
 * All brand settings are driven by environment variables.
 * Clone the repo, set these vars, deploy — instant branded app.
 */

export const brand = {
  /** Application name shown in sidebar, auth pages, document title */
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Leadfy",

  /** Full URL to the brand logo (PNG/SVG). Falls back to first letter of name */
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || "",

  /** Primary brand color (hex, no #) — used for buttons, links, accents */
  primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#000000",

  /** Primary color for dark mode / light backgrounds */
  primaryColorLight: process.env.NEXT_PUBLIC_PRIMARY_COLOR_LIGHT || "#ffffff",

  /** Favicon URL (ICO or PNG). Falls back to default Next.js favicon */
  faviconUrl: process.env.NEXT_PUBLIC_BRAND_FAVICON_URL || "",

  /** App URL — used in emails and share links */
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://xtask.space",
} as const;
