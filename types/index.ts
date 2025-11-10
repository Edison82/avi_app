import { Prisma } from '@prisma/client';

// Tipo de Registro Diario con relaciones
export type RegistroDiarioConRelaciones = Prisma.RegistroDiarioGetPayload<{
  include: {
    gastos: {
      include: {
        categoria: true;
      };
    };
    usuario: {
      select: {
        nombre: true;
        email: true;
      };
    };
  };
}>;

// Tipo de Usuario sin password
export type UsuarioSinPassword = Omit<Prisma.UsuarioGetPayload<{}>, 'password'>;

// Tipo para indicadores del dashboard
export interface IndicadoresDiarios {
  fecha: string;
  huevosProducidos: number;
  huevosVendidos: number;
  ingresoTotal: number;
  gastoTotal: number;
  gananciaNeta: number;
}

export interface IndicadoresSemanales {
  promedioProduccion: number;
  promedioGanancia: number;
  totalIngresos: number;
  totalGastos: number;
  registros: IndicadoresDiarios[];
}

// Tipos para respuestas de API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Tipos para gastos con categoría
export type GastoConCategoria = Prisma.GastoGetPayload<{
  include: {
    categoria: true;
  };
}>;