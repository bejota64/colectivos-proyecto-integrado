# Despliegue en Azure

Esta guía deja el sistema publicado en internet con HTTPS, en una máquina virtual de Azure for Students. El servidor corre los mismos contenedores que el entorno de desarrollo y que las pruebas automáticas, más Caddy como puerta de entrada.

Tiempo estimado: 60 a 90 minutos la primera vez.

## Arquitectura

```
                 Internet
                    │  solo 80 y 443 (y 22 desde la IP del equipo)
┌───────────────────▼──────────── máquina virtual Ubuntu 24.04 ─┐
│  Caddy ── certificado HTTPS automático, redirige HTTP a HTTPS │
│   ├── /api/*  ──▶  API NestJS (usuario sin privilegios)       │
│   │                 ├──▶ PostgreSQL 16  (sin puertos abiertos)│
│   │                 └──▶ MongoDB 7      (sin puertos abiertos)│
│   └── /       ──▶  archivos de la web                         │
└───────────────────────────────────────────────────────────────┘
```

Todo vive en `despliegue/`:

| Archivo | Para qué |
|---|---|
| `docker-compose.yml` | Los cuatro servicios, sus volúmenes de datos y sus controles de salud |
| `Caddyfile` | HTTPS, encabezados de seguridad y qué ruta va a la API y cuál a la web |
| `generar-env.sh` | Crea `despliegue/.env` con contraseñas y secreto aleatorios |
| `instalar-docker.sh` | Instala Docker desde el repositorio oficial en el servidor |
| `cambiar-clave-demo.sh` | Cambia la contraseña publicada de las cuentas de demostración |
| `respaldar.sh` | Respalda PostgreSQL y MongoDB con la fecha en el nombre |
| `web-provisional/` | Página de inicio hasta que se publique la aplicación web |

Las pruebas automáticas levantan este mismo despliegue en cada pull request y lo prueban desde afuera por HTTPS (job «Despliegue de produccion»).

## 1. Crear la clave SSH (en tu computador)

