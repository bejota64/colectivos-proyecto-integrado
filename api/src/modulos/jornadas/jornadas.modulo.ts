import { Module } from '@nestjs/common';
import { FlotaModulo } from '../flota/flota.modulo';
import { TrazadosModulo } from '../trazados/trazados.modulo';
import { UsuariosModulo } from '../usuarios/usuarios.modulo';
import { JornadasControlador } from './jornadas.controlador';
import { JornadasRepositorio } from './jornadas.repositorio';
import { JornadasServicio } from './jornadas.servicio';
import { UbicacionesRepositorio } from './ubicaciones.repositorio';

/** Capa de operacion. Depende solo de capas inferiores: datos maestros y acceso. */
@Module({
  imports: [FlotaModulo, TrazadosModulo, UsuariosModulo],
  controllers: [JornadasControlador],
  providers: [JornadasRepositorio, JornadasServicio, UbicacionesRepositorio],
  exports: [JornadasRepositorio, JornadasServicio, UbicacionesRepositorio],
})
export class JornadasModulo {}
