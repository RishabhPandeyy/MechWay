# MechWay Deployment Guide - Complete Step by Step

## Your Current Project Structure
```
/OnWheel/
├── index.html          (Home page with contact form)
├── mechanic.html       (Booking form)
├── shop.html           (Product inquiries)
├── contact.html        (Contact form)
├── server/
│   ├── server.js       (Node.js backend - already has all APIs!)
│   ├── package.json
│   ├── mechway.json    (Fallback storage)
│   └── .env            (Environment variables)
```

---

## Step 1: Create MongoDB Atlas Database

### 1.1 Create Account
- Go to: https://www.mongodb.com/atlas
- Click "Try Free" → Create account
- Verify email

### 1.2 Create Free Cluster
- Click "Create New Project" → Name: "MechWay"
- Click "Build Cluster" → Choose "M0 Free"
- Provider: AWS (or Google Cloud)
- Region: Choose nearest to India (Mumbai/Asia)
- Click "Create Cluster" (wait 2-3 minutes)

### 1.3 Create Database User
- In Atlas sidebar: Click "Database Access"
- Click "Add New Database User"
```
Username: mechway_admin
Password: (generate strong password and SAVE IT!)
Role: Read and Write to any database
```
- Click "Add User"

### 1.4 Allow Network Access
- In Atlas sidebar: Click "Network Access"
- Click "Add IP Address"
- Select "Allow Access from Anywhere" (0.0.0.0/0)
- Click "Confirm"

### 1.5 Get Connection String
- Click "Database" → "Connect" → "Drivers"
- Copy the connection string:
```
mongodb+srv://mechway_admin:<password>@cluster0.xxxxx.mongodb.net/mechway?retryWrites=true&w=majority
```
- **Replace `<password>`** with the password you saved in Step 1.3
- Save this string - you'll need it!

---

## Step 2: Deploy Backend to Railway

### 2.1 Prepare Your Code
Your backend is already in `/server/`. Railway needs:
- `server/package.json`
- `server/server.js`
- `server/.env` (for environment variables)

### 2.2 Push to GitHub
1. Create GitHub repo: https://github.com/new (name: "mechway-backend")
2. In terminal:
```bash
cd /Users/techierisy/OnWheel/server
git init
git add .
git commit -m "Initial MechWay backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mechway-backend.git
git push -u origin main
```

### 2.3 Deploy to Railway
1. Go to: https://railway.app
2. Login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your "mechway-backend" repo
5. Click "Deploy Now"

### 2.4 Add Environment Variables
In Railway dashboard:
1. Click your deployed service
2. Go to "Variables" tab
3. Add these:
```
MONGO_URI=mongodb+srv://mechway_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/mechway?retryWrites=true&w=majority
ADMIN_KEY=mechway_secure_key_2024
JWT_SECRET=mechway_jwt_secret_2024
NODE_ENV=production
PORT=3000
```
4. Click "Add"
5. Go to "Deployments" → Click "Redeploy" to apply changes

### 2.5 Get Your Backend URL
- After deployment, Railway gives you a URL like:
```
https://mechway-backend.up.railway.app
```

---

## Step 3: Update Frontend to Use Railway Backend

### 3.1 Update All Frontend Files
Update these files to use your Railway URL:

**In index.html, mechanic.html, shop.html, contact.html:**
Find the JavaScript section and update the `getBackendURL` function:

```javascript
const getBackendURL = () => {
    // Use Railway backend URL (PRODUCTION)
    return 'https://mechway-backend.up.railway.app';
    
    // For local development, uncomment below:
    // return 'http://localhost:4000';
};
```

Or use this dynamic version that auto-detects:
```javascript
const getBackendURL = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:4000';
    }
    // Production: use Railway backend
    return 'https://mechway-backend.up.railway.app';
};
```

### 3.2 Files to Update
Update the JavaScript in these files:
- `/index.html` - Update getBackendURL function
- `/mechanic.html` - Update getBackendURL function
- `/shop.html` - Update backendURL variable
- `/contact.html` - Update backendURL variable

---

## Step 4: Deploy Frontend to Hostinger

### 4.1 Upload Files to Hostinger
1. In Hostinger hPanel → File Manager → public_html
2. Upload these files:
```
index.html
about.html
mechanic.html
shop.html
contact.html
service.html
*.png, *.jpg, *.svg, *.webp, *.avif (all images)
*.css (ostyle.css, ocontact.css)
```

### 4.2 Verify Static Files Work
- Visit: https://mechway.in
- Should see your homepage

---

## Step 5: Test Everything

### 5.1 Test Backend API
Visit your Railway URL:
- https://mechway-backend.up.railway.app/api/health
- Should return: `{"ok":true,"timestamp":...,"storage":"mongodb"}`

### 5.2 Test Contact Form
1. Visit: https://mechway.in
2. Fill contact form
3. Submit
4. Should see success message

### 5.3 Test Admin Panel
1. Visit: https://mechway-backend.up.railway.app/admin
2. Enter admin key: `mechway_secure_key_2024`
3. Should see all submitted data

---

## Complete Architecture (Final)

```
User Browser
     |
     v
https://mechway.in (Hostinger - Static Files)
     |
     v (API calls)
https://mechway-backend.up.railway.app (Railway - Node.js API)
     |
     v
MongoDB Atlas (Cloud Database)
```

---

## Troubleshooting

### Issue: CORS Error
**Fix:** Ensure server.js has correct CORS settings (already configured for mechway.in)

### Issue: MongoDB Connection Failed
**Fix:** 
1. Check MONGO_URI is correct
2. Ensure IP 0.0.0.0/0 is allowed in MongoDB Atlas
3. Check Railway logs for errors

### Issue: 404 on API Calls
**Fix:** 
1. Verify Railway backend URL is correct
2. Check API endpoint paths (should be `/api/contact`, not `/contact`)

---

## Quick Reference

| Component | URL | Credentials |
|-----------|-----|-------------|
| Frontend | https://mechway.in | - |
| Backend API | https://mechway-backend.up.railway.app | - |
| Admin Panel | https://mechway-backend.up.railway.app/admin | ADMIN_KEY |
| MongoDB Atlas | https://cloud.mongodb.com | mechway_admin / YOUR_PASSWORD |

---

## Commands to Update Frontend

Run these commands to update all frontend files to use your Railway URL:

```bash
cd /Users/techierisy/OnWheel

# Update index.html
sed -i '' "s|http://localhost:4000|https://mechway-backend.up.railway.app|g" index.html

# Update mechanic.html
sed -i '' "s|http://localhost:4000|https://mechway-backend.up.railway.app|g" mechanic.html

# Update shop.html
sed -i '' "s|http://localhost:4000|https://mechway-backend.up.railway.app|g" shop.html

# Update contact.html
sed -i '' "s|http://localhost:4000|https://mechway-backend.up.railway.app|g" contact.html
```

**After updating, re-upload files to Hostinger!**

