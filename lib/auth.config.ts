import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { Adapter } from "next-auth/adapters";
 
// ✅ CustomUser eliminado — ya no se necesita porque next-auth.d.ts
// extiende la interfaz User de NextAuth directamente con todos los campos.
 
export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/login",
  },
 
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
 
      // ✅ FIX PRINCIPAL: el objeto retornado ahora incluye `nombre`
      // (requerido por la interfaz User extendida en next-auth.d.ts)
      // y elimina `name` como campo principal (puede existir como alias
      // en DefaultSession pero `nombre` es el que declaramos nosotros).
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined;
        const password = credentials?.password as string | undefined;
 
        if (!email || !password) return null;
 
        const usuario = await prisma.usuario.findUnique({
          where: { email },
          select: {
            id:       true,
            email:    true,
            nombre:   true,   // campo real del modelo Usuario en schema.prisma
            password: true,
            rol:      true,
            // granja directa (relación GranjaAdmin) — para admins
            granja: {
              select: { id: true, nombre: true },
            },
            // granjas por tabla pivot — para operarios / conductores
            granjas: {
              select: { granjaId: true },
              take: 1,
            },
          },
        });
 
        if (!usuario?.password) return null;
 
        const passwordValido = await compare(password, usuario.password);
        if (!passwordValido) return null;
 
        // granjaId: primero intenta la relación directa (admin), luego pivot
        const granjaId =
          usuario.granja?.id ??
          usuario.granjas?.[0]?.granjaId ??
          null;
 
        // nombreGranja: solo disponible si tiene granja directa (admin)
        const nombreGranja = usuario.granja?.nombre ?? null;
 
        // ✅ El objeto retornado satisface la interfaz User de next-auth.d.ts:
        //    id, nombre, rol, granjaId, nombreGranja, setupCompleto
        //    `name` se añade como alias de `nombre` para que NextAuth
        //    lo muestre en session.user.name si algún componente lo usa.
        return {
          id:            usuario.id,
          email:         usuario.email,
          name:          usuario.nombre,   // alias para compatibilidad con NextAuth
          nombre:        usuario.nombre,   // 👈 campo requerido por next-auth.d.ts
          rol:           usuario.rol,
          granjaId,
          nombreGranja,
          setupCompleto: !!granjaId,
        };
      },
    }),
  ],
 
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Login inicial — user solo viene en el primer JWT
      if (user) {
        token.id           = user.id as string;
        token.nombre       = user.nombre;
        token.rol          = user.rol;
        token.granjaId     = user.granjaId    ?? null;
        token.nombreGranja = user.nombreGranja ?? null;
        token.setupCompleto = user.setupCompleto ?? false;
      }
 
      // Después del setup: el cliente llama update() con granjaId y nombreGranja
      if (trigger === 'update' && session?.granjaId) {
        token.granjaId      = session.granjaId;
        token.nombreGranja  = session.nombreGranja ?? null;
        token.setupCompleto = true;
      }
 
      return token;
    },
 
    async session({ session, token }) {
      if (session.user) {
        session.user.id           = token.id           as string;
        session.user.nombre       = token.nombre       as string;
        session.user.rol          = token.rol          as 'ADMIN' | 'OPERARIO' | 'CONDUCTOR';
        session.user.granjaId     = token.granjaId     as string | null ?? null;
        session.user.nombreGranja = token.nombreGranja as string | null ?? null;
        session.user.setupCompleto= token.setupCompleto as boolean ?? false;
      }
      return session;
    },
  },
};
 