import { DefaultSession } from 'next-auth';
import { Rol } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id:             string;
      nombre:         string;
      rol:            Rol;
      granjaId?:      string | null;
      nombreGranja?:  string | null;
      setupCompleto?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id:             string;
    nombre:         string;
    rol:            Rol;
    granjaId?:      string | null;
    nombreGranja?:  string | null;
    setupCompleto?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:             string;
    nombre:         string;
    rol:            Rol;
    granjaId?:      string | null;
    nombreGranja?:  string | null;
    setupCompleto?: boolean;
  }
}
