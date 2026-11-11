/** Codigos de error de PostgreSQL que la API traduce a respuestas HTTP. */
export const VIOLACION_DE_UNICIDAD = '23505';
export const VIOLACION_DE_CHECK = '23514';

export function codigoDeError(error: unknown): string | undefined {
  return (error as { code?: string }).code;
}
