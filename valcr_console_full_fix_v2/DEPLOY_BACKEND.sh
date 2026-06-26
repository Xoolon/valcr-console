#!/usr/bin/env bash
set -euo pipefail

# Run from the extracted package directory on the backend server.
PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$HOME/valcr-backend}"

cd "$BACKEND_DIR"
source .venv/bin/activate

STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "backups/console_auth_billing_$STAMP"

for file in \
  app/main.py \
  app/models/user.py \
  app/services/turnstile.py \
  app/api/v1/auth.py \
  app/api/v1/payments.py \
  app/api/v1/console/billing.py; do
  if [[ -f "$file" ]]; then
    mkdir -p "backups/console_auth_billing_$STAMP/$(dirname "$file")"
    cp "$file" "backups/console_auth_billing_$STAMP/$file"
  fi
done

cp -f "$PACKAGE_DIR/backend/app/main.py" app/main.py
cp -f "$PACKAGE_DIR/backend/app/models/user.py" app/models/user.py
cp -f "$PACKAGE_DIR/backend/app/services/turnstile.py" app/services/turnstile.py
cp -f "$PACKAGE_DIR/backend/app/api/v1/auth.py" app/api/v1/auth.py
cp -f "$PACKAGE_DIR/backend/app/api/v1/payments.py" app/api/v1/payments.py
mkdir -p app/api/v1/console
cp -f "$PACKAGE_DIR/backend/app/api/v1/console/billing.py" app/api/v1/console/billing.py

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$PACKAGE_DIR/backend/sql/001_separate_data_api_billing.sql"
python -m compileall -q app
sudo systemctl restart valcr
sudo systemctl status valcr --no-pager -l

echo "Backend deployed. Add CONSOLE_FRONTEND_URL and TURNSTILE_SECRET_KEY to the service environment if not already present."
