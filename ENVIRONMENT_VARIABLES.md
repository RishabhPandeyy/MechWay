# MechWay Environment Variables for Deployment

## Required Environment Variables

Copy these and add them to your deployment platform (Vercel/Render/Railway):

```
# 1. MongoDB Connection (REQUIRED)
MONGO_URI=mongodb+srv://mechway_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/mechway?retryWrites=true&w=majority

# 2. Admin Panel Key (REQUIRED - for accessing /admin)
ADMIN_KEY=mechway2024secure

# 3. JWT Secret (REQUIRED - for login/signup)
JWT_SECRET=mechway_jwt_secret_key_2024_change_in_production

# 4. Node Environment
NODE_ENV=production

# 5. Port (optional - platform will set this)
PORT=3000

# 6. Razorpay (optional - for payments)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

---

## How to Get MONGO_URI

### Step 1: Create MongoDB Atlas Account
1. Go to: https://www.mongodb.com/atlas
2. Click "Try Free" → Create account
3. Create free cluster (M0)

### Step 2: Create Database User
- Database Access → Add New User
```
Username: mechway_admin
Password: (generate and SAVE IT!)
Role: Read and Write to any database
```

### Step 3: Allow Network Access
- Network Access → Add IP Address
- Select: "Allow Access from Anywhere" (0.0.0.0/0)

### Step 4: Get Connection String
- Database → Connect → Drivers
- Copy the URI
- Replace `<password>` with your saved password
- Replace `<dbname>` with `mechway`

---

## Example Complete MONGO_URI

```
mongodb+srv://mechway_admin:MySecurePassword123@cluster0.abcde.mongodb.net/mechway?retryWrites=true&w=majority
```

---

## Add to Vercel

1. Go to https://vercel.com
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Add each variable one by one
5. Redeploy

## Add to Render

1. Go to https://render.com
2. Select your Web Service
3. Go to "Environment" tab
4. Add each variable
5. Redeploy

---

## Verify Deployment

After adding variables, visit:
- `https://your-app.vercel.app/api/health`
- Should return: `{"ok":true,"storage":"mongodb"}`

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `MongoNetworkError` | Add 0.0.0.0/0 in MongoDB Atlas Network Access |
| `auth failed` | Check username/password in MONGO_URI |
| `database name` | Make sure `/mechway` is at end of MONGO_URI |
| `CORS error` | Domain not in CORS allowed list (already configured) |

