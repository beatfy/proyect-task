export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/tasks/:path*", "/calendar/:path*", "/settings/:path*"],
};