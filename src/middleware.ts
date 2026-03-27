import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas que requieren autenticación
const protectedRoutes = ["/dashboard", "/projects", "/tasks", "/calendar", "/settings"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Verificar si es una ruta protegida
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    // Verificar si hay sesión (cookie de next-auth)
    const sessionToken = request.cookies.get("next-auth.session-token")?.value || 
                         request.cookies.get("__Secure-next-auth.session-token")?.value;
    
    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/tasks/:path*", "/calendar/:path*", "/settings/:path*"],
};