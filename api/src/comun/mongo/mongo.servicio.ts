import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, Db, Document, MongoClient } from 'mongodb';
import type { PuntoGeoJson } from '../geo';

/** Las tres colecciones creadas por bd/mongo/inicio/01_colecciones.js. */
export type NombreColeccion =
  | 'ubicaciones_vehiculos'
  | 'avisos_espera'
  | 'registro_eventos';

/** Documento de ubicaciones_vehiculos. Debe calzar con su validador ($jsonSchema). */
export interface UbicacionDoc {
  jornada_id: string;
  vehiculo_id: string;
  sentido_id: string;
  ubicacion: PuntoGeoJson;
  distancia_ruta_m: number;
  velocidad_kmh: number;
  asientos_disponibles: number;
  registrada_en: Date;
}

/** Documento de avisos_espera. Uno por pasajero (indice unico). */
export interface AvisoEsperaDoc {
  pasajero_id: string;
  sentido_id: string;
  ubicacion: PuntoGeoJson;
  distancia_ruta_m: number;
  personas: number;
  creado_en: Date;
  expira_en: Date;
  terminado_en: Date | null;
}

/** Codigo de MongoDB para "valor duplicado en un indice unico". */
export const DUPLICADO_MONGO = 11000;

/**
 * Unico punto de acceso a MongoDB, igual que BaseDatosServicio lo es para
 * PostgreSQL. Los valores siempre van como datos dentro de objetos de
 * filtro tipados: nunca se arma un filtro con texto del cliente.
 */
@Injectable()
export class MongoServicio implements OnModuleInit, OnModuleDestroy {
  private readonly cliente: MongoClient;
  private bd: Db | null = null;

  constructor(configuracion: ConfigService) {
    this.cliente = new MongoClient(
      configuracion.getOrThrow<string>('URL_MONGO'),
      {
        maxPoolSize: 10,
        // Sin esto, un campo undefined se guardaria como null y el validador
        // de la coleccion lo rechazaria (por ejemplo direccion_ip).
        ignoreUndefined: true,
      },
    );
  }

  async onModuleInit(): Promise<void> {
    await this.cliente.connect();
    this.bd = this.cliente.db('colectivos');
  }

  /** Comprueba que el servidor responde. Lo usa la ruta de salud. */
  async ping(): Promise<void> {
    await this.cliente.db('admin').command({ ping: 1 });
  }

  coleccion<T extends Document>(nombre: NombreColeccion): Collection<T> {
    if (!this.bd) {
      throw new Error('MongoDB aun no esta conectado');
    }
    return this.bd.collection<T>(nombre);
  }

  async onModuleDestroy(): Promise<void> {
    await this.cliente.close();
  }
}