La clave reemplaza a la contraseña para entrar al servidor. En Git Bash:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/colectivos_azure -C "colectivos-azure"
```

Te pide una frase de paso: escribe una y recuérdala, porque protege la clave si alguien copia tu computador. Después muestra la parte pública, que es la que se entrega a Azure:

```bash
cat ~/.ssh/colectivos_azure.pub
```

Copia la línea completa, que empieza con `ssh-ed25519`. El archivo sin `.pub` es privado: nunca se comparte ni se sube a GitHub.

## 2. Elegir la región

Azure for Students solo permite crear recursos en unas cinco regiones, distintas para cada cuenta. Para ver las tuyas:

1. En el buscador del portal escribe **Directiva** (Azure Policy) y entra.
2. Menú **Asignaciones** → **Allowed resource deployment regions**.
3. En **Parámetros**, el valor de *Allowed locations* es la lista permitida.

Entre las permitidas, elige la más barata. Precio de referencia de la máquina recomendada (Standard_B2als_v2, Linux, pago por uso, noviembre de 2026):

| Región | US$ por hora | US$ por mes (730 h) |
|---|---|---|
| East US | 0,0376 | 27,45 |
| Chile Central | 0,0526 | 38,40 |
| Brazil South | 0,0605 | 44,17 |

La distancia no afecta a la aplicación, porque la web consulta las posiciones cada 5 segundos y unos 130 ms más no se notan. Los datos actuales son ficticios. Con datos reales de pasajeros, conviene evaluar Chile Central por las reglas de transferencia internacional de datos personales de la Ley 21.719.

## 3. Crear la máquina virtual

En el portal: **Máquinas virtuales** → **Crear** → **Máquina virtual de Azure**.

**Pestaña Aspectos básicos**

| Campo | Valor |
|---|---|
| Suscripción | Azure for Students |
| Grupo de recursos | Crear nuevo: `rg-colectivos` |
| Nombre de la máquina virtual | `vm-colectivos` |
| Región | La elegida en el paso 2 |
| Opciones de disponibilidad | No se requiere redundancia de infraestructura |
| Tipo de seguridad | El que viene por defecto (Inicio seguro) |
| Imagen | Ubuntu Server 24.04 LTS - x64 Gen2 |
| Tamaño | **Standard_B2als_v2** (2 vCPU, 4 GiB). Si no aparece, **Standard_B2s** (2 vCPU, 4 GiB) |
| Tipo de autenticación | Clave pública SSH |
| Nombre de usuario | `colectivos` |
| Origen de clave pública SSH | Usar clave pública existente: pega la línea del paso 1 |
| Puertos de entrada públicos | Permitir los puertos seleccionados: **HTTP (80), HTTPS (443) y SSH (22)** |

Con 1 GiB de memoria, como en las máquinas gratuitas B1s, no alcanza para las dos bases más la API.

**Pestaña Discos**: tipo de disco del sistema operativo **SSD estándar**, con el tamaño que viene. Deja marcado «Eliminar con la máquina virtual».

**Pestaña Redes**: deja la IP pública nueva que propone y marca «Eliminar la IP pública y la NIC cuando se elimine la máquina virtual».

**Revisar y crear** → **Crear**. Demora unos 2 minutos.

Si aparece el error `RequestDisallowedByAzure`, la región no está en tu lista: vuelve al paso 2. Si dice que el tamaño no está disponible, prueba el otro tamaño u otra región permitida.

## 4. Ponerle nombre a la dirección

1. En la máquina virtual, **Información general** → junto a **Nombre DNS** haz clic en «No configurado».
2. En **Etiqueta de nombre DNS** escribe `colectivos-inacap`. Si está ocupado, agrega un número.
3. **Guardar**.

La dirección queda como `colectivos-inacap.<región>.cloudapp.azure.com`, por ejemplo `colectivos-inacap.eastus.cloudapp.azure.com`. Anótala: es el dominio de los pasos siguientes.

## 5. Limitar SSH a la IP del equipo

1. Máquina virtual → **Redes** → **Configuración de red**.
2. Abre la regla de entrada **SSH** (puerto 22).
3. En **Origen** elige **Mi dirección IP** → **Guardar**.

Así nadie más en internet puede intentar entrar. Si te conectas desde otra red (otra casa, INACAP), repite este paso con la IP nueva.

## 6. Entrar al servidor

En Git Bash, con tu dominio:

```bash
ssh -i ~/.ssh/colectivos_azure colectivos@colectivos-inacap.eastus.cloudapp.azure.com
```

La primera vez pregunta si confías en el servidor: escribe `yes`. Cuando el inicio de la línea cambie a `colectivos@vm-colectivos:~$`, los comandos se ejecutan **en el servidor**, no en tu computador.

## 7. Descargar el proyecto e instalar Docker

```bash
git clone https://github.com/bejota64/colectivos-proyecto-integrado.git
```
```bash
cd colectivos-proyecto-integrado/despliegue
```
```bash
bash instalar-docker.sh
```

Si `git` no existe, instálalo primero con `sudo apt-get install -y git`. Al terminar la instalación de Docker, sal y vuelve a entrar para usarlo sin `sudo`:

```bash
exit
```

Repite el comando `ssh` del paso 6 y comprueba:

```bash
docker run --rm hello-world
```

Ubuntu instala solo las actualizaciones de seguridad (paquete `unattended-upgrades`, activo por defecto).

## 8. Configurar y levantar

```bash
cd ~/colectivos-proyecto-integrado/despliegue
```
```bash
bash generar-env.sh
```

Te pide el dominio del paso 4. El script crea `despliegue/.env` con contraseñas aleatorias, legible solo por tu usuario. No lo edites ni lo copies a otro lado: las bases guardan esas contraseñas al crearse.

```bash
docker compose up -d --build
```

La primera vez demora de 3 a 6 minutos: construye la imagen de la API, descarga las demás y carga los datos de prueba. Después:

```bash
docker compose ps
```

Deben aparecer los cuatro servicios en `Up`, y `api`, `postgres` y `mongo` con `(healthy)`.

**Comprobar desde tu computador**, en el navegador:

| Dirección | Debe mostrar |
|---|---|
| `https://<tu-dominio>/` | La página «El servidor está en línea», con el candado de conexión segura |
| `https://<tu-dominio>/api/salud` | `{"estado":"ok"}` |
| `http://<tu-dominio>/` | Redirige sola a `https://` |

## 9. Cambiar la contraseña de las cuentas de demostración

Los datos de prueba usan una contraseña publicada en el repositorio. En un servidor público hay que cambiarla apenas se levanta:

```bash
bash cambiar-clave-demo.sh
```

Pide la contraseña nueva sin mostrarla en pantalla. Debe tener al menos 15 caracteres. Compártela con el equipo solo por un canal privado, nunca en el repositorio.

