#!/bin/bash
# ============================================================
# MadhuShud — One-Click Deploy Script
# Run from your LOCAL machine (Windows Git Bash / WSL)
# Usage: bash infrastructure/deploy.sh
# ============================================================

EC2_HOST="your-ec2-public-ip"          # ← Replace with your EC2 IP
EC2_USER="ubuntu"
KEY_FILE="~/.ssh/madhushud-key.pem"    # ← Path to your .pem key
APP_DIR="/var/www/madhushud"

echo "🚀 Deploying MadhuShud to EC2..."
echo "Host: $EC2_HOST"
echo ""

# ─── Push latest code to GitHub first ────────────────────
echo "📤 Pushing to GitHub..."
git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || echo "Nothing to commit"
git push origin main
echo "✅ GitHub updated"
echo ""

# ─── SSH into EC2 and deploy ──────────────────────────────
echo "🔗 Connecting to EC2..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" << 'ENDSSH'

  echo "📥 Pulling latest code..."
  cd /var/www/madhushud
  git pull origin main

  echo "📦 Installing backend dependencies..."
  cd /var/www/madhushud/backend
  npm install --production

  echo "🗃️  Generating Prisma client..."
  npx prisma generate

  echo "🗃️  Applying DB migrations..."
  npx prisma db push --accept-data-loss

  echo "♻️  Restarting app with PM2..."
  cd /var/www/madhushud
  pm2 reload madhushud-backend --update-env

  echo "✅ Deploy complete!"
  pm2 status

ENDSSH

echo ""
echo "🎉 Deployment finished!"
echo "🌐 Check: http://$EC2_HOST/api/health"
