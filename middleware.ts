export { default } from 'next-auth/middleware';

// Proteger todas las rutas excepto login y registro
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/registros/:path*',
    '/api/gastos/:path*',
    '/api/categorias/:path*',
  ],
};