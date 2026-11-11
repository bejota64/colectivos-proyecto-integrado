import { Global, Module } from '@nestjs/common';
import { AuditoriaServicio } from './auditoria.servicio';

/** Global: la auditoria la usan modulos de todas las capas. */
@Global()
@Module({
  providers: [AuditoriaServicio],
  exports: [AuditoriaServicio],
})
export class AuditoriaModulo {}
