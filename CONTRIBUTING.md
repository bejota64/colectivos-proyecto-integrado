# Cómo trabajamos en este repositorio

## Ramas

| Rama | Para qué | Quién sube |
|---|---|---|
| `main` | Versión estable: lo que está aquí funciona y pasó las pruebas | Nadie directo. Solo entra por pull request aprobado |
| `benjamin-munoz` | Trabajo de Benjamín Muñoz | Benjamín Muñoz |
| `martin-garcia` | Trabajo de Martín García | Martín García |
| `benjamin-cuevas` | Trabajo de Benjamín Cuevas | Benjamín Cuevas |

`main` está protegida: no acepta cambios directos y exige que las pruebas automáticas estén en verde antes de unir.

## Flujo de una tarea

1. **Traer lo último de `main` a tu rama** antes de empezar:
   ```bash
   git checkout benjamin-munoz
   git pull origin main
   ```
2. **Trabajar y hacer commits chicos**, uno por cambio que se pueda explicar en una línea.
3. **Subir la rama**: `git push origin benjamin-munoz`.
4. **Abrir un pull request** de tu rama hacia `main` y completar la plantilla: qué cambia, por qué y cómo se probó.
5. **Esperar las pruebas automáticas** (GitHub Actions). Si alguna falla, se corrige en la misma rama y se vuelve a subir.
6. **Revisión**: otro integrante lee el cambio y lo aprueba o deja comentarios.
7. **Unir** con «Squash and merge» o «Merge pull request». Después, cada uno trae `main` a su rama (paso 1).

Un pull request debe ser chico: idealmente una funcionalidad o una corrección. Uno gigante al final es difícil de revisar y suele traer conflictos.

## Mensajes de commit

Formato: `Área: qué cambia`, en presente y en español.

```
API: agrega reportes de queja o felicitación
Web: pantalla de calificación del pasajero
BD: índice para la consulta de demanda por hora
Pruebas: casos de borde del "me subí" (200 y 201 m)
Docs: paso de instalación de Docker Desktop
Corrige: asientos negativos al cerrar la jornada
```

## Antes de abrir un pull request

- [ ] `npm run lint` sin errores.
- [ ] `npm test` y `npm run test:e2e` aprobados en tu computador.
- [ ] Ninguna contraseña, token ni archivo `.env` en el cambio (las pruebas automáticas lo revisan con gitleaks).
- [ ] Si cambia la forma de instalar o ejecutar, actualizar `docs/instalacion.md`.

## Reglas del código

- Nombres en español y con el vocabulario del negocio: jornada, abordaje, aviso de espera, tramo.
- Cada módulo separa controlador (HTTP), servicio (reglas) y repositorio (consultas). Las reglas críticas van en funciones puras (`reglas-*.ts`) con sus propias pruebas.
- Toda regla de negocio se valida en la API, aunque la interfaz también la controle.
- Las consultas a la base siempre van parametrizadas; nunca se arma SQL concatenando texto.
- Los límites tienen nombre (por ejemplo `DISTANCIA_MAXIMA_ABORDAJE_M`) y se definen en un solo lugar.
- Los comentarios explican el porqué de una decisión, no repiten lo que hace el código.
