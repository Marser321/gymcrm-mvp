import { ok, okList, fail, parseJsonBody } from '@/lib/gymcrm/api';
import { PERMISSIONS, hasRole } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

type CreateHorarioBody = {
  clase_base_id: string;
  sede_id?: string | null;
  inicio: string;
  fin: string;
  cupo_total?: number;
  estado?: 'programada' | 'cancelada' | 'finalizada';
};

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const url = new URL(request.url);
  const claseBaseId = url.searchParams.get('claseBaseId');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('clases_horarios'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('inicio', { ascending: true })
    .range(from, to);

  if (claseBaseId) query.eq('clase_base_id', claseBaseId);
  if (start) query.gte('inicio', start);
  if (end) query.lte('inicio', end);

  const { data, error, count } = await query;
  if (error) {
    return fail(`No se pudieron cargar horarios: ${error.message}`, 500);
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return okList([], count ?? 0);
  }

  const classIds = Array.from(new Set(rows.map((row) => row.clase_base_id)));
  const classResult = await authCtx.client.database
    .from(gymTable('clases_base'))
    .select('id, nombre')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .in('id', classIds);

  if (classResult.error) {
    return fail(`No se pudieron resolver nombres de clase: ${classResult.error.message}`, 500);
  }

  const classMap = new Map<string, string>();
  for (const row of classResult.data ?? []) {
    classMap.set(row.id, row.nombre);
  }

  const resolved = rows.map((row) => ({
    ...row,
    clase_nombre: classMap.get(row.clase_base_id) ?? null,
  }));

  return okList(resolved, count ?? 0);
}

export async function POST(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) {
    return authCtx.response;
  }

  if (!hasRole(authCtx.context.role, PERMISSIONS.clases)) {
    return fail('No tienes permisos para crear horarios.', 403);
  }

  let body: CreateHorarioBody;
  try {
    body = await parseJsonBody<CreateHorarioBody>(request);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Body inválido.', 400);
  }

  if (!body.clase_base_id || !body.inicio || !body.fin) {
    return fail('clase_base_id, inicio y fin son obligatorios.', 400);
  }

  const classRecord = await authCtx.client.database
    .from(gymTable('clases_base'))
    .select('id, sede_id, cupo_total')
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .eq('id', body.clase_base_id)
    .single();

  if (classRecord.error || !classRecord.data) {
    return fail(`No se pudo validar clase base: ${classRecord.error?.message ?? 'not found'}`, 400);
  }

  const cupo = body.cupo_total ?? classRecord.data.cupo_total;

  if (!Number.isFinite(cupo) || cupo <= 0) {
    return fail('cupo_total debe ser mayor a 0.', 400);
  }

  const payload = {
    gimnasio_id: authCtx.context.gimnasioId,
    clase_base_id: body.clase_base_id,
    sede_id: body.sede_id ?? classRecord.data.sede_id ?? null,
    inicio: body.inicio,
    fin: body.fin,
    cupo_total: cupo,
    estado: body.estado ?? 'programada',
  };

  const { data, error } = await authCtx.client.database
    .from(gymTable('clases_horarios'))
    .insert([payload])
    .select('*')
    .single();

  if (error || !data) {
    return fail(`No se pudo crear horario: ${error?.message ?? 'unknown error'}`, 500);
  }

  return ok(data, { status: 201 });
}
