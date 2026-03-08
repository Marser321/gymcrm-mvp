import { fail, ok, parseJsonBody } from '@/lib/gymcrm/api';
import { getAuthContext, gymTable } from '@/lib/gymcrm/server';

type ResetBody = {
  confirm?: boolean;
};

const isMissingRelation = (message?: string | null): boolean => {
  if (!message) return false;
  return /relation .* does not exist/i.test(message);
};

const deleteByGym = async (
  authCtx: Extract<Awaited<ReturnType<typeof getAuthContext>>, { ok: true }>,
  table: string
) => {
  const result = await authCtx.client.database
    .from(gymTable(table))
    .delete()
    .eq('gimnasio_id', authCtx.context.gimnasioId);

  if (result.error && !isMissingRelation(result.error.message)) {
    throw new Error(`${table}: ${result.error.message}`);
  }
};

export async function POST(request: Request) {
  const authCtx = await getAuthContext(['admin']);
  if (!authCtx.ok) return authCtx.response;

  if (process.env.GYMCRM_DEMO_RESET_ENABLED !== 'true') {
    return fail('Reset demo deshabilitado en este entorno.', 403, 'demo_reset_disabled');
  }

  let body: ResetBody;
  try {
    body = await parseJsonBody<ResetBody>(request);
  } catch {
    return fail('Body inválido para reset demo.', 400, 'invalid_body');
  }

  if (body.confirm !== true) {
    return fail('Debes confirmar el reset demo con { confirm: true }.', 400, 'reset_confirmation_required');
  }

  try {
    await deleteByGym(authCtx, 'comunidad_canjes');
    await deleteByGym(authCtx, 'comunidad_puntos_movimientos');
    await deleteByGym(authCtx, 'comunidad_retos');

    await deleteByGym(authCtx, 'builder_servicios');

    await deleteByGym(authCtx, 'notificaciones_whatsapp_queue');

    await deleteByGym(authCtx, 'nutricion_mediciones');
    await deleteByGym(authCtx, 'nutricion_planes');
    await deleteByGym(authCtx, 'nutricion_consentimientos');
    await deleteByGym(authCtx, 'nutricion_consultas');
    await deleteByGym(authCtx, 'nutricion_fichas');

    await deleteByGym(authCtx, 'checkins');
    await deleteByGym(authCtx, 'reservas_clases');
    await deleteByGym(authCtx, 'clases_horarios');
    await deleteByGym(authCtx, 'clases_base');

    await deleteByGym(authCtx, 'pagos');
    await deleteByGym(authCtx, 'membresias');
    await deleteByGym(authCtx, 'planes_membresia');
    await deleteByGym(authCtx, 'clientes');

    await deleteByGym(authCtx, 'staff_perfiles');
    await deleteByGym(authCtx, 'usuarios_roles');
  } catch (error) {
    return fail(
      error instanceof Error ? `No se pudo limpiar dataset demo: ${error.message}` : 'No se pudo limpiar dataset demo.',
      500,
      'demo_reset_cleanup_failed'
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (date: Date) => date.toISOString().slice(0, 10);

  const membershipStart = new Date(today);
  const membershipEnd = new Date(today);
  membershipEnd.setDate(membershipEnd.getDate() + 29);

  const scheduleStart = new Date(today);
  scheduleStart.setDate(scheduleStart.getDate() + 1);
  scheduleStart.setHours(18, 0, 0, 0);
  const scheduleEnd = new Date(scheduleStart);
  scheduleEnd.setMinutes(scheduleEnd.getMinutes() + 60);

  try {
    await authCtx.client.database.from(gymTable('usuarios_roles')).insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-admin',
        email: 'admin@gymcrm.open',
        rol: 'admin',
        activo: true,
      },
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-recepcion',
        email: 'recepcion@gymcrm.open',
        rol: 'recepcion',
        activo: true,
      },
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-entrenador',
        email: 'entrenador@gymcrm.open',
        rol: 'entrenador',
        activo: true,
      },
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-nutricionista',
        email: 'nutricionista@gymcrm.open',
        rol: 'nutricionista',
        activo: true,
      },
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-cliente',
        email: 'cliente@gymcrm.open',
        rol: 'cliente',
        activo: true,
      },
    ]);

    await authCtx.client.database.from(gymTable('staff_perfiles')).insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-admin',
        nombres: 'Mario',
        apellidos: 'Admin',
        telefono: '+598 9900 0001',
      },
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-recepcion',
        nombres: 'Lucia',
        apellidos: 'Recepcion',
        telefono: '+598 9900 0002',
      },
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-entrenador',
        nombres: 'Nicolas',
        apellidos: 'Coach',
        telefono: '+598 9900 0003',
      },
      {
        gimnasio_id: authCtx.context.gimnasioId,
        user_id: 'open-nutricionista',
        nombres: 'Valentina',
        apellidos: 'Nutri',
        telefono: '+598 9900 0004',
      },
    ]);

    const clientsResult = await authCtx.client.database
      .from(gymTable('clientes'))
      .insert([
        {
          gimnasio_id: authCtx.context.gimnasioId,
          auth_user_id: 'open-cliente',
          nombres: 'Cliente',
          apellidos: 'Demo',
          email: 'cliente@gymcrm.open',
          telefono: '+598 9900 1000',
          estado: 'activo',
          objetivo: 'Mejorar condición física',
        },
        {
          gimnasio_id: authCtx.context.gimnasioId,
          auth_user_id: null,
          nombres: 'Ana',
          apellidos: 'Gomez',
          email: 'ana.gomez@demo.uy',
          telefono: '+598 9900 2000',
          estado: 'activo',
          objetivo: 'Bajar porcentaje graso',
        },
      ])
      .select('id, nombres, apellidos')
      .order('created_at', { ascending: true });

    if (clientsResult.error || !clientsResult.data || clientsResult.data.length === 0) {
      return fail(`No se pudo crear seed de clientes: ${clientsResult.error?.message ?? 'unknown error'}`, 500, 'demo_seed_clients_failed');
    }

    const plansResult = await authCtx.client.database
      .from(gymTable('planes_membresia'))
      .insert([
        {
          gimnasio_id: authCtx.context.gimnasioId,
          nombre: 'Plan Mensual',
          descripcion: 'Acceso libre a sala y clases base',
          precio: 1800,
          moneda: 'UYU',
          duracion_dias: 30,
          incluye_reservas: true,
          activo: true,
        },
        {
          gimnasio_id: authCtx.context.gimnasioId,
          nombre: 'Plan Full',
          descripcion: 'Incluye clases premium y seguimiento',
          precio: 2600,
          moneda: 'UYU',
          duracion_dias: 30,
          incluye_reservas: true,
          activo: true,
        },
      ])
      .select('id, nombre, duracion_dias')
      .order('created_at', { ascending: true });

    if (plansResult.error || !plansResult.data || plansResult.data.length === 0) {
      return fail(`No se pudo crear seed de planes: ${plansResult.error?.message ?? 'unknown error'}`, 500, 'demo_seed_plans_failed');
    }

    const primaryClient = clientsResult.data[0];
    const primaryPlan = plansResult.data[0];

    const membershipResult = await authCtx.client.database
      .from(gymTable('membresias'))
      .insert([
        {
          gimnasio_id: authCtx.context.gimnasioId,
          cliente_id: primaryClient.id,
          plan_id: primaryPlan.id,
          estado: 'activa',
          fecha_inicio: fmt(membershipStart),
          fecha_fin: fmt(membershipEnd),
          renovacion_automatica: false,
        },
      ])
      .select('id')
      .maybeSingle();

    const membershipId = membershipResult.data?.id ?? null;

    const paymentInsert = await authCtx.client.database.from(gymTable('pagos')).insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        cliente_id: primaryClient.id,
        membresia_id: membershipId,
        monto: 1800,
        moneda: 'UYU',
        estado: 'registrado',
        metodo: 'manual',
        fecha_pago: now.toISOString(),
        registrado_por: authCtx.authUserId,
        notas: 'Pago inicial demo',
      },
    ]);

    if (paymentInsert.error) {
      return fail(`No se pudo crear seed de pagos: ${paymentInsert.error.message}`, 500, 'demo_seed_payments_failed');
    }

    const classResult = await authCtx.client.database
      .from(gymTable('clases_base'))
      .insert([
        {
          gimnasio_id: authCtx.context.gimnasioId,
          nombre: 'HIIT Funcional',
          descripcion: 'Entrenamiento funcional de alta intensidad',
          cupo_total: 16,
          duracion_min: 60,
          instructor_nombre: 'Nicolas Coach',
          nivel: 'intermedio',
          activa: true,
        },
        {
          gimnasio_id: authCtx.context.gimnasioId,
          nombre: 'Spinning Performance',
          descripcion: 'Cardio indoor con control de intensidad',
          cupo_total: 18,
          duracion_min: 45,
          instructor_nombre: 'Lucia Recepcion',
          nivel: 'mixto',
          activa: true,
        },
      ])
      .select('id, nombre, cupo_total')
      .order('created_at', { ascending: true });

    if (classResult.error || !classResult.data || classResult.data.length === 0) {
      return fail(`No se pudo crear seed de clases: ${classResult.error?.message ?? 'unknown error'}`, 500, 'demo_seed_classes_failed');
    }

    const mainClass = classResult.data[0];
    const scheduleInsert = await authCtx.client.database.from(gymTable('clases_horarios')).insert([
      {
        gimnasio_id: authCtx.context.gimnasioId,
        clase_base_id: mainClass.id,
        inicio: scheduleStart.toISOString(),
        fin: scheduleEnd.toISOString(),
        cupo_total: mainClass.cupo_total,
        estado: 'programada',
      },
    ]);

    if (scheduleInsert.error) {
      return fail(`No se pudo crear seed de horarios: ${scheduleInsert.error.message}`, 500, 'demo_seed_schedules_failed');
    }

    return ok({
      reset: true,
      gymId: authCtx.context.gimnasioId,
      seededAt: now.toISOString(),
      counts: {
        roles: 5,
        staffProfiles: 4,
        clients: clientsResult.data.length,
        plans: plansResult.data.length,
        classes: classResult.data.length,
      },
    });
  } catch (error) {
    return fail(
      error instanceof Error ? `No se pudo generar seed demo: ${error.message}` : 'No se pudo generar seed demo.',
      500,
      'demo_seed_failed'
    );
  }
}
