import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Definimos las rutas públicas, incluyendo ahora la raíz '/'
  const publicPaths = ["/", "/auth/login", "/auth/registro", "/api/auth"];

  // Comprobación exacta para la raíz o que empiece con las otras rutas
  const isPublicPath = pathname === "/" || publicPaths.some((p) => p !== "/" && pathname.startsWith(p));

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 2. Obtener sesión para rutas protegidas
  const session = await auth();

  // 3. Si no hay sesión, mandamos al login
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const rol = session.user.rol;
  const setupCompleto = session.user.setupCompleto;

  // 4. Lógica de flujo para ADMIN (Setup obligatorio)
  if (rol === "ADMIN" && !setupCompleto && !pathname.startsWith("/setup")) {
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  // 5. Evitar que vuelvan al setup si ya terminaron
  if (pathname.startsWith("/setup") && setupCompleto) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 6. Redirecciones automáticas al Dashboard según el rol
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