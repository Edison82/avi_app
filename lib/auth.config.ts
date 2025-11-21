import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter"
import type { NextAuthConfig } from "next-auth";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { Adapter, AdapterUser } from "next-auth/adapters";


export const authConfig: NextAuthConfig = {
  //Agrega adapter
  adapter: PrismaAdapter(prisma) as Adapter,

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try{
          // ✅ Verificación fuerte de tipo
          const email = credentials?.email as string | undefined;
          const password = credentials?.password as string | undefined;

          if (!email || !password) {
            console.log("Faltan credenciales");
            return null;
          }

          const usuario = await prisma.usuario.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              nombre: true,
              password: true,
              rol: true,
            },
          });

          if (!usuario || !usuario.password) {
            console.log("Usuario no encontrado", email);
            return null;
          }

          const passwordValido = await compare(password, usuario.password);

          if (!passwordValido) {
            console.log("Contraseña incorrecta para:", email);
            return null;
          }
          console.log('Login exitoso para:', email);

          return {
            id: usuario.id,
            email: usuario.email,
            name: usuario.nombre,
            rol: usuario.rol,
          };
        }catch (error) {
          console.log("Error en authorize:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = (user as AdapterUser).rol;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as string;
      }
      return session;
    },
  },
};