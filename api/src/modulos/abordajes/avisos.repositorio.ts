import { Injectable } from '@nestjs/common';
import {
  type AvisoEsperaDoc,
  DUPLICADO_MONGO,
  MongoServicio,
} from '../../comun/mongo/mongo.servicio';

export interface AvisoAdelante {
  distancia_ruta_m: number;
  personas: number;
}

/** Avisos "estoy esperando" en MongoDB. Caducan solos (indice TTL en expira_en). */
@Injectable()
export class AvisosRepositorio {
  constructor(private readonly mongo: MongoServicio) {}

  private get coleccion() {
    return this.mongo.coleccion<AvisoEsperaDoc>('avisos_espera');
  }

  buscar(pasajeroId: string): Promise<AvisoEsperaDoc | null> {
    return this.coleccion.findOne(
      { pasajero_id: pasajeroId },
      { projection: { _id: 0 } },
    );
  }

  /** Devuelve false si el pasajero ya tenia un aviso (indice unico de pasajero_id). */
  async crear(aviso: AvisoEsperaDoc): Promise<boolean> {
    try {
      await this.coleccion.insertOne({ ...aviso });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICADO_MONGO) {
        return false;
      }
      throw error;
    }
  }

  /** Reactiva el mismo documento: la demanda no se vuelve a sumar. */
  async reactivar(
    pasajeroId: string,
    cambios: Pick<
      AvisoEsperaDoc,
      'sentido_id' | 'ubicacion' | 'distancia_ruta_m' | 'personas'
    >,
  ): Promise<void> {
    await this.coleccion.updateOne(
      { pasajero_id: pasajeroId },
      { $set: { ...cambios, terminado_en: null } },
    );
  }

  async eliminar(pasajeroId: string): Promise<void> {
    await this.coleccion.deleteOne({ pasajero_id: pasajeroId });
  }

  /** Marca el aviso como terminado (cancelado o abordado). false si no habia uno activo. */
  async terminar(pasajeroId: string, ahora: Date): Promise<boolean> {
    const resultado = await this.coleccion.updateOne(
      { pasajero_id: pasajeroId, terminado_en: null, expira_en: { $gt: ahora } },
      { $set: { terminado_en: ahora } },
    );
    return resultado.matchedCount === 1;
  }

  /**
   * Avisos activos mas adelante en el recorrido. Solo distancia y personas:
   * el conductor sabe DONDE hay gente, nunca QUIEN es.
   */
  listarAdelante(
    sentidoId: string,
    desdeM: number,
    ahora: Date,
  ): Promise<AvisoAdelante[]> {
    return this.coleccion
      .find(
        {
          sentido_id: sentidoId,
          terminado_en: null,
          expira_en: { $gt: ahora },
          distancia_ruta_m: { $gte: desdeM },
        },
        { projection: { _id: 0, distancia_ruta_m: 1, personas: 1 } },
      )
      .sort({ distancia_ruta_m: 1 })
      .limit(50)
      .toArray() as Promise<AvisoAdelante[]>;
  }
}
