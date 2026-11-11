import { Module } from '@nestjs/common';
import { SaludControlador } from './salud.controlador';
import { SaludServicio } from './salud.servicio';

/** Estado del servicio para Docker y el monitoreo. Solo depende de los modulos globales de datos. */
@Module({
  controllers: [SaludControlador],
  providers: [SaludServicio],
})
export class SaludModulo {}
