import { Injectable } from '@nestjs/common';

const MAXIMO_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;
/** Tope de cuentas vigiladas, para que un atacante no llene la memoria con correos inventados. */
const MAXIMO_REGISTROS = 10_000;

interface Registro {
  fallos: number[];
  bloqueadaHasta: number;
}

/**
 * Bloqueo temporal por cuenta: 5 fallos en 15 minutos bloquean el inicio de
 * sesion por 15 minutos. Vive en memoria porque la API corre en una sola
 * instancia; con mas de una, este estado se mueve a Redis.
 */
@Injectable()
export class IntentosServicio {
  private readonly registros = new Map<string, Registro>();

  estaBloqueada(correo: string, ahora: number = Date.now()): boolean {
    const registro = this.registros.get(correo);
    return registro !== undefined && registro.bloqueadaHasta > ahora;
  }

  registrarFallo(correo: string, ahora: number = Date.now()): void {
    if (this.registros.size >= MAXIMO_REGISTROS) {
      this.depurar(ahora);
    }
    const registro = this.registros.get(correo) ?? {
      fallos: [],
      bloqueadaHasta: 0,
    };
    registro.fallos = registro.fallos.filter(
      (momento) => ahora - momento < VENTANA_MS,
    );
    registro.fallos.push(ahora);
    if (registro.fallos.length >= MAXIMO_FALLOS) {
      registro.bloqueadaHasta = ahora + BLOQUEO_MS;
      registro.fallos = [];
    }
    this.registros.set(correo, registro);
  }

  limpiar(correo: string): void {
    this.registros.delete(correo);
  }

  private depurar(ahora: number): void {
    for (const [correo, registro] of this.registros) {
      const sinFallosRecientes = registro.fallos.every(
        (momento) => ahora - momento >= VENTANA_MS,
      );
      if (registro.bloqueadaHasta <= ahora && sinFallosRecientes) {
        this.registros.delete(correo);
      }
    }
    if (this.registros.size >= MAXIMO_REGISTROS) {
      this.registros.clear();
    }
  }
}
