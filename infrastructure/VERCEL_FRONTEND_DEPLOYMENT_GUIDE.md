# 🚀 Vercel Frontend Deployment Guide — MadhuShud

Aapka backend AWS EC2 (`http://13.233.225.152/api`) par live chal raha hai. Frontend ko Vercel par 100% Free live karne ke exact steps:

---

## 📋 Step-by-Step Vercel Deployment

### Step 1: Vercel Dashboard Open Karein
1. Browser mein jao: **[https://vercel.com/new](https://vercel.com/new)**
2. Apne **GitHub account** se sign in karein (`Bhushan312Nandani`).

---

### Step 2: GitHub Repository Import Karein
1. **"Import Git Repository"** ke list mein aapko dikhega:
   👉 **`Bhushan312Nandani/Madhu-Project`**
2. Agar list mein na dikhe, toh search bar mein `Madhu-Project` type karein.
3. Uske samne blue **"Import"** button click karein.

---

### Step 3: Project Configuration (Bohat Zaroori Settings)

Aapke samne "Configure Project" screen aayegi:

1. **Project Name:** `madhushud` (ya jo aap rakhna chahein)
2. **Framework Preset:** `Create React App` (Automatic select ho jayega)
3. **Root Directory:** 
   - Samne **Edit** click karein.
   - Folder list mein se **`frontend`** select karein aur **Continue** click karein.  
   *(⚠️ Root directory ko `frontend` select karna laazmi hai!)*

---

### Step 4: Environment Variables Add Karein

**"Environment Variables"** section ko expand karein aur yeh variable add karein:

| Key | Value |
| :--- | :--- |
| `REACT_APP_API_URL` | `http://13.233.225.152/api` |
| `GENERATE_SOURCEMAP` | `false` |

---

### Step 5: "Deploy" Par Click Karein! 🚀

1. Blue **"Deploy"** button click karein.
2. Vercel 1 minute ke andar code build karega:
   ```
   ✓ Cloning repository
   ✓ Installing dependencies
   ✓ Running "npm run build"
   ✓ Uploading build outputs
   ✓ Deployed successfully!
   ```
3. Screen par confetti 🎊 aayegi aur aapko live URL mil jayega, maslan:
   👉 **`https://madhushud.vercel.app`**

---

## 🔄 Auto-Deploy Feature:
Ab jab bhi aap code mein koi change karke GitHub par `git push` karenge:
- Vercel automatically naya code uthayega aur bina kisi rukawat ke website update kar dega!
