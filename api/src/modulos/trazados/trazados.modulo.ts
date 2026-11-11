import { Module } from '@nestjs/common';
import { RutasServicio } from './rutas.servicio';
import { TrazadosControlador } from './trazados.controlador';
import { TrazadosRepositorio } from './trazados.repositorio';

/** Capa de datos maestros. No depende de ningun modulo de operacion. */
@Module({
  controllers: [TrazadosControlador],
  providers: [TrazadosRepositorio, RutasServicio],
  exports: [TrazadosRepositorio, RutasServicio],
})
export class TrazadosModulo {}