## Operación diaria

Todo se ejecuta en el servidor, desde `~/colectivos-proyecto-integrado/despliegue`.

| Tarea | Comando |
|---|---|
| Ver el estado | `docker compose ps` |
| Ver los registros de la API | `docker compose logs --tail=100 api` |
| Publicar lo último de `main` | `bash respaldar.sh && git pull && docker compose up -d --build` |
| Reiniciar la API | `docker compose restart api` |
| Detener todo sin perder datos | `docker compose stop` |

Publicar cambios no borra datos: viven en volúmenes de Docker. **`docker compose down -v` borra las bases completas**: no se usa en el servidor salvo que se quiera empezar de cero.

## Respaldos

```bash
bash respaldar.sh
```

Crea `respaldos/postgres_<fecha>.dump` y `respaldos/mongo_<fecha>.archive.gz`. Conviene respaldar antes de cada publicación y antes de la presentación, y bajar una copia a tu computador. En Git Bash, en tu computador:

```bash
scp -i ~/.ssh/colectivos_azure "colectivos@<tu-dominio>:colectivos-proyecto-integrado/despliegue/respaldos/*" .
```

Para restaurar, en el servidor, cambiando `<fecha>` por la del respaldo:

```bash
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d colectivos --clean --if-exists' < respaldos/postgres_<fecha>.dump
```
```bash
docker compose exec -T mongo sh -c 'mongorestore --archive --gzip --drop -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' < respaldos/mongo_<fecha>.archive.gz
```

## Costos y cuidado del crédito

La máquina recomendada cuesta unos US$27 al mes en East US, más unos pocos dólares por el disco y la IP pública. Con los US$100 de Azure for Students alcanza para unos tres meses encendida todo el día.

- Revisa el crédito restante una vez por semana en **Education → Información general**.
- Si no se va a usar por varios días: máquina virtual → **Detener**. Queda desasignada y deja de cobrar el cómputo; el disco y la IP siguen cobrando poco. Al volver a iniciarla conserva la dirección y los contenedores arrancan solos.

## Seguridad aplicada

- Desde internet solo se llega a Caddy (80 y 443). SSH acepta solo la IP del equipo y solo con clave, sin contraseña.
- PostgreSQL y MongoDB no publican puertos: solo la API las alcanza, por la red interna de Docker.
- Contraseñas y secreto aleatorios de 48 a 96 caracteres, generados en el servidor, en un `.env` con permisos 600 que nunca entra a Git.
- HTTPS con certificado de Let's Encrypt renovado automáticamente, HSTS y redirección de HTTP a HTTPS.
- La API corre con un usuario sin privilegios, en una imagen sin compilador ni dependencias de desarrollo.
- La contraseña pública de las cuentas de demostración se reemplaza al desplegar.
- Los registros de cada contenedor rotan (3 archivos de 10 MB) para no llenar el disco.

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `RequestDisallowedByAzure` al crear la máquina | La región no está permitida para tu suscripción | Elegir una región de la lista del paso 2 |
| El tamaño no está disponible | Sin capacidad en esa región | Usar el otro tamaño recomendado u otra región permitida |
| `ssh: connect to host … Connection timed out` | Tu IP cambió y la regla SSH la bloquea | Repetir el paso 5 |
| `Permission denied (publickey)` | Clave o usuario equivocados | Usar `-i ~/.ssh/colectivos_azure` y el usuario `colectivos` |
| `permission denied … docker.sock` | No volviste a entrar después de instalar Docker | `exit` y repetir el `ssh` |
| El navegador muestra un error de certificado | `DOMINIO` mal escrito en `despliegue/.env` o puertos 80/443 cerrados | Revisar el dominio y las reglas de red; ver `docker compose logs caddy` |
| `api` queda `unhealthy` | Alguna base no responde | `docker compose logs api postgres mongo` |
| La API no conecta después de editar `despliegue/.env` | Las bases conservan las contraseñas con que se crearon | Volver a las contraseñas originales, o respaldar y empezar de cero con `docker compose down -v` |

## Fuentes

- [Install Docker Engine on Ubuntu – Docker Docs](https://docs.docker.com/engine/install/ubuntu/)
- [Precio de Standard_B2als_v2 por región – AzureSpeed](https://www.azurespeed.com/AzureVmPricing/Standard_B2als_v2)
- [Regiones permitidas en Azure for Students – Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5826596/my-subscription-is-restricted-to-certain-regions-i)
