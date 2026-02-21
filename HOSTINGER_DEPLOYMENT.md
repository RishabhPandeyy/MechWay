# MechWay Deployment to Hostinger

## Prerequisites
- Hostinger account with Node.js hosting enabled
- Domain: mechway.in pointing to Hostinger
- SSH access to your hosting account (optional)

## Step 1: Prepare Your Files

Your project structure on Hostinger should be:
```
public_html/ (or your web root)
├── index.html
├── about.html
├── mechanic.html
├── shop.html
├── contact.html
├── service.html
├── .htaccess
└── server/
    ├── server.js
    ├── package.json
    ├── vercel.json
    └── mechway.json
```

## Step 2: Upload to Hostinger

**Option A - Via File Manager:**
1. Go to Hostinger hPanel → File Manager
2. Upload all files to `public_html` folder
3. Make sure server folder is inside public_html

**Option B - Via FTP:**
1. Use FileZilla or WinSCP
2. Connect using Hostinger FTP credentials
3. Upload to `/public_html/`

## Step 3: Configure Node.js on Hostinger

1. **In hPanel:**
   - Go to **Advanced** → **Node.js**
   - Click "Create New Application"
   - Configure:
     - **Application Root**: `public_html/server`
     - **Application URL**: mechway.in
     - **Node.js Version**: 18.x or 20.x
     - **Application Mode**: Production
     - **Application Startup File**: `server.js`

2. **Install Dependencies:**
   - Click "Run npm install" in Node.js section
   - Or use the built-in terminal

3. **Set Environment Variables:**
   In Node.js settings, add these:
   ```
   MONGO_URI=your_mongodb_connection_string
   ADMIN_KEY=mechway_admin_2024_production
   JWT_SECRET=mechway_super_secret_jwt_key_2024
   PORT=3000
   NODE_ENV=production
   FRONTEND_URL=https://mechway.in
   ```

4. **Start Application:**
   - Click "Start Application"
   - Status should change to "Running"

## Step 4: Create .htaccess for URL Rewiting

Create `public_html/.htaccess` with this content:
```apache
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# API requests to Node.js backend (port 3000)
RewriteCond %{REQUEST_URI} ^/api/(.*)$ [NC]
RewriteRule ^api/(.*)$ http://localhost:3000/api/$1 [P,L]

# Admin panel to Node.js backend
RewriteCond %{REQUEST_URI} ^/admin$ [NC]
RewriteRule ^admin$ http://localhost:3000/admin [P,L]

# Health check endpoint
RewriteCond %{REQUEST_URI} ^/api/health$ [NC]
RewriteRule ^api/health$ http://localhost:3000/api/health [P,L]

# Serve static files for everything else
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ / [L,QSA]
```

## Step 5: MongoDB Setup

**Create Free MongoDB Atlas Account:**

1. Go to: https://www.mongodb.com/atlas
2. Click "Try Free" → Create Account
3. Create free cluster (choose free tier)
4. Create database user (username/password)
5. **Network Access:**
   - Go to Network Access → Add IP Address
   - Add: `0.0.0.0/0` (allows all IPs for now)

**Get Connection String:**
1. In Atlas → Database → Connect → Connect your app
2. Copy the Node.js connection string
3. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxx.mongodb.net/mechway?retryWrites=true&w=majority
   ```

4. **Add to Hostinger Node.js environment variables**

## Step 6: Test Deployment

1. **Test Frontend:**
   - Visit: https://mechway.in
   - Should see the MechWay homepage

2. **Test Contact Form:**
   - Fill out the contact form
   - Submit and check for success message

3. **Test Admin Panel:**
   - Visit: https://mechway.in/admin
   - Enter admin key: `mechway_admin_2024_production`
   - Should see all submitted data

4. **Test API:**
   - Visit: https://mechway.in/api/health
   - Should return: `{"ok":true,"storage":"mongodb"}` or lowdb

## Common Issues & Solutions

### Issue: "502 Bad Gateway"
**Solution:** Check Node.js is running on correct port (3000). Check logs in hPanel.

### Issue: API calls fail
**Solution:** Verify .htaccess is correct and Apache mod_rewrite is enabled.

### Issue: CORS errors
**Solution:** Update server.js CORS config for your domain.

### Issue: Static files not loading
**Solution:** Ensure files are in public_html root, not in subfolder.

## Production Checklist

- [ ] Domain mechway.in points to Hostinger
- [ ] SSL certificate installed (Hostinger does this automatically)
- [ ] Node.js app running on port 3000
- [ ] .htaccess file created with proxy rules
- [ ] MongoDB Atlas connected with connection string
- [ ] Environment variables set in hPanel
- [ ] Admin key changed from default
- [ ] Contact form submission tested
- [ ] Admin panel accessible and showing data

## Quick SSH Commands (if using terminal)

```bash
# Navigate to server folder
cd public_html/server

# Install dependencies
npm install

# Start the server
npm start

# Check if running
curl http://localhost:3000/api/health
```

---

**Need more help? Let me know what specific step you need assistance with!**

