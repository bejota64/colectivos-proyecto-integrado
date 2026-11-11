import {
  type ArgumentsHost,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { crearAuditoriaFalsa } from '../../../test/datos/recorrido-9001';
import type { AuditoriaServicio } from '../../modulos/auditoria/auditoria.servicio';
import { ErroresFiltro } from './errores.filtro';

/** OWASP A10:2025: lo que ve el cliente cuando algo falla. */
describe('ErroresFiltro', () => {
  let auditoria: ReturnType<typeof crearAuditoriaFalsa>;
  let filtro: ErroresFiltro;
  let enviado: { estado: number; cuerpo: unknown };

  const host = () =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          path: '/api/estadisticas/trazados/x/demanda',
          ip: '203.0.113.7',
          usuario: { id: 'usuario-1', rol: 'pasajero' },
        }),
        getResponse: () => ({
          status(estado: number) {
            enviado.estado = estado;
            return this;
          },
          json(cuerpo: unknown) {
            enviado.cuerpo = cuerpo;
          },
        }),
      }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    auditoria = crearAuditoriaFalsa();
    filtro = new ErroresFiltro(auditoria as unknown as AuditoriaServicio);
    enviado = { estado: 0, cuerpo: null };
  });

  it('un error inesperado responde 500 generico, sin SQL ni trazas', () => {
    filtro.catch(
      new Error('relation "usuarios" does not exist at /app/src/x.ts:42'),
      host(),
    );
    expect(enviado.estado).toBe(500);
    expect(JSON.stringify(enviado.cuerpo)).not.toContain('usuarios');
    expect(JSON.stringify(enviado.cuerpo)).not.toContain('.ts');
  });

  it('un error previsto sale con su codigo y su mensaje', () => {
    filtro.catch(new NotFoundException('Trazado no encontrado'), host());
    expect(enviado.estado).toBe(404);
  });

  it('un 403 queda en la auditoria como acceso denegado, con la IP', () => {
    filtro.catch(new ForbiddenException('No tienes permiso'), host());
    expect(enviado.estado).toBe(403);
    expect(auditoria.eventos[0].tipo).toBe('acceso_denegado');
  });
});
