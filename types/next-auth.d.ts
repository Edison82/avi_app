import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    rol?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      rol: string;
    } & DefaultSession["user"];   //Fusiona tipos obligatorios con los tipos predeterminados.
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    rol?: string;   //Tipas los campos que inyectas en el callback jwt().
  }
}