import { IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';

/** Ubicacion del pasajero, acotada a Chile como en el esquema. */
class UbicacionPasajeroDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-56.5)
  @Max(-17.0)
  latitud!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-76.0)
  @Max(-66.0)
  longitud!: number;
}

export class AvisoEsperaDto extends UbicacionPasajeroDto {
  @IsUUID('4')
  sentido_id!: string;

  /** De 1 a 4 personas: la capacidad legal de un colectivo (D.S. 212/1992). */
  @IsInt()
  @Min(1)
  @Max(4)
  personas!: number;
}

export class AbordajeDto extends UbicacionPasajeroDto {
  @IsUUID('4')
  jornada_id!: string;
}
