#!/usr/bin/env bash
# Instala Docker Engine y el plugin Compose en el servidor Ubuntu, desde el
# repositorio oficial de Docker (docs.docker.com/engine/install/ubuntu).
# Uso:  bash instalar-docker.sh
set -euo pipefail

if command -v docker > /dev/null; then
  echo "Docker ya esta instalado: $(docker --version)"
  exit 0
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# shellcheck disable=SC1091
VERSION_UBUNTU=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<FIN
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $VERSION_UBUNTU
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
FIN

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Permite usar docker sin sudo. Hace efecto al volver a iniciar sesion.
sudo usermod -aG docker "$USER"

echo "Docker instalado. Escribe exit y vuelve a conectarte para usarlo sin sudo."
