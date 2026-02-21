# 🚀 Simple Server Deployment Guide

## How to Deploy Your MechWay Server to Vercel

### Step 1: Go to Vercel Dashboard
1. Visit: https://vercel.com/dashboard
2. Sign in with your account

### Step 2: Find Your Project
1. Look for your `new-on-wheels` project
2. Click on it to open

### Step 3: Update Project Settings
1. Click **Settings** tab
2. Go to **Functions** section
3. Set **Root Directory** to: `server`

### Step 4: Add Environment Variables
1. Click **Settings** → **Environment Variables**
2. Add these 3 variables:

```
MONGO_URI = mongodb+srv://rishabhmech:mechucer@cluster0.kdiixo5.mongodb.net/?appName=Cluster0
JWT_SECRET = CwKSIP0F/w4W2cYJxkBMoifHpM/b7Fmo5Wrd6wKBa7Q=
ADMIN_KEY = mechway_admin_a+w0Z22amDk0kQO1bTkNhA==
```

### Step 5: Redeploy
1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Wait for deployment to complete

### Step 6: Test
- Visit: https://new-on-wheels.vercel.app/api/health
- Should show: `{"ok":true,"timestamp":...}`

## 🎯 That's It!
Your server will be live and your website will work completely.

**Estimated Time**: 5 minutes
**Result**: Fully functional MechWay website!
