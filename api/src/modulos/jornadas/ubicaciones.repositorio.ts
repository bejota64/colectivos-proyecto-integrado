import { Injectable } from '@nestjs/common';
import {
  MongoServicio,
  type UbicacionDoc,
} from '../../comun/mongo/mongo.servicio';

/**
 * Posiciones GPS de las jornadas, en MongoDB (caducan solas a las 24 h).
 * Vive en el modulo de jornadas porque la posicion es un dato de la
 * jornada: asi tiempo-real y abordajes la leen sin depender entre ellos.
 */
@Injectable()
export class UbicacionesRepositorio {
  constructor(private readonly mongo: MongoServicio) {}

  private get coleccion() {
    return this.mongo.coleccion<UbicacionDoc>('ubicaciones_vehiculos');
  }

  async guardar(ubicacion: UbicacionDoc): Promise<void> {
    await this.coleccion.insertOne(ubicacion);
  }

  /** Usa el indice { jornada_id: 1, registrada_en: -1 } del script de colecciones. */
  ultima(jornadaId: string): Promise<UbicacionDoc | null> {
    return this.coleccion.findOne(
      { jornada_id: jornadaId },
      { sort: { registrada_en: -1 }, projection: { _id: 0 } },
    );
  }

  /** Ultima posicion de varias jornadas, en una sola consulta. */
  async ultimasDe(jornadaIds: string[]): Promise<Map<string, UbicacionDoc>> {
    if (jornadaIds.length === 0) {
      return new Map();
    }
    const filas = await this.coleccion
      .aggregate<UbicacionDoc>([
        { $match: { jornada_id: { $in: jornadaIds } } },
        { $sort: { registrada_en: -1 } },
        { $group: { _id: '$jornada_id', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
        { $project: { _id: 0 } },
      ])
      .toArray();
    return new Map(filas.map((u) => [u.jornada_id, u]));
  }
}
