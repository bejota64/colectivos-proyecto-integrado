import { IsISO8601, IsOptional, Matches } from 'class-validator';

export class DemandaConsultaDto {
  /** AAAA-MM-DD y una fecha que exista (strict rechaza 2026-02-30). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe ser AAAA-MM-DD' })
  @IsISO8601({ strict: true })
  fecha?: string;
}
