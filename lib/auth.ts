import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 días
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Credenciales inválidas');
        }

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            nombre: true,
            password: true,
            rol: true,
          }
        });

        if (!usuario) {
          throw new Error('Usuario no encontrado');
        }

        const passwordValido = await compare(credentials.password, usuario.password);

        if (!passwordValido) {
          throw new Error('Contraseña incorrecta');
        }

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          rol: usuario.rol,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rol = user.rol;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as string;
      }
      return session;
    }
  }
};

// Tipos extendidos para NextAuth
declare module 'next-auth' {
  interface User {
    rol?: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      rol: string;
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    rol?: string;
  }
}