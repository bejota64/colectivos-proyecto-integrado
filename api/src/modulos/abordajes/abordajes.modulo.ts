import { Module } from '@nestjs/common';
import { JornadasModulo } from '../jornadas/jornadas.modulo';
import { TrazadosModulo } from '../trazados/trazados.modulo';
import { UsuariosModulo } from '../usuarios/usuarios.modulo';
import {
  AbordajesControlador,
  AvisosControlador,
} from './abordajes.controlador';
import { AbordajesRepositorio } from './abordajes.repositorio';
import { AbordajesServicio } from './abordajes.servicio';
import { AvisosRepositorio } from './avisos.repositorio';
import { AvisosServicio } from './avisos.servicio';
import { DemandaRepositorio } from './demanda.repositorio';

/** Capa de operacion: avisos de espera y "me subi". */
@Module({
  imports: [JornadasModulo, TrazadosModulo, UsuariosModulo],
  controllers: [AvisosControlador, AbordajesControlador],
  providers: [
    AbordajesRepositorio,
    AbordajesServicio,
    AvisosRepositorio,
    AvisosServicio,
    DemandaRepositorio,
  ],
})
export class AbordajesModulo {}
