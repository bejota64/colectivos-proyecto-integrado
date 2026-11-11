import { IntentosServicio } from './intentos.servicio';

const MINUTO = 60 * 1000;
const correo = 'persona@ejemplo.cl';

/** Cantidad de cuentas en memoria: se lee el campo privado solo para esta prueba. */
const cuentasVigiladas = (servicio: IntentosServicio) =>
  (servicio as unknown as { registros: Map<string, unknown> }).registros.size;

describe('IntentosServicio', () => {
  let intentos: IntentosServicio;

  beforeEach(() => {
    intentos = new IntentosServicio();
  });

  it('no bloquea con cuatro fallos', () => {
    for (let i = 0; i < 4; i++) intentos.registrarFallo(correo, 1000 + i);
    expect(intentos.estaBloqueada(correo, 2000)).toBe(false);
  });

  it('bloquea al quinto fallo y libera a los 15 minutos', () => {
    for (let i = 0; i < 5; i++) intentos.registrarFallo(correo, 1000 + i);
    expect(intentos.estaBloqueada(correo, 2000)).toBe(true);
    expect(intentos.estaBloqueada(correo, 1004 + 15 * MINUTO - 1)).toBe(true);
    expect(intentos.estaBloqueada(correo, 1004 + 15 * MINUTO + 1)).toBe(false);
  });

  it('no cuenta los fallos de hace mas de 15 minutos', () => {
    for (let i = 0; i < 4; i++) intentos.registrarFallo(correo, i);
    intentos.registrarFallo(correo, 16 * MINUTO);
    expect(intentos.estaBloqueada(correo, 16 * MINUTO + 1)).toBe(false);
  });

  it('un inicio de sesion correcto borra los fallos', () => {
    for (let i = 0; i < 4; i++) intentos.registrarFallo(correo, i);
    intentos.limpiar(correo);
    intentos.registrarFallo(correo, 10);
    expect(intentos.estaBloqueada(correo, 11)).toBe(false);
  });

  it('el bloqueo de una cuenta no afecta a otra', () => {
    for (let i = 0; i < 5; i++) intentos.registrarFallo(correo, i);
    expect(intentos.estaBloqueada('otra@ejemplo.cl', 10)).toBe(false);
  });

  it('con 10.000 cuentas vigiladas borra las que no tienen fallos recientes', () => {
    for (let i = 0; i < 10_000; i++) {
      intentos.registrarFallo(`cuenta${i}@ejemplo.cl`, 0);
    }
    intentos.registrarFallo(correo, 16 * MINUTO);
    expect(cuentasVigiladas(intentos)).toBe(1);
  });

  it('si las 10.000 siguen activas vacia el registro para no agotar la memoria', () => {
    for (let i = 0; i < 10_000; i++) {
      intentos.registrarFallo(`cuenta${i}@ejemplo.cl`, 1000);
    }
    intentos.registrarFallo(correo, 2000);
    expect(cuentasVigiladas(intentos)).toBe(1);
  });
});
