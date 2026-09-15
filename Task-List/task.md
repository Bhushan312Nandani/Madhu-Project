# Task List — MadhuShud AWS + WhatsApp Deploy

## Phase 1: Prisma + PostgreSQL Migration
- [/] Create `backend/prisma/schema.prisma` (all models)
- [ ] Create `backend/lib/prisma.js` (singleton client)
- [ ] Update `backend/config/db.js` (Prisma connection)
- [ ] Migrate routes: products, users, orders, cart, wishlist, reviews, coupons, contact
- [ ] Remove old Mongoose models

## Phase 2: WhatsApp Admin Bot
- [ ] `backend/services/geminiVision.js` (Gemini API for image descriptions)
- [ ] `backend/services/s3Upload.js` (AWS S3 image upload)
- [ ] `backend/services/whatsappBot.js` (command parser + CRUD)
- [ ] `backend/routes/whatsapp.js` (Meta webhook endpoint)
- [ ] `backend/middleware/whatsappAuth.js` (secure, admin-only)

## Phase 3: AWS Infrastructure
- [ ] `infrastructure/ec2-setup.sh` (Node, PM2, Nginx install)
- [ ] `infrastructure/nginx.conf` (reverse proxy + SSL)
- [ ] `infrastructure/pm2.ecosystem.config.js` (process manager)
- [ ] `infrastructure/deploy.sh` (one-click deploy)
- [ ] Update `backend/.env.example` (all required vars)

## Phase 4: Security + Secrets
- [ ] Update `backend/server.js` (AWS Secrets Manager, CloudWatch)
- [ ] `backend/middleware/whatsappAuth.js` (HMAC signature verify)
- [ ] Update `frontend/.env.production` (CloudFront URL)

## Phase 5: Deploy
- [ ] Build frontend
- [ ] Push to GitHub
- [ ] Guide user through AWS Console setup
- [ ] EC2 deploy via SSH
- [ ] RDS setup
- [ ] WhatsApp webhook register
