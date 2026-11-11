/**
 * Valida las variables de entorno al arrancar. Si falta algo, la API no
 * parte: es mejor fallar de inmediato que funcionar con un secreto debil.
 */
export function validarEntorno(
  valores: Record<string, unknown>,
): Record<string, unknown> {
  const errores: string[] = [];

  const urlPostgres = valores.URL_POSTGRES;
  if (typeof urlPostgres !== 'string' || !urlPostgres.startsWith('postgres')) {
    errores.push('URL_POSTGRES debe ser una direccion postgresql://');
  }

  const urlMongo = valores.URL_MONGO;
  if (typeof urlMongo !== 'string' || !urlMongo.startsWith('mongodb://')) {
    errores.push('URL_MONGO debe ser una direccion mongodb://');
  }

  // Opcional: solo si la web corre en otro origen durante el desarrollo.
  const origenWeb = valores.ORIGEN_WEB;
  if (
    origenWeb !== undefined &&
    origenWeb !== '' &&
    (typeof origenWeb !== 'string' || !/^https?:\/\/[^/]+$/.test(origenWeb))
  ) {
    errores.push('ORIGEN_WEB debe ser un origen como http://localhost:5173');
  }

  const secreto = valores.SECRETO_JWT;
  if (typeof secreto !== 'string' || secreto.length < 32) {
    errores.push('SECRETO_JWT debe tener al menos 32 caracteres');
  }

  const puerto = Number(valores.PUERTO ?? 3000);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    errores.push('PUERTO debe ser un numero entre 1 y 65535');
  }

  const limiteGeneral = Number(valores.LIMITE_GENERAL_POR_MINUTO ?? 100);
  if (!Number.isInteger(limiteGeneral) || limiteGeneral < 1) {
    errores.push(
      'LIMITE_GENERAL_POR_MINUTO debe ser un numero entero mayor que cero',
    );
  }

  if (errores.length > 0) {
    throw new Error(`Configuracion invalida: ${errores.join('; ')}`);
  }

  return {
    ...valores,
    PUERTO: puerto,
    LIMITE_GENERAL_POR_MINUTO: limiteGeneral,
  };
}
