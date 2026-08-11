#!/usr/bin/env bash
# Copia las imágenes de packages/shared/assets/images a los public/img de cada app web.
set -e
cd "$(dirname "$0")"
SRC="packages/shared/assets/images"
for app in landing admin webapp; do
  mkdir -p "apps/$app/public/img"
  cp "$SRC"/* "apps/$app/public/img/"
  echo "→ imágenes copiadas a apps/$app/public/img"
done
echo "Listo ✓"
