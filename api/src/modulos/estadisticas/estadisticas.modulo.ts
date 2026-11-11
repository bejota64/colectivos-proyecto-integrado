import { Module } from '@nestjs/common';
import { TrazadosModulo } from '../trazados/trazados.modulo';
import { EstadisticasControlador } from './estadisticas.controlador';
import { EstadisticasRepositorio } from './estadisticas.repositorio';
import { EstadisticasServicio } from './estadisticas.servicio';

/** Capa de analisis: la mas alta. Solo lee; nadie depende de ella. */
@Module({
  imports: [TrazadosModulo],
  controllers: [EstadisticasControlador],
  providers: [EstadisticasRepositorio, EstadisticasServicio],
})
export class EstadisticasModulo {}
