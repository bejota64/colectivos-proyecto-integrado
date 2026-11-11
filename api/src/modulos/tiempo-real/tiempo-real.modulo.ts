import { Module } from '@nestjs/common';
import { JornadasModulo } from '../jornadas/jornadas.modulo';
import { TrazadosModulo } from '../trazados/trazados.modulo';
import { UsuariosModulo } from '../usuarios/usuarios.modulo';
import { TiempoRealControlador } from './tiempo-real.controlador';
import { TiempoRealServicio } from './tiempo-real.servicio';

@Module({
  imports: [JornadasModulo, TrazadosModulo, UsuariosModulo],
  controllers: [TiempoRealControlador],
  providers: [TiempoRealServicio],
})
export class TiempoRealModulo {}
