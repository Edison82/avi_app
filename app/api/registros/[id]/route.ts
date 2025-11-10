import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registroDiarioSchema } from '@/lib/validations/schemas';

// GET - Obtener un registro específico
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const registro = await prisma.registroDiario.findFirst({
      where: {
        id: params.id,
        usuarioId: session.user.id
      },
      include: {
        gastos: {
          include: {
            categoria: true
          }
        }
      }
    });

    if (!registro) {
      return NextResponse.json(
        { success: false, error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: registro
    });

  } catch (error) {
    console.error('Error al obtener registro:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener registro' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar registro
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar que el registro existe y pertenece al usuario
    const registroExistente = await prisma.registroDiario.findFirst({
      where: {
        id: params.id,
        usuarioId: session.user.id
      }
    });

    if (!registroExistente) {
      return NextResponse.json(
        { success: false, error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validar datos
    const validacion = registroDiarioSchema.safeParse(body);
    
    if (!validacion.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Datos inválidos',
          details: validacion.error.issues
        },
        { status: 400 }
      );
    }

    const { fecha, huevosProducidos, huevosVendidos, precioVentaUnitario, observaciones, gastos } = validacion.data;

    // Calcular ingreso total
    const ingresoTotal = huevosVendidos * precioVentaUnitario;

    // Actualizar registro (eliminar gastos antiguos y crear nuevos)
    const registroActualizado = await prisma.$transaction(async (tx) => {
      // Eliminar gastos antiguos
      await tx.gasto.deleteMany({
        where: { registroId: params.id }
      });

      // Actualizar registro con nuevos gastos
      return tx.registroDiario.update({
        where: { id: params.id },
        data: {
          fecha: new Date(fecha),
          huevosProducidos,
          huevosVendidos,
          precioVentaUnitario,
          ingresoTotal,
          observaciones,
          gastos: {
            create: gastos.map(gasto => ({
              descripcion: gasto.descripcion,
              monto: gasto.monto,
              categoriaId: gasto.categoriaId
            }))
          }
        },
        include: {
          gastos: {
            include: {
              categoria: true
            }
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Registro actualizado exitosamente',
      data: registroActualizado
    });

  } catch (error) {
    console.error('Error al actualizar registro:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar registro' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar registro
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar que el registro existe y pertenece al usuario
    const registroExistente = await prisma.registroDiario.findFirst({
      where: {
        id: params.id,
        usuarioId: session.user.id
      }
    });

    if (!registroExistente) {
      return NextResponse.json(
        { success: false, error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar registro (los gastos se eliminan en cascada)
    await prisma.registroDiario.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Registro eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar registro:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar registro' },
      { status: 500 }
    );
  }
}