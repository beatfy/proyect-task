import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn && req.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!isLoggedIn && req.nextUrl.pathname.startsWith("/projects")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!isLoggedIn && req.nextUrl.pathname.startsWith("/tasks")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!isLoggedIn && req.nextUrl.pathname.startsWith("/calendar")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!isLoggedIn && req.nextUrl.pathname.startsWith("/settings")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/tasks/:path*", "/calendar/:path*", "/settings/:path*"],
};