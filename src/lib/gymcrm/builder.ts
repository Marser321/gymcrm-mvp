export const BUILDER_TEMPLATE_KEYS = [
  'clase_grupal',
  'artes_marciales',
  'cancha',
  'sesion_personal',
  'evento_outdoor',
] as const;

export type BuilderTemplateKey = (typeof BUILDER_TEMPLATE_KEYS)[number];

export type BuilderFieldType = 'text' | 'number' | 'datetime' | 'boolean' | 'select';

export type BuilderFieldDefinition = {
  key: string;
  label: string;
  type: BuilderFieldType;
  required: boolean;
  options?: string[];
};

export type BuilderRulesDefinition = {
  cupoPorSesion: number;
  ventanaReservaHoras: number;
  cancelacionMinutosAntes: number;
  permiteEspera: boolean;
};

export type BuilderDefinition = {
  plantilla: BuilderTemplateKey;
  campos: BuilderFieldDefinition[];
  reglas: BuilderRulesDefinition;
};

type BuilderTemplate = {
  key: BuilderTemplateKey;
  nombre: string;
  descripcion: string;
  defaultDefinition: BuilderDefinition;
};

const baseRules = {
  cupoPorSesion: 20,
  ventanaReservaHoras: 168,
  cancelacionMinutosAntes: 30,
  permiteEspera: true,
} as const;

const templates: Record<BuilderTemplateKey, BuilderTemplate> = {
  clase_grupal: {
    key: 'clase_grupal',
    nombre: 'Clase grupal',
    descripcion: 'Sesiones grupales de gimnasio (HIIT, funcional, movilidad, etc.)',
    defaultDefinition: {
      plantilla: 'clase_grupal',
      campos: [
        { key: 'instructor', label: 'Instructor', type: 'text', required: true },
        { key: 'nivel', label: 'Nivel', type: 'select', required: false, options: ['principiante', 'intermedio', 'avanzado'] },
        { key: 'duracion_min', label: 'Duracion (min)', type: 'number', required: true },
      ],
      reglas: {
        ...baseRules,
        cupoPorSesion: 25,
      },
    },
  },
  artes_marciales: {
    key: 'artes_marciales',
    nombre: 'Artes marciales',
    descripcion: 'Clases y seminarios de disciplinas marciales por nivel.',
    defaultDefinition: {
      plantilla: 'artes_marciales',
      campos: [
        { key: 'disciplina', label: 'Disciplina', type: 'select', required: true, options: ['jiu_jitsu', 'muay_thai', 'karate', 'taekwondo'] },
        { key: 'cinturon_minimo', label: 'Cinturon minimo', type: 'text', required: false },
        { key: 'duracion_min', label: 'Duracion (min)', type: 'number', required: true },
      ],
      reglas: {
        ...baseRules,
        cupoPorSesion: 18,
        cancelacionMinutosAntes: 60,
      },
    },
  },
  cancha: {
    key: 'cancha',
    nombre: 'Cancha deportiva',
    descripcion: 'Reserva de cancha para partidos y entrenamientos.',
    defaultDefinition: {
      plantilla: 'cancha',
      campos: [
        { key: 'deporte', label: 'Deporte', type: 'select', required: true, options: ['futbol', 'basket', 'tenis', 'padel'] },
        { key: 'duracion_min', label: 'Duracion (min)', type: 'number', required: true },
        { key: 'equipamiento', label: 'Incluye equipamiento', type: 'boolean', required: false },
      ],
      reglas: {
        ...baseRules,
        cupoPorSesion: 2,
        ventanaReservaHoras: 336,
      },
    },
  },
  sesion_personal: {
    key: 'sesion_personal',
    nombre: 'Sesion personal',
    descripcion: 'Entrenamiento 1:1 o de grupos reducidos.',
    defaultDefinition: {
      plantilla: 'sesion_personal',
      campos: [
        { key: 'entrenador', label: 'Entrenador', type: 'text', required: true },
        { key: 'objetivo', label: 'Objetivo', type: 'text', required: true },
        { key: 'duracion_min', label: 'Duracion (min)', type: 'number', required: true },
      ],
      reglas: {
        ...baseRules,
        cupoPorSesion: 1,
        ventanaReservaHoras: 72,
      },
    },
  },
  evento_outdoor: {
    key: 'evento_outdoor',
    nombre: 'Evento outdoor',
    descripcion: 'Carreras, salidas activas y actividades al aire libre.',
    defaultDefinition: {
      plantilla: 'evento_outdoor',
      campos: [
        { key: 'ubicacion', label: 'Ubicacion', type: 'text', required: true },
        { key: 'distancia_km', label: 'Distancia (km)', type: 'number', required: false },
        { key: 'dificultad', label: 'Dificultad', type: 'select', required: false, options: ['baja', 'media', 'alta'] },
      ],
      reglas: {
        ...baseRules,
        cupoPorSesion: 100,
        cancelacionMinutosAntes: 180,
      },
    },
  },
};

