import { Module } from '@nestjs/common';
import { ConsentimientosRepositorio } from './consentimientos.repositorio';
import { ConsentimientosServicio } from './consentimientos.servicio';
import { UsuariosControlador } from './usuarios.controlador';
import { UsuariosRepositorio } from './usuarios.repositorio';

@Module({
  controllers: [UsuariosControlador],
  providers: [
    UsuariosRepositorio,
    ConsentimientosRepositorio,
    ConsentimientosServicio,
  ],
  exports: [UsuariosRepositorio, ConsentimientosServicio],
})
export class UsuariosModulo {}
