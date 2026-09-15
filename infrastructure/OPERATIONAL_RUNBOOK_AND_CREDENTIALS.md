# 🚀 MadhuShud Operational Runbook & Credential Reference

**Server IP:** `13.233.225.152`  
**SSH User:** `ubuntu`  
**Region:** `ap-south-1` (Mumbai)  
**Security Group:** `madhushud-sg` (`sg-00533416654290f37`)  
**S3 Bucket:** `madhushud-images-438777519471`  

---

## 🔑 1. Quick SSH Access
To access the server from PowerShell or terminal:
```powershell
ssh -i "A:\Devopps\madhushud-ec2-key.pem" ubuntu@13.233.225.152
```

---

## ⚙️ 2. Daily Operations & Cheatsheet

### Check Backend Status
```bash
pm2 status
```

### View Live Logs
```bash
# View last 50 lines of logs
pm2 logs madhushud-backend --lines 50

# Live stream logs
pm2 logs madhushud-backend
```

### Restart Backend Service
```bash
pm2 restart madhushud-backend
```

### Check Nginx Status
```bash
sudo systemctl status nginx
```

### Reload Nginx Configuration
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Check PostgreSQL Database
```bash
# Enter PostgreSQL console
sudo -u postgres psql -d madhushud

# Inside psql:
# \dt                 -- list tables
# SELECT count(*) FROM products;
# \q                  -- exit
```

---

## 📱 3. WhatsApp Admin Bot Cheat Sheet

The WhatsApp bot is configured to respond to messages from:  
**Admin Number:** `923332529504`

| Command | Action | Example |
| :--- | :--- | :--- |
| `help` or `/help` | Shows all available admin commands | `help` |
| `status` | Checks server health, DB, and memory | `status` |
| `products` | Lists first 10 products with stock & price | `products` |
| `price <id> <new_price>` | Updates a product price instantly | `price cmu33v2w30000qu6va6kochs0 480` |
| `stock <id> <quantity>` | Updates product stock quantity | `stock cmu33v2w30000qu6va6kochs0 100` |
| **Send Image with Caption** | AI generates description, stores to S3, and adds product | Caption: `Pure Mustard Oil, 500 PKR, Category: mustard` |

---

## 🌐 4. Free Domain & SSL (Custom Domain Setup)

When you register a free domain (e.g. via Freenom, Cloudflare, or local registrar):

1. Add an **A Record** in your DNS settings:
   ```
   Type: A
   Host / Name: @ (or api)
   Value / Points to: 13.233.225.152
   TTL: Auto
   ```

2. SSH into the server and run Certbot for **Free Automatic SSL (HTTPS)**:
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
   Certbot will automatically configure HTTPS on port 443 and auto-renew certificates forever!

---

## 💾 5. Database Backup & Restore

### Take Manual Backup
```bash
sudo -u postgres pg_dump madhushud > ~/backup_$(date +%F).sql
```

### Restore Database
```bash
sudo -u postgres psql -d madhushud < ~/backup_2026-09-16.sql
```
