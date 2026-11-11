import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsuariosModulo } from '../usuarios/usuarios.modulo';
import { AutenticacionControlador } from './autenticacion.controlador';
import { AutenticacionServicio } from './autenticacion.servicio';
import { ContrasenasServicio } from './contrasenas.servicio';
import { IntentosServicio } from './intentos.servicio';
import { TokensRepositorio } from './tokens.repositorio';

@Module({
  imports: [
    UsuariosModulo,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configuracion: ConfigService) => ({
        secret: configuracion.getOrThrow<string>('SECRETO_JWT'),
        // Algoritmo fijo al firmar y al verificar: un token con otro algoritmo, o sin firma, se rechaza.
        signOptions: { expiresIn: '15m', algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AutenticacionControlador],
  providers: [
    AutenticacionServicio,
    ContrasenasServicio,
    IntentosServicio,
    TokensRepositorio,
  ],
  // SesionGuard, que es global, necesita JwtService.
  exports: [JwtModule],
})
export class AutenticacionModulo {}
