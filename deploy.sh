#!/bin/bash
set -euo pipefail

cd /home/ec2-user/easy-clip-be

export NODE_ENV=production

git pull origin main

pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build

pm2 restart easy-clip-be --update-env
pm2 save
