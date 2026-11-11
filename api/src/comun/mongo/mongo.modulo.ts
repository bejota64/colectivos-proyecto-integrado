import { Global, Module } from '@nestjs/common';
import { MongoServicio } from './mongo.servicio';

/** Global, igual que BaseDatosModulo: cualquier modulo puede inyectar MongoServicio. */
@Global()
@Module({
  providers: [MongoServicio],
  exports: [MongoServicio],
})
export class MongoModulo {}
