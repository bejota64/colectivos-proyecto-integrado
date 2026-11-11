import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BaseDatosModulo } from './comun/base-datos/base-datos.modulo';
import { validarEntorno } from './comun/entorno';
import { ErroresFiltro } from './comun/filtros/errores.filtro';
import { RolesGuard } from './comun/guards/roles.guard';
import { SesionGuard } from './comun/guards/sesion.guard';
import { MongoModulo } from './comun/mongo/mongo.modulo';
import { AbordajesModulo } from './modulos/abordajes/abordajes.modulo';
import { AuditoriaModulo } from './modulos/auditoria/auditoria.modulo';
import { AutenticacionModulo } from './modulos/autenticacion/autenticacion.modulo';
import { EstadisticasModulo } from './modulos/estadisticas/estadisticas.modulo';
import { FlotaModulo } from './modulos/flota/flota.modulo';
import { JornadasModulo } from './modulos/jornadas/jornadas.modulo';
import { TiempoRealModulo } from './modulos/tiempo-real/tiempo-real.modulo';
import { TrazadosModulo } from './modulos/trazados/trazados.modulo';
import { UsuariosModulo } from './modulos/usuarios/usuarios.modulo';
import { ValoracionesModulo } from './modulos/valoraciones/valoraciones.modulo';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),
    // Limite general por IP y por minuto (100 si no se configura). Las rutas de
    // credenciales usan uno mas estricto y fijo. Se lee del entorno para poder
    // subirlo durante la prueba de carga, nunca en produccion.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configuracion: ConfigService) => [
        {
          ttl: 60_000,
          limit: Number(configuracion.getOrThrow('LIMITE_GENERAL_POR_MINUTO')),
        },
      ],
    }),
    // Infraestructura comun (globales)
    BaseDatosModulo,
    MongoModulo,
    // Capa 1, acceso
    AuditoriaModulo,
    UsuariosModulo,
    AutenticacionModulo,
    // Capa 2, datos maestros
    TrazadosModulo,
    FlotaModulo,
    // Capa 3, operacion
    JornadasModulo,
    TiempoRealModulo,
    AbordajesModulo,
    ValoracionesModulo,
    // Capa 4, analisis
    EstadisticasModulo,
  ],
  providers: [
    // Los guards globales corren en este orden: limite, sesion, rol.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SesionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Un solo lugar decide que ve el cliente cuando algo falla.
    { provide: APP_FILTER, useClass: ErroresFiltro },
  ],
})
export class AppModule {}
