import {
  motivoAsientosInvalidos,
  motivoParaNoCambiarAsientos,
  velocidadEntre,
} from './reglas-jornada';

describe('Asientos solo con el auto detenido (Ley 21.377)', () => {
  it('acepta con el auto detenido y señal reciente', () => {
    expect(
      motivoParaNoCambiarAsientos({ velocidadKmh: 0, edadSegundos: 5 }),
    ).toBeNull();
  });

  it('rechaza en movimiento', () => {
    expect(
      motivoParaNoCambiarAsientos({ velocidadKmh: 30, edadSegundos: 5 }),
    ).toContain('detenido');
  });

  it('rechaza sin posicion o con una posicion vieja: no se puede confirmar que este detenido', () => {
    expect(motivoParaNoCambiarAsientos(null)).not.toBeNull();
    expect(
      motivoParaNoCambiarAsientos({ velocidadKmh: 0, edadSegundos: 61 }),
    ).not.toBeNull();
  });
});

describe('Asientos dentro de la capacidad (regla 3)', () => {
  it('acepta de 0 a la capacidad', () => {
    expect(motivoAsientosInvalidos(0, 4)).toBeNull();
    expect(motivoAsientosInvalidos(4, 4)).toBeNull();
  });

  it('rechaza mas que la capacidad del vehiculo', () => {
    expect(motivoAsientosInvalidos(4, 3)).not.toBeNull();
  });

  it('rechaza negativos y decimales', () => {
    expect(motivoAsientosInvalidos(-1, 4)).not.toBeNull();
    expect(motivoAsientosInvalidos(1.5, 4)).not.toBeNull();
  });
});

describe('velocidadEntre', () => {
  const a = { latitud: -33.6105, longitud: -70.5757 };
  const b = { latitud: -33.6062, longitud: -70.5764 }; // 483 m mas alla

  it('483 m en 60 s son unos 29 km/h', () => {
    const v = velocidadEntre(
      { coordenada: a, en: new Date(0) },
      { coordenada: b, en: new Date(60_000) },
    );
    expect(Math.round(v ?? 0)).toBe(29);
  });

  it('483 m en 5 s (348 km/h) es un salto imposible', () => {
    const v = velocidadEntre(
      { coordenada: a, en: new Date(0) },
      { coordenada: b, en: new Date(5_000) },
    );
    expect(v ?? 0).toBeGreaterThan(150);
  });

  it('con menos de 1 s entre muestras no calcula', () => {
    expect(
      velocidadEntre(
        { coordenada: a, en: new Date(0) },
        { coordenada: b, en: new Date(500) },
      ),
    ).toBeNull();
  });
});
