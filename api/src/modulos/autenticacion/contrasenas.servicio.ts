import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Rol } from '../../comun/tipos';
import { CONTRASENAS_COMUNES } from './contrasenas-comunes';

/** Factor de costo de bcrypt. Cada punto extra duplica el tiempo de calculo. */
const COSTO_BCRYPT = 12;
const LARGO_MAXIMO = 64;
/** bcrypt solo considera los primeros 72 bytes de la contrasena. */
const BYTES_MAXIMOS = 72;

const LARGO_MINIMO: Record<Rol, number> = {
  pasajero: 12,
  conductor: 12,
  representante: 15,
  administrador: 15,
};

@Injectable()
export class ContrasenasServicio {
  /**
   * Hash de relleno. Cuando el correo no existe igual se compara contra
   * este hash, para que la respuesta demore lo mismo y no revele por
   * tiempo que correos tienen cuenta.
   */
  private readonly hashDeRelleno = bcrypt.hashSync(
    'contrasena-de-relleno-sin-uso',
    COSTO_BCRYPT,
  );

  /** Devuelve el motivo del rechazo, o null si la contrasena cumple la politica. */
  revisarPolitica(contrasena: string, rol: Rol): string | null {
    const minimo = LARGO_MINIMO[rol];
    if (contrasena.length < minimo) {
      return `La contraseña debe tener al menos ${minimo} caracteres`;
    }
    if (
      contrasena.length > LARGO_MAXIMO ||
      Buffer.byteLength(contrasena, 'utf8') > BYTES_MAXIMOS
    ) {
      return `La contraseña no puede superar los ${LARGO_MAXIMO} caracteres`;
    }
    if (CONTRASENAS_COMUNES.has(contrasena.toLowerCase())) {
      return 'Esa contraseña es demasiado comun. Elige otra';
    }
    return null;
  }

  generarHash(contrasena: string): Promise<string> {
    return bcrypt.hash(contrasena, COSTO_BCRYPT);
  }

  async coincide(contrasena: string, hash: string | null): Promise<boolean> {
    const iguales = await bcrypt.compare(
      contrasena,
      hash ?? this.hashDeRelleno,
    );
    return hash !== null && iguales;
  }
}
