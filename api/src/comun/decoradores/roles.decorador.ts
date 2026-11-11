import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../tipos';

export const CLAVE_ROLES = 'roles';

/** Limita una ruta a los roles indicados. Sin este decorador basta con tener sesion. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);
