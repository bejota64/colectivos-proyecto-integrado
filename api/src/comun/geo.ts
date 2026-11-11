/**
 * Calculos geograficos puros: no dependen de NestJS ni de las bases.
 * Por eso se prueban solos y en milisegundos (geo.spec.ts).
 */

export interface Coordenada {
  latitud: number;
  longitud: number;
}

/** Punto del recorrido tal como viene de la tabla puntos_ruta. */
export interface PuntoRuta extends Coordenada {
  orden: number;
  distancia_acumulada_m: number;
}

/** Punto GeoJSON. OJO: GeoJSON usa [longitud, latitud], al reves de lo usual. */
export interface PuntoGeoJson {
  type: 'Point';
  coordinates: [number, number];
}

const RADIO_TIERRA_M = 6_371_000;
/** Largo de un tramo de demanda (definido en el diseno: tramos de 500 m). */
export const LARGO_TRAMO_M = 500;
/** Velocidad promedio usada para estimar minutos (la misma de consultas_ejemplo.sql). */
export const VELOCIDAD_PROMEDIO_KMH = 25;

const aRadianes = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en metros entre dos coordenadas (Haversine, igual que distancia_metros() en SQL). */
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const dLat = aRadianes(b.latitud - a.latitud);
  const dLon = aRadianes(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.latitud)) *
      Math.cos(aRadianes(b.latitud)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

export function numeroTramo(distanciaRutaM: number): number {
  return Math.floor(distanciaRutaM / LARGO_TRAMO_M);
}

export function minutosEstimados(metrosPorRecorrer: number): number {
  const metrosPorMinuto = (VELOCIDAD_PROMEDIO_KMH * 1000) / 60;
  return Math.ceil(metrosPorRecorrer / metrosPorMinuto);
}

export function aGeoJson(c: Coordenada): PuntoGeoJson {
  return { type: 'Point', coordinates: [c.longitud, c.latitud] };
}

export function desdeGeoJson(p: PuntoGeoJson): Coordenada {
  return { longitud: p.coordinates[0], latitud: p.coordinates[1] };
}

export interface Proyeccion {
  /** Metros desde el inicio del recorrido hasta el punto proyectado. */
  distanciaRutaM: number;
  /** Metros entre la persona y la linea del recorrido. */
  distanciaAlRecorridoM: number;
}

/**
 * Proyecta una coordenada sobre la linea del recorrido.
 *
 * Por que no basta con el punto de ruta mas cercano: los puntos pueden
 * estar a 500 m entre si, y alguien parado justo entre dos quedaria a
 * 250 m del punto mas cercano aunque este SOBRE la calle. Proyectar sobre
 * cada segmento da la distancia real a la linea.
 *
 * Usa una aproximacion plana (equirrectangular), suficiente para segmentos
 * de pocos cientos de metros dentro de una ciudad.
 */
export function proyectarEnRuta(
  puntos: PuntoRuta[],
  c: Coordenada,
): Proyeccion | null {
  if (puntos.length === 0) {
    return null;
  }
  if (puntos.length === 1) {
    return {
      distanciaRutaM: puntos[0].distancia_acumulada_m,
      distanciaAlRecorridoM: distanciaMetros(puntos[0], c),
    };
  }

  // Plano local en metros, centrado en la persona.
  const metrosPorGradoLat = (Math.PI * RADIO_TIERRA_M) / 180;
  const metrosPorGradoLon = metrosPorGradoLat * Math.cos(aRadianes(c.latitud));
  const aPlano = (p: Coordenada) => ({
    x: (p.longitud - c.longitud) * metrosPorGradoLon,
    y: (p.latitud - c.latitud) * metrosPorGradoLat,
  });

  let mejor: Proyeccion | null = null;
  for (let i = 0; i < puntos.length - 1; i++) {
    const a = aPlano(puntos[i]);
    const b = aPlano(puntos[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const largo2 = dx * dx + dy * dy;
    // t: que fraccion del segmento recorrimos hasta el punto mas cercano (0 a 1).
    const t =
      largo2 === 0
        ? 0
        : Math.min(1, Math.max(0, -(a.x * dx + a.y * dy) / largo2));
    const qx = a.x + t * dx;
    const qy = a.y + t * dy;
    const distancia = Math.sqrt(qx * qx + qy * qy);

    if (mejor === null || distancia < mejor.distanciaAlRecorridoM) {
      const desde = puntos[i].distancia_acumulada_m;
      const hasta = puntos[i + 1].distancia_acumulada_m;
      mejor = {
        distanciaRutaM: Math.round(desde + t * (hasta - desde)),
        distanciaAlRecorridoM: distancia,
      };
    }
  }
  return mejor;
}
