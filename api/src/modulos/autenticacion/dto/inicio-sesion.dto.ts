import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

const aCorreo = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class InicioSesionDto {
  @Transform(aCorreo)
  @IsEmail()
  @MaxLength(254)
  correo_electronico!: string;

  // Aqui no se exige el largo minimo: esa regla es del registro. Solo se limita el maximo.
  @IsString()
  @Length(1, 64)
  contrasena!: string;
}
