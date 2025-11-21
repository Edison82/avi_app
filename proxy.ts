import { auth } from "@/lib/auth";

export default async function proxy(req: Request) {
  const session = await auth(); // obtiene la sesión actual
  const { pathname } = new URL(req.url);

  // Rutas públicas (no requieren autenticación)
  const publicPaths = ["/auth/login", "/auth/registro", "/api/auth"];

  // Si la ruta es pública, deja pasar
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return;
  }

  // Si no hay sesión y no es ruta pública, redirige a login
  if (!session) {
    return Response.redirect(new URL("/auth/login", req.url));
  }

  // Si tiene sesión, deja pasar
  return;
}

// Configura las rutas donde este proxy se aplica
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/registros/:path*",
    "/api/gastos/:path*",
    "/api/categorias/:path*",
  ],
};