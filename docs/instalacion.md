# Guía de instalación del entorno de desarrollo

Esta guía deja funcionando las dos bases de datos y la API en un computador con Windows 10 u 11. En macOS o Linux los pasos son los mismos, salvo la instalación de Docker.

Tiempo estimado: 30 a 45 minutos la primera vez.

## 1. Requisitos

| Programa | Versión | Para qué |
|---|---|---|
| Git para Windows | La más reciente | Clonar el repositorio. Incluye **Git Bash**, la terminal que usamos en esta guía |
| Node.js | **24 LTS** | Ejecutar la API y sus pruebas |
| Docker Desktop | La más reciente | Levantar PostgreSQL 16 y MongoDB 7 sin instalarlos |

Para comprobar las versiones, abrir Git Bash y ejecutar:

```bash
git --version
node --version     # debe decir v24.x.x
npm --version
docker --version
```

## 2. Instalar y activar Docker Desktop

1. Abrir **PowerShell como administrador** y ejecutar `wsl --install`. Reiniciar el computador cuando lo pida. Docker Desktop usa WSL 2 para correr los contenedores.
2. Descargar e instalar Docker Desktop desde docker.com. En el instalador, dejar marcada la opción **Use WSL 2 instead of Hyper-V**.
3. Abrir Docker Desktop y esperar a que abajo a la izquierda diga **Engine running**.
4. En Git Bash, comprobar que funciona:
   ```bash
   docker run --rm hello-world
   ```
   Debe mostrar «Hello from Docker!».

## 3. Clonar el repositorio

```bash
cd ~/Documents
git clone https://github.com/bejota64/colectivos-proyecto-integrado.git
cd colectivos-proyecto-integrado
```

## 4. Levantar las bases de datos

1. Crear el archivo de configuración de Docker a partir del ejemplo y cambiar las dos contraseñas por unas propias:
   ```bash
   cp .env.ejemplo .env
   notepad .env
   ```
2. Levantar PostgreSQL y MongoDB:
   ```bash
   docker compose up -d
   ```
   La primera vez descarga las imágenes (unos 700 MB) y ejecuta los scripts de `bd/*/inicio`, que crean las tablas, las colecciones y los datos de prueba.
3. Esperar a que las dos digan `healthy`:
   ```bash
   docker compose ps
   ```

Las bases solo escuchan en `127.0.0.1`: no quedan accesibles desde la red.

## 5. Configurar y ejecutar la API

1. Crear el archivo de configuración de la API:
   ```bash
   cd api
   cp .env.ejemplo .env
   notepad .env
   ```
2. En ese archivo:
   - En `URL_POSTGRES` y `URL_MONGO`, poner las **mismas contraseñas** del `.env` del paso 4.
   - En `SECRETO_JWT`, poner un valor aleatorio. Para generarlo:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
     ```
3. Instalar las dependencias exactas del proyecto y arrancar la API:
   ```bash
   npm ci
   npm run start:dev
   ```
4. En otra ventana de Git Bash, comprobar que responde:
   ```bash
   curl -i http://localhost:3000/api/usuarios/yo
   ```
   Debe responder **401**: la API está arriba y exige iniciar sesión.

## 6. Ejecutar las pruebas

Desde la carpeta `api/`, con las bases arriba:

```bash
npm run lint         # análisis estático
npm test             # pruebas unitarias
npm run test:cov     # unitarias con cobertura (informe en coverage/)
npm run test:e2e     # pruebas de integración contra las bases reales
```

Pruebas de integridad de las bases, desde la carpeta raíz del repositorio:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d colectivos -f /scripts/pruebas_integridad.sql'
docker compose exec mongo sh -c 'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --file /scripts/pruebas_validador.js'
```

Cada comprobación imprime `OK` o `FALLA`.

## 7. Recorrido de demostración

Con la API corriendo, desde `api/`:

```bash
bash demo/flujo-completo.sh            # flujo normal y ataques bloqueados
bash demo/flujo-completo.sh flujo      # solo el flujo normal
bash demo/flujo-completo.sh ataques    # solo los ataques
```

Todas las cuentas de prueba usan la contraseña `Clave.Prueba.2026`. Las personas, patentes y el trazado 9001 son ficticios.

## 8. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `docker compose up` dice que el puerto 5432 está en uso | Hay un PostgreSQL instalado en Windows | Detener el servicio «postgresql» en Servicios de Windows, o cambiar el puerto en `docker-compose.yml` |
| Docker Desktop no arranca o dice que falta WSL | WSL 2 no está instalado | Repetir `wsl --install` como administrador y reiniciar |
| `npm ci` falla diciendo que el archivo de dependencias no coincide | Versión de Node distinta de la 24 | Instalar Node.js 24 LTS y volver a ejecutar `npm ci` |
| La API no arranca: «Configuracion invalida» | Falta una variable o el secreto es corto | Revisar `api/.env` según el mensaje |
| La API no se conecta a las bases | Contraseñas distintas entre los dos `.env` | Igualarlas. Si se cambió la contraseña después del primer `up`, reiniciar las bases desde cero (fila siguiente) |
| Las tablas o los datos de prueba no aparecen | Los scripts de inicio solo corren la primera vez | `docker compose down -v` y `docker compose up -d` (borra los datos y los vuelve a crear) |
| `bash demo/flujo-completo.sh` no funciona en PowerShell | El script es de bash | Ejecutarlo en Git Bash |

## 9. Apagar el entorno

```bash
docker compose stop        # detiene las bases y conserva los datos
docker compose down -v     # las elimina junto con sus datos
```
