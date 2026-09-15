#!/bin/bash
# ============================================================
# MadhuShud — EC2 Setup Script
# Run this as User Data when launching EC2 instance
# OR SSH into EC2 and run: bash ec2-setup.sh
# ============================================================
set -e

echo "🚀 Starting MadhuShud EC2 Setup..."

# ─── System Update ────────────────────────────────────────
sudo apt-get update -y
sudo apt-get upgrade -y

# ─── Install Node.js 20 LTS ───────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version

# ─── Install PM2 (Process Manager) ───────────────────────
sudo npm install -g pm2

# ─── Install Nginx ────────────────────────────────────────
sudo apt-get install -y nginx

# ─── Install Git ──────────────────────────────────────────
sudo apt-get install -y git

# ─── Install Certbot (Free SSL) ───────────────────────────
sudo apt-get install -y certbot python3-certbot-nginx

# ─── Create App Directory ─────────────────────────────────
sudo mkdir -p /var/www/madhushud
sudo chown -R ubuntu:ubuntu /var/www/madhushud

# ─── Clone Repository ─────────────────────────────────────
cd /var/www/madhushud
git clone https://github.com/Bhushan312Nandani/Madhu-Project.git .

# ─── Backend Setup ────────────────────────────────────────
cd /var/www/madhushud/backend
npm install --production

# Generate Prisma Client
npx prisma generate

# ─── Copy Nginx Config ────────────────────────────────────
sudo cp /var/www/madhushud/infrastructure/nginx.conf /etc/nginx/sites-available/madhushud
sudo ln -sf /etc/nginx/sites-available/madhushud /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# ─── PM2 Start ────────────────────────────────────────────
cd /var/www/madhushud
pm2 start infrastructure/pm2.ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "✅ EC2 Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next steps:"
echo "1. Create .env file: nano /var/www/madhushud/backend/.env"
echo "2. Run DB migration: cd backend && npx prisma db push"
echo "3. Setup SSL: sudo certbot --nginx -d yourdomain.com"
echo "4. Check status: pm2 status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
