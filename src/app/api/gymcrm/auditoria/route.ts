import { okList, fail } from '@/lib/gymcrm/api';
import { hasRole, PERMISSIONS } from '@/lib/gymcrm/permissions';
import { getAuthContext, gymTable, parsePagination } from '@/lib/gymcrm/server';

export async function GET(request: Request) {
  const authCtx = await getAuthContext();
  if (!authCtx.ok) return authCtx.response;

  if (!hasRole(authCtx.context.role, PERMISSIONS.auditoria)) {
    return fail('No tienes permisos para consultar auditoría.', 403);
  }

  const url = new URL(request.url);
  const entidad = url.searchParams.get('entidad');
  const { from, to } = parsePagination(url.searchParams);

  const query = authCtx.client.database
    .from(gymTable('auditoria_critica'))
    .select('*', { count: 'exact' })
    .eq('gimnasio_id', authCtx.context.gimnasioId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (entidad) query.eq('entidad', entidad);

  const { data, error, count } = await query;
  if (error) return fail(`No se pudo consultar auditoría: ${error.message}`, 500);

  return okList(data ?? [], count ?? 0);
}
