import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResultRow } from 'pg';

/**
 * Unico punto de acceso a PostgreSQL. Los repositorios siempre pasan los
 * valores en "parametros" ($1, $2, ...) y nunca los pegan dentro del texto
 * SQL: asi se evita la inyeccion SQL.
 */
@Injectable()
export class BaseDatosServicio implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configuracion: ConfigService) {
    this.pool = new Pool({
      connectionString: configuracion.getOrThrow<string>('URL_POSTGRES'),
      max: 10,
    });
  }

  async consultar<Fila extends QueryResultRow>(
    sql: string,
    parametros: unknown[] = [],
  ): Promise<Fila[]> {
    const resultado = await this.pool.query<Fila>(sql, parametros);
    return resultado.rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