const FIELD_TYPES: readonly BuilderFieldType[] = ['text', 'number', 'datetime', 'boolean', 'select'];

const normalizeField = (field: unknown): BuilderFieldDefinition | null => {
  if (!field || typeof field !== 'object') return null;
  const item = field as Record<string, unknown>;

  const key = typeof item.key === 'string' ? item.key.trim().toLowerCase() : '';
  const label = typeof item.label === 'string' ? item.label.trim() : '';
  const type = typeof item.type === 'string' ? item.type : 'text';

  if (!key || !label || !FIELD_TYPES.includes(type as BuilderFieldType)) {
    return null;
  }

  const options = Array.isArray(item.options)
    ? item.options.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : undefined;

  return {
    key,
    label,
    type: type as BuilderFieldType,
    required: Boolean(item.required),
    options: options && options.length > 0 ? options : undefined,
  };
};

const toPositiveInt = (value: unknown, fallback: number, max = 10_000): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

export const isBuilderTemplateKey = (value: string): value is BuilderTemplateKey => {
  return (BUILDER_TEMPLATE_KEYS as readonly string[]).includes(value);
};

export const getBuilderTemplate = (key: BuilderTemplateKey): BuilderTemplate => {
  return templates[key];
};

export const listBuilderTemplates = (): BuilderTemplate[] => {
  return BUILDER_TEMPLATE_KEYS.map((key) => templates[key]);
};

export const normalizeBuilderDefinition = (
  templateKey: BuilderTemplateKey,
  definitionRaw?: unknown
): BuilderDefinition => {
  const template = templates[templateKey];
  const defaultDef = template.defaultDefinition;

  if (!definitionRaw || typeof definitionRaw !== 'object') {
    return defaultDef;
  }

  const raw = definitionRaw as Record<string, unknown>;

  const rawFields = Array.isArray(raw.campos)
    ? raw.campos
        .map(normalizeField)
        .filter((field): field is BuilderFieldDefinition => field !== null)
    : [];
  const mergedFields = rawFields.length > 0 ? rawFields : defaultDef.campos;

  const rawRules = raw.reglas && typeof raw.reglas === 'object' ? (raw.reglas as Record<string, unknown>) : {};

  return {
    plantilla: templateKey,
    campos: mergedFields,
    reglas: {
      cupoPorSesion: toPositiveInt(rawRules.cupoPorSesion, defaultDef.reglas.cupoPorSesion, 500),
      ventanaReservaHoras: toPositiveInt(rawRules.ventanaReservaHoras, defaultDef.reglas.ventanaReservaHoras, 24 * 365),
      cancelacionMinutosAntes: toPositiveInt(rawRules.cancelacionMinutosAntes, defaultDef.reglas.cancelacionMinutosAntes, 24 * 60),
      permiteEspera:
        typeof rawRules.permiteEspera === 'boolean'
          ? rawRules.permiteEspera
          : defaultDef.reglas.permiteEspera,
    },
  };
};
