import {
  distanciaMetros,
  minutosEstimados,
  numeroTramo,
  proyectarEnRuta,
  type PuntoRuta,
} from './geo';

/**
 * Recorrido de ida del trazado ficticio 9001 (02_datos_prueba.sql), con la
 * distancia acumulada que calculo PostgreSQL al cargar los datos.
 */
const IDA: PuntoRuta[] = [
  { orden: 1, latitud: -33.6105, longitud: -70.5757, distancia_acumulada_m: 0 },
  { orden: 2, latitud: -33.6062, longitud: -70.5764, distancia_acumulada_m: 483 },
  { orden: 3, latitud: -33.6018, longitud: -70.5772, distancia_acumulada_m: 977 },
  { orden: 4, latitud: -33.5975, longitud: -70.5781, distancia_acumulada_m: 1463 },
  { orden: 5, latitud: -33.5931, longitud: -70.579, distancia_acumulada_m: 1959 },
];

describe('distanciaMetros', () => {
  it('da lo mismo que distancia_metros() de PostgreSQL entre los puntos 1 y 2 (483 m)', () => {
    expect(Math.round(distanciaMetros(IDA[0], IDA[1]))).toBe(483);
  });

  it('es cero para el mismo punto', () => {
    expect(distanciaMetros(IDA[2], IDA[2])).toBe(0);
  });
});

describe('numeroTramo y minutosEstimados', () => {
  it('agrupa en tramos de 500 m', () => {
    expect(numeroTramo(0)).toBe(0);
    expect(numeroTramo(499)).toBe(0);
    expect(numeroTramo(500)).toBe(1);
    expect(numeroTramo(1463)).toBe(2);
  });

  it('estima minutos a 25 km/h y redondea hacia arriba (consulta 4 de consultas_ejemplo.sql)', () => {
    // 1959 - 483 = 1476 m: la consulta de ejemplo da 4 minutos.
    expect(minutosEstimados(1476)).toBe(4);
    expect(minutosEstimados(0)).toBe(0);
  });
});

describe('proyectarEnRuta', () => {
  it('un punto del recorrido queda a 0 m de la linea y con su distancia acumulada', () => {
    const p = proyectarEnRuta(IDA, IDA[3]);
    expect(p?.distanciaRutaM).toBe(1463);
    expect(p?.distanciaAlRecorridoM).toBeLessThan(1);
  });

  it('a mitad de un segmento queda sobre la linea, aunque este a 240 m del punto mas cercano', () => {
    const medio = {
      latitud: (IDA[1].latitud + IDA[2].latitud) / 2,
      longitud: (IDA[1].longitud + IDA[2].longitud) / 2,
    };
    const p = proyectarEnRuta(IDA, medio);
    expect(p?.distanciaAlRecorridoM).toBeLessThan(2);
    expect(Math.abs((p?.distanciaRutaM ?? 0) - 730)).toBeLessThan(5);
    expect(distanciaMetros(medio, IDA[1])).toBeGreaterThan(240);
  });

  it('una calle paralela a ~300 m queda lejos del recorrido', () => {
    const p = proyectarEnRuta(IDA, { latitud: -33.6018, longitud: -70.5805 });
    expect(p?.distanciaAlRecorridoM).toBeGreaterThan(280);
  });

  it('sin puntos no puede proyectar', () => {
    expect(proyectarEnRuta([], IDA[0])).toBeNull();
  });
});
