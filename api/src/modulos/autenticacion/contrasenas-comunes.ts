/**
 * Contrasenas que se rechazan aunque cumplan el largo. Es una lista minima
 * de partida: antes de produccion se reemplaza por una lista publica de
 * contrasenas filtradas (por ejemplo, las 10.000 mas usadas).
 * Solo importan las de 12 caracteres o mas: las cortas ya las frena el largo.
 */
export const CONTRASENAS_COMUNES: ReadonlySet<string> = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  '000000000000',
  '111111111111',
  '123123123123',
  'abc123abc123',
  'abcdefghijkl',
  'qwertyuiop12',
  'qwerty123456',
  'qwertyuiopas',
  'password1234',
  'password12345',
  'passwordpassword',
  'contrasena1234',
  'contrasena12345',
  'contraseña1234',
  'iloveyou1234',
  'administrador',
  'administrador1',
  'colectivos123',
  'colectivos1234',
  'santiago12345',
  'chile1234567',
]);
