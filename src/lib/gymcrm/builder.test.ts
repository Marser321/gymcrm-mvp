import { describe, expect, it } from 'vitest';
import { getBuilderTemplate, listBuilderTemplates, normalizeBuilderDefinition } from '@/lib/gymcrm/builder';

describe('gymcrm builder templates', () => {
  it('returns all base templates', () => {
    const templates = listBuilderTemplates();
    expect(templates.length).toBe(5);
  });

  it('uses template defaults when definition is missing', () => {
    const normalized = normalizeBuilderDefinition('clase_grupal');
    const template = getBuilderTemplate('clase_grupal');

    expect(normalized.reglas.cupoPorSesion).toBe(template.defaultDefinition.reglas.cupoPorSesion);
    expect(normalized.campos.length).toBeGreaterThan(0);
  });

  it('sanitizes custom fields and rules', () => {
    const normalized = normalizeBuilderDefinition('cancha', {
      campos: [
        { key: ' cancha ', label: 'Cancha', type: 'text', required: true },
        { key: '', label: 'Invalido', type: 'text', required: false },
      ],
      reglas: {
        cupoPorSesion: 10,
        ventanaReservaHoras: 48,
        cancelacionMinutosAntes: 45,
        permiteEspera: false,
      },
    });

    expect(normalized.campos).toHaveLength(1);
    expect(normalized.campos[0].key).toBe('cancha');
    expect(normalized.reglas.cupoPorSesion).toBe(10);
    expect(normalized.reglas.permiteEspera).toBe(false);
  });
});
