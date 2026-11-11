import { Module } from '@nestjs/common';
import { FlotaControlador } from './flota.controlador';
import { FlotaRepositorio } from './flota.repositorio';

/** Capa de datos maestros: vehiculos y conductores. */
@Module({
  controllers: [FlotaControlador],
  providers: [FlotaRepositorio],
  exports: [FlotaRepositorio],
})
export class FlotaModulo {}
