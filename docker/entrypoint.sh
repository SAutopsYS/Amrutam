#!/bin/sh
set -e

# Production entrypoint: run migrations then start the application.
# SIGTERM is handled by Node/Nest graceful shutdown hooks in main.ts.

echo "{\"level\":\"info\",\"message\":\"Running database migrations\",\"timestamp\":\"$(date -Iseconds)\"}"

npx prisma migrate deploy

echo "{\"level\":\"info\",\"message\":\"Starting application\",\"timestamp\":\"$(date -Iseconds)\"}"

exec node dist/main.js
