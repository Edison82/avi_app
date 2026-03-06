import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { NextAuthConfig } from "next-auth";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { Adapter, AdapterUser } from "next-auth/adapters";

type CustomUser = AdapterUser & {
  rol: string;
  granjaId: string | null;
  setupCompleto: boolean;
};

export const authConfig: NextAuthConfig = {
  //Agrega adapter
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
      
        if (!email || !password) return null;
      
        const usuario = await prisma.usuario.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            nombre: true,
            password: true,
            rol: true,
            granja: { select: { id: true } },
            granjas: {
              select: { granjaId: true }
            }
          },
        });
      
        if (!usuario?.password) return null;
      
        const passwordValido = await compare(password, usuario.password);
        if (!passwordValido) return null;
      
        const granjaId =
          usuario.granja?.id ??
          usuario.granjas?.[0]?.granjaId ??
          null;
      
        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          rol: usuario.rol,
          granjaId,
          setupCompleto: !!granjaId,
        };
      },
    }),
  ],
  callbacks: {
    
    async jwt({ token, user }) {
      if (user) {
        const u = user as CustomUser;
        token.id = u.id;
        token.rol = u.rol;
        token.granjaId = u.granjaId;
        token.setupCompleto = u.setupCompleto;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as string;
        session.user.granjaId = token.granjaId as string | null;
        session.user.setupCompleto = token.setupCompleto as boolean;
      }
      return session;
    },
  },
};