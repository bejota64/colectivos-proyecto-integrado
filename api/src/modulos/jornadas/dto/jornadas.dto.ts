import { IsInt, IsUUID, Max, Min } from 'class-validator';

/**
 * DTO = lo unico que acepta cada ruta. Con whitelist y forbidNonWhitelisted
 * (configurar-aplicacion.ts), cualquier campo de mas responde 400. Por eso
 * el conductor no puede mandar, por ejemplo, "conductor_id" de otra persona:
 * ese dato sale siempre de la sesion.
 *
 * OJO: los DTO se importan como valor (sin "import type") en los
 * controladores. Si se importan como tipo, NestJS no ve la clase y la
 * validacion deja de funcionar sin avisar.
 */
export class AbrirJornadaDto {
  @IsUUID('4')
  vehiculo_id!: string;

  @IsUUID('4')
  sentido_id!: string;
}

export class CambiarAsientosDto {
  // El tope real (capacidad del vehiculo) lo revisa el servicio.
  @IsInt()
  @Min(0)
  @Max(4)
  asientos_disponibles!: number;
}

export class CambiarSentidoDto {
  @IsUUID('4')
  sentido_id!: string;
}
