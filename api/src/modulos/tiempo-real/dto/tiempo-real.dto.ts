import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Coordenadas acotadas a Chile, los mismos limites que los CHECK del
 * esquema y el validador de MongoDB: un dato absurdo se rechaza en la
 * entrada, antes de llegar a las bases.
 */
export class PosicionDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-56.5)
  @Max(-17.0)
  latitud!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-76.0)
  @Max(-66.0)
  longitud!: number;

  /** La que entrega el GPS del telefono. Si no viene, se calcula. */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(150)
  velocidad_kmh?: number;
}

/** Parametros de ?consulta: llegan como texto, @Type los convierte a numero. */
export class ColectivosConsultaDto {
  @IsUUID('4')
  sentido_id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-56.5)
  @Max(-17.0)
  latitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-76.0)
  @Max(-66.0)
  longitud?: number;
}
