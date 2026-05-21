export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "taskProject",
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || "",
  primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || "#C75B39",
  primaryColorLight: process.env.NEXT_PUBLIC_PRIMARY_COLOR_LIGHT || "#D4A373",
  faviconUrl: process.env.NEXT_PUBLIC_BRAND_FAVICON_URL || "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://taskproject.app",
} as const;
