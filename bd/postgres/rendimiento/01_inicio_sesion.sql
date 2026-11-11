-- Consulta que hace la API en cada inicio de sesion y en cada peticion autenticada.
\set n random(1, 3)
SELECT id, nombre_completo, correo_electronico, contrasena_hash, rol, activo
FROM usuarios
WHERE correo_electronico = 'pasajero' || :n || '@colectivos.ejemplo.cl' AND eliminado_en IS NULL;
