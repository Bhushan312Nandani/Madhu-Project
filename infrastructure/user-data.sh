#!/bin/bash
set -e

# Log everything to user-data.log
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "========================================="
echo "🚀 MadhuShud Production EC2 Provisioning"
echo "========================================="

export DEBIAN_FRONTEND=noninteractive

# Update system
apt-get update -y
apt-get upgrade -y

# Install prerequisites
apt-get install -y curl wget git build-essential nginx certbot python3-certbot-nginx postgresql postgresql-contrib ufw

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# Configure PostgreSQL locally (100% Free, zero RDS billing)
systemctl start postgresql
systemctl enable postgresql

sudo -u postgres psql -c "CREATE USER madhuadmin WITH PASSWORD 'YourSecurePasswordHere!';" || true
sudo -u postgres psql -c "ALTER USER madhuadmin WITH SUPERUSER;" || true
sudo -u postgres psql -c "CREATE DATABASE madhushud OWNER madhuadmin;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE madhushud TO madhuadmin;" || true

# Prepare application directory
mkdir -p /var/www/madhushud
cd /var/www/madhushud

# Clone project repository
git clone https://github.com/Bhushan312Nandani/Madhu-Project.git .

# Create backend .env file template
cat << 'EOF' > /var/www/madhushud/backend/.env
# ============================================================
# MadhuShud Backend — Production Environment
# ============================================================
DATABASE_URL="postgresql://madhuadmin:YourSecurePasswordHere!@localhost:5432/madhushud?schema=public"
PORT=5000
NODE_ENV=production

JWT_ACCESS_SECRET="generate_secure_random_string_here"
JWT_REFRESH_SECRET="generate_secure_random_string_here"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="7d"

ADMIN_EMAIL="admin@madhushud.com"
ADMIN_PASSWORD="YourSecurePasswordHere!"
ADMIN_JWT_SECRET="generate_secure_random_string_here"

ALLOWED_ORIGINS="*"

AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY_ID"
AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_ACCESS_KEY"
S3_BUCKET_NAME="madhushud-images"
CLOUDFRONT_URL="https://your-bucket.s3.ap-south-1.amazonaws.com"

GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

META_APP_SECRET="YOUR_META_APP_SECRET"
META_APP_ID="YOUR_META_APP_ID"
WHATSAPP_ADMIN_NUMBERS="YOUR_PHONE_NUMBER"
WHATSAPP_VERIFY_TOKEN="madhushud_webhook_secret_2024"

BCRYPT_ROUNDS=12
CACHE_TTL=300
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
EOF

# Setup backend dependencies & Prisma
cd /var/www/madhushud/backend
npm install
npx prisma generate
npx prisma db push --accept-data-loss

# Configure Nginx reverse proxy
cp /var/www/madhushud/infrastructure/nginx.conf /etc/nginx/sites-available/madhushud
ln -sf /etc/nginx/sites-available/madhushud /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

# Start PM2
cd /var/www/madhushud/backend
pm2 start server.js --name "madhushud-backend"
pm2 save
pm2 startup systemd -u root --hp /root

echo "🎉 MadhuShud Setup Complete!"
