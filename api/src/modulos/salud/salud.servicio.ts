import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';
import { MongoServicio } from '../../comun/mongo/mongo.servicio';

/** Tiempo maximo que se espera a cada base antes de darla por caida. */
export const ESPERA_MAXIMA_SALUD_MS = 2000;

export interface EstadoSalud {
  estado: 'ok';
}

/**
 * Dice si la API puede atender: responde "ok" solo si las dos bases
 * contestan. La usan el healthcheck de Docker y el monitoreo del servidor.
 * Al cliente solo le llega "ok" o un 503 generico; que base fallo queda en
 * el log del servidor, para no revelar detalles internos.
 */
@Injectable()
export class SaludServicio {
  private readonly log = new Logger(SaludServicio.name);

  constructor(
    private readonly baseDatos: BaseDatosServicio,
    private readonly mongo: MongoServicio,
  ) {}

  async revisar(): Promise<EstadoSalud> {
    const resultados = await Promise.all([
      this.comprobar('PostgreSQL', () => this.baseDatos.consultar('SELECT 1')),
      this.comprobar('MongoDB', () => this.mongo.ping()),
    ]);
    const caidas = resultados.filter((nombre) => nombre !== null);

    if (caidas.length > 0) {
      this.log.warn(`Sin respuesta de: ${caidas.join(', ')}`);
      throw new ServiceUnavailableException('Servicio no disponible');
    }
    return { estado: 'ok' };
  }

  /** Devuelve el nombre de la base si no respondio a tiempo, o null si respondio. */
  private async comprobar(
    nombre: string,
    consulta: () => Promise<unknown>,
  ): Promise<string | null> {
    try {
      await conLimiteDeTiempo(consulta(), ESPERA_MAXIMA_SALUD_MS);
      return null;
    } catch {
      return nombre;
    }
  }
}

async function conLimiteDeTiempo<T>(
  promesa: Promise<T>,
  milisegundos: number,
): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new Error(`sin respuesta en ${milisegundos} ms`)),
      milisegundos,
    );
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}
