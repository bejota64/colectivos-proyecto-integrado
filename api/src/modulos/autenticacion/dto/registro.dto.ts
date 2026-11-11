import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const aCorreo = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Lo unico que acepta el registro. No existe el campo "rol": con
 * forbidNonWhitelisted, enviar un campo extra responde 400.
 */
export class RegistroDto {
  @Transform(recortar)
  @IsString()
  @Length(3, 120)
  nombre_completo!: string;

  @Transform(aCorreo)
  @IsEmail()
  @MaxLength(254)
  correo_electronico!: string;

  @IsString()
  @Length(12, 64)
  contrasena!: string;

  @IsBoolean()
  @Equals(true, {
    message: 'Debes aceptar los terminos de uso y la politica de privacidad',
  })
  acepta_terminos!: boolean;
}
