#!/bin/sh
set -e

WAIT_COUNT=0
WAIT_MAX=30

echo "Waiting for database to be ready..."

while [ $WAIT_COUNT -lt $WAIT_MAX ]; do
    if pg_isready -U "${POSTGRES_USER:-postgres}" > /dev/null 2>&1; then
        echo "Database is ready!"
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    echo "Waiting for database... ($WAIT_COUNT/$WAIT_MAX)"
    sleep 1
done

if [ $WAIT_COUNT -eq $WAIT_MAX ]; then
    echo "ERROR: Database did not become ready in time"
    exit 1
fi

echo "Running migrations..."
pnpm prisma migrate deploy

echo "Checking install status..."
if [ ! -f /app/install.lock ]; then
    echo "First run — install wizard will be shown"
fi

exec "$@"