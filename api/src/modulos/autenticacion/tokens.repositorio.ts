import { Injectable } from '@nestjs/common';
import { BaseDatosServicio } from '../../comun/base-datos/base-datos.servicio';

export interface TokenRefrescoFila {
  id: string;
  usuario_id: string;
  expira_en: Date;
  revocado_en: Date | null;
}

/** En la base solo se guarda el hash del token de refresco, nunca el token. */
@Injectable()
export class TokensRepositorio {
  constructor(private readonly baseDatos: BaseDatosServicio) {}

  async crear(datos: {
    usuarioId: string;
    tokenHash: string;
    expiraEn: Date;
  }): Promise<void> {
    await this.baseDatos.consultar(
      `INSERT INTO tokens_refresco (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)`,
      [datos.usuarioId, datos.tokenHash, datos.expiraEn],
    );
  }

  async buscarPorHash(tokenHash: string): Promise<TokenRefrescoFila | null> {
    const filas = await this.baseDatos.consultar<TokenRefrescoFila>(
      `SELECT id, usuario_id, expira_en, revocado_en FROM tokens_refresco WHERE token_hash = $1`,
      [tokenHash],
    );
    return filas[0] ?? null;
  }

  /**
   * Revoca un token solo si sigue vigente. Devuelve false si ya estaba
   * revocado: la condicion va en el UPDATE para que dos peticiones
   * simultaneas no puedan usar el mismo token.
   */
  async revocar(id: string): Promise<boolean> {
    const filas = await this.baseDatos.consultar<{ id: string }>(
      `UPDATE tokens_refresco SET revocado_en = now()
       WHERE id = $1 AND revocado_en IS NULL
       RETURNING id`,
      [id],
    );
    return filas.length === 1;
  }

  async revocarTodosDeUsuario(usuarioId: string): Promise<void> {
    await this.baseDatos.consultar(
      `UPDATE tokens_refresco SET revocado_en = now()
       WHERE usuario_id = $1 AND revocado_en IS NULL`,
      [usuarioId],
    );
  }
}
