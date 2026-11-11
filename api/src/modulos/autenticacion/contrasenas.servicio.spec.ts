import { ContrasenasServicio } from './contrasenas.servicio';

describe('ContrasenasServicio', () => {
  const contrasenas = new ContrasenasServicio();

  it('acepta una contrasena larga y poco comun', () => {
    expect(
      contrasenas.revisarPolitica('caballo-pila-grapa-azul', 'pasajero'),
    ).toBeNull();
  });

  it('exige 12 caracteres a pasajero y conductor', () => {
    expect(contrasenas.revisarPolitica('once-letras', 'pasajero')).toContain(
      '12',
    );
    expect(contrasenas.revisarPolitica('once-letras', 'conductor')).toContain(
      '12',
    );
  });

  it('exige 15 caracteres a representante y administrador', () => {
    expect(
      contrasenas.revisarPolitica('catorce-letras', 'representante'),
    ).toContain('15');
    expect(
      contrasenas.revisarPolitica('catorce-letras', 'administrador'),
    ).toContain('15');
  });

  it('rechaza contrasenas comunes aunque cumplan el largo', () => {
    expect(contrasenas.revisarPolitica('Password1234', 'pasajero')).toContain(
      'comun',
    );
  });

  it('rechaza mas de 64 caracteres', () => {
    expect(contrasenas.revisarPolitica('a'.repeat(65), 'pasajero')).toContain(
      '64',
    );
  });

  it('el hash no contiene la contrasena y permite compararla', async () => {
    const hash = await contrasenas.generarHash('caballo-pila-grapa-azul');
    expect(hash).not.toContain('caballo');
    expect(await contrasenas.coincide('caballo-pila-grapa-azul', hash)).toBe(
      true,
    );
    expect(await contrasenas.coincide('otra-contrasena-larga', hash)).toBe(
      false,
    );
  });

  it('sin hash guardado nunca coincide', async () => {
    expect(await contrasenas.coincide('cualquier-contrasena', null)).toBe(
      false,
    );
  });
});
