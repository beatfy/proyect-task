export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "Beatfy",
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || "",
  primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#000000",
  primaryColorLight: process.env.NEXT_PUBLIC_PRIMARY_COLOR_LIGHT || "#ffffff",
  faviconUrl: process.env.NEXT_PUBLIC_BRAND_FAVICON_URL || "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://beatfy.app",
} as const;
