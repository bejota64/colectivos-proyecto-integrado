export const ROLES = [
  'pasajero',
  'conductor',
  'representante',
  'administrador',
] as const;

export type Rol = (typeof ROLES)[number];

/** Datos del usuario autenticado que SesionGuard deja en la peticion. */
export interface UsuarioSesion {
  id: string;
  rol: Rol;
}
