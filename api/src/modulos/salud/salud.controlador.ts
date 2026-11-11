import { Controller, Get } from '@nestjs/common';
import { Publico } from '../../comun/decoradores/publico.decorador';
import { SaludServicio } from './salud.servicio';

@Controller('salud')
export class SaludControlador {
  constructor(private readonly salud: SaludServicio) {}

  /**
   * Publica a proposito: Docker y el monitoreo la consultan sin sesion.
   * Sigue sujeta al limite general de peticiones por IP.
   */
  @Publico()
  @Get()
  revisar() {
    return this.salud.revisar();
  }
}
