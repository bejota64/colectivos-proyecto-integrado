import { SetMetadata } from '@nestjs/common';

export const CLAVE_PUBLICO = 'esPublico';

/**
 * Marca una ruta como abierta. Todo lo que NO lleve este decorador exige
 * sesion: se deniega por defecto.
 */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);
