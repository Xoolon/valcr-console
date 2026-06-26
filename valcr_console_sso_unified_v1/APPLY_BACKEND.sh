#!/usr/bin/env bash
set -euo pipefail
BACKEND_DIR="${BACKEND_DIR:-$HOME/valcr-backend}"
PKG_DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="$BACKEND_DIR/backups/console_sso_$STAMP"
mkdir -p "$BACKUP"
FILES=(
  app/api/v1/auth.py
  app/services/oauth_state.py
  app/middleware/rate_limiter.py
  app/main.py
  app/api/v1/console/keys.py
  app/api/v1/data/auth.py
)
for rel in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$rel")" "$BACKEND_DIR/$(dirname "$rel")"
  [[ -f "$BACKEND_DIR/$rel" ]] && cp "$BACKEND_DIR/$rel" "$BACKUP/$rel"
  cp "$PKG_DIR/backend/$rel" "$BACKEND_DIR/$rel"
done
cd "$BACKEND_DIR"
source .venv/bin/activate
python -m py_compile "${FILES[@]}"
python -c "import app.main; print('FULL APP IMPORT: OK')"
sudo systemctl restart valcr
sleep 4
sudo systemctl status valcr --no-pager -l
