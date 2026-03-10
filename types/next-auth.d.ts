import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      rol: string;
      granjaId: string | null;
      setupCompleto: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    rol: string;
    granjaId: string | null;
    setupCompleto: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    rol: string;
    granjaId: string | null;
    setupCompleto: boolean;
  }
}
