#!/bin/bash
cd "$(dirname "$0")" # Asegura que estés en el directorio correcto

git add .

if ! git diff --cached --quiet; then
  git commit -m "Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')"
  git push
else
  echo "No hay cambios para commitear."
fi
