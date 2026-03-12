import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir rutas públicas
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api");

  if (isPublicPath) {
    return NextResponse.next();
  }

  const session = await auth();

  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const rol = session.user.rol;
  const setupCompleto = session.user.setupCompleto;

  if (rol === "ADMIN" && !setupCompleto && !pathname.startsWith("/setup")) {
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  if (pathname.startsWith("/setup") && setupCompleto) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname === "/dashboard") {
    if (rol === "OPERARIO") {
      return NextResponse.redirect(new URL("/dashboard/registros", req.url));
    }
    if (rol === "CONDUCTOR") {
      return NextResponse.redirect(new URL("/dashboard/entregas", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};