import { ok, fail } from '@/lib/gymcrm/api';
import { getGymcrmDataMode } from '@/lib/gymcrm/open-session';

export async function GET() {
  if (getGymcrmDataMode() !== 'demo') {
    return fail('Demo router deshabilitado para este entorno.', 404, 'demo_disabled');
  }

  return ok({
    message: 'GymCRM open demo router activo.',
    mode: 'demo',
  });
}

