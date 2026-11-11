# Sistema Integral para Colectivos

Aplicación web para una asociación de taxis colectivos de ruta fija de Santiago. El conductor comparte su posición y sus asientos libres; el pasajero ve en el mapa cuándo llega el próximo colectivo y avisa que está esperando; el representante del trazado ve la demanda por hora y por tramo para decidir cuántos autos sacar.

Proyecto Integrado · Ingeniería en Informática · INACAP.

## Equipo

| Integrante | Rol |
|---|---|
| Benjamín Muñoz | Desarrollo de la API, bases de datos y seguridad |
| Martín García | Interfaz web y pruebas de usabilidad |
| Benjamín Cuevas | Scrum Master, entorno en la nube y documentación |

## Qué hace

| Perfil | Funciones |
|---|---|
| Pasajero | Ver los colectivos en servicio con sus asientos libres y minutos estimados; avisar «estoy esperando» (1 a 4 personas); marcar «me subí»; calificar el viaje |
| Conductor | Abrir y cerrar su jornada; enviar su posición GPS; ajustar los asientos libres solo con el auto detenido; ver cuánta gente espera más adelante |
| Representante | Ver la demanda por tramo de 500 m y por hora, y el resumen por conductor, solo de su trazado y sin datos de pasajeros |
| Administrador | Crea trazados y representantes (por script en esta versión) |

Los datos incluidos son ficticios (trazado de prueba 9001).

## Tecnologías

| Parte | Tecnología |
|---|---|
| API | NestJS con TypeScript en modo estricto |
| Datos con integridad referencial | PostgreSQL 16 (15 tablas, 21 claves foráneas), con el driver `pg` y consultas parametrizadas |
| Datos de alto volumen y vida corta | MongoDB 7: posiciones GPS, avisos de espera y auditoría, con caducidad automática |
| Seguridad | bcrypt, JWT de 15 minutos, token de refresco rotativo en cookie HttpOnly, helmet y límite de peticiones |
| Pruebas | Jest y Supertest; scripts de integridad para ambas bases |
| Entorno | Docker Compose |

## Estructura

```
api/                 API en NestJS (src/, pruebas en test/ y *.spec.ts, demo/)
bd/postgres/         esquema, datos de prueba, consultas de ejemplo e integridad
bd/mongo/            colecciones, validadores e índices
docs/                guía de instalación
.github/             pruebas automáticas en cada pull request
docker-compose.yml   PostgreSQL 16 y MongoDB 7 para desarrollo
```

## Inicio rápido

Requisitos: Git, Node.js 24 y Docker Desktop. La guía completa, paso a paso y con solución de problemas, está en [`docs/instalacion.md`](docs/instalacion.md).

```bash
cp .env.ejemplo .env               # cambiar las contraseñas
docker compose up -d               # PostgreSQL y MongoDB con datos de prueba
cd api
cp .env.ejemplo .env               # mismas contraseñas y un SECRETO_JWT propio
npm ci
npm run start:dev                  # API en http://localhost:3000/api
```

Pruebas:

```bash
npm test             # unitarias
npm run test:e2e     # integración contra las bases reales
npm run lint         # análisis estático
```

## Cómo trabajamos

Nadie sube cambios directo a `main`: cada integrante trabaja en su rama y abre un pull request, que otro integrante revisa y que las pruebas automáticas deben aprobar. Las reglas están en [`CONTRIBUTING.md`](CONTRIBUTING.md).
