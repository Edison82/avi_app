import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Rutas completamente públicas
  const publicPaths = [
    "/auth/login",
    "/auth/registro",
    "/api/auth",
  ];

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Sin sesión → login
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const rol = session.user.rol;
  const setupCompleto = session.user.setupCompleto;

  // ADMIN sin granja → forzar setup (excepto si ya está en /setup)
  if (rol === "ADMIN" && !setupCompleto && !pathname.startsWith("/setup")) {
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  // Si ya completó setup y va a /setup → dashboard
  if (pathname.startsWith("/setup") && setupCompleto) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // OPERARIO solo puede ir a /dashboard/registros
  if (rol === "OPERARIO" && pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/dashboard/registros", req.url));
  }

  // CONDUCTOR solo puede ir a /dashboard/entregas
  if (rol === "CONDUCTOR" && pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/dashboard/entregas", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};