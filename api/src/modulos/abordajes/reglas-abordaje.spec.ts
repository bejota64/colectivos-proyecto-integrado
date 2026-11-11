import { motivoParaRechazarAbordaje } from './reglas-abordaje';

describe('"Me subi" (reglas 4 y 9 del LEEME)', () => {
  const valido = { distanciaM: 15, edadPosicionS: 4, abordajesHoy: 0 };

  it('acepta a 200 m o menos de una posicion de menos de 60 s', () => {
    expect(motivoParaRechazarAbordaje(valido)).toBeNull();
    expect(
      motivoParaRechazarAbordaje({ ...valido, distanciaM: 200, edadPosicionS: 60 }),
    ).toBeNull();
  });

  it('rechaza a mas de 200 m del colectivo', () => {
    expect(
      motivoParaRechazarAbordaje({ ...valido, distanciaM: 201 }),
    ).toContain('lejos');
  });

  it('rechaza si la posicion del colectivo tiene mas de 60 s', () => {
    expect(
      motivoParaRechazarAbordaje({ ...valido, edadPosicionS: 61 }),
    ).toContain('reciente');
  });

  it('rechaza si el colectivo nunca envio posicion', () => {
    expect(
      motivoParaRechazarAbordaje({ ...valido, distanciaM: null, edadPosicionS: null }),
    ).not.toBeNull();
  });

  it('rechaza el septimo viaje del dia', () => {
    expect(motivoParaRechazarAbordaje({ ...valido, abordajesHoy: 5 })).toBeNull();
    expect(
      motivoParaRechazarAbordaje({ ...valido, abordajesHoy: 6 }),
    ).toContain('6 viajes');
  });
});
