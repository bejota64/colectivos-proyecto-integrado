import { Module } from '@nestjs/common';
import { ValoracionesControlador } from './valoraciones.controlador';
import { ValoracionesRepositorio } from './valoraciones.repositorio';
import { ValoracionesServicio } from './valoraciones.servicio';

/** Capa de operacion. Solo lee la tabla abordajes dentro de su propio SQL. */
@Module({
  controllers: [ValoracionesControlador],
  providers: [ValoracionesRepositorio, ValoracionesServicio],
})
export class ValoracionesModulo {}
