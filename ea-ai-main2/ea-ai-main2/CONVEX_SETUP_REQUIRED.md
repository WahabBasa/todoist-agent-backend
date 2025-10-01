# ⚠️ CRITICAL: Convex Environment Variable Setup Required

## Issue Resolved
This fix resolves two authentication issues:
1. **Admin Dashboard menu button missing for all users (including admin)**
2. **OAuth redirect loop after Google sign-in (redirects back to login page)**

## Code Changes Applied ✅
- ✅ Added `afterSignInUrl` and `afterSignUpUrl` to ClerkProvider
- ✅ Enhanced OAuth error handling with detailed logging
- ✅ Added OAuth callback loading state detection
- ✅ Added admin status debug logging

## ⭐ MANUAL SETUP REQUIRED - DO THIS FIRST!

### Step 1: Add Missing Environment Variable to Convex

The `CLERK_JWT_ISSUER_DOMAIN` environment variable is **CRITICAL** for Convex to validate Clerk JWT tokens. Without it:
- Convex cannot authenticate any users
- Admin check returns `false` for everyone (including actual admin)
- Admin Dashboard menu button never appears

**Follow these steps:**

1. **Open Convex Dashboard**
   - Go to: https://dashboard.convex.dev
   - Select your project: **"ea-ai-main2"**

2. **Navigate to Environment Variables**
   - Click on **Settings** (left sidebar)
   - Click on **Environment Variables** tab

3. **Add the Variable**
   - Click **"Add Variable"** button
   - Enter the following:
     - **Name**: `CLERK_JWT_ISSUER_DOMAIN`
     - **Value**: `https://tender-wren-51.clerk.accounts.dev`
   
   > ℹ️ **How to get the correct value:**
   > 1. Go to Clerk Dashboard: https://dashboard.clerk.com
   > 2. Select your application
   > 3. Go to **Configure** → **JWT Templates**
   > 4. Select the template you're using (usually "Default")
   > 5. Look for the **"Issuer"** field
   > 6. Copy that exact URL (e.g., `https://tender-wren-51.clerk.accounts.dev`)

4. **Save and Wait for Deployment**
   - Click **"Save"**
   - Convex will automatically redeploy (~30 seconds)
   - Wait for the status to show "Deployed" before testing

### Step 2: Verify the Fix

After adding the environment variable, test the following:

#### Test 1: Admin Menu Button
1. **Sign in** as the admin user (wahabbasa@gmail.com)
2. Click the **profile icon** in the sidebar
3. **Expected**: "Admin Dashboard" menu option should appear in dropdown
4. Click "Admin Dashboard" to verify access works

#### Test 2: Non-Admin User
1. **Sign out**
2. **Sign in** with a non-admin Google account
3. Click the **profile icon** in the sidebar
4. **Expected**: "Admin Dashboard" option should NOT appear
5. **Expected**: User can access Settings and use the app normally

#### Test 3: OAuth Redirect
1. **Sign out**
2. Click "Continue with Google"
3. Complete OAuth flow (pick account, consent to calendar permissions)
4. **Expected**: Redirects to chat view (not back to login page)
5. **Expected**: In browser console, see `🔐 OAuth callback detected, processing...`

### Step 3: Check Debug Logs

Open browser console (F12) and look for these logs:

```
🔐 [FRONTEND] Admin check: { adminStatus: true, isAdmin: true, isLoading: false, type: 'boolean' }
```

For **admin user**, should see:
- `adminStatus: true`
- `isAdmin: true`

For **non-admin user**, should see:
- `adminStatus: false`
- `isAdmin: false`

### Step 4: Check Convex Logs (Optional)

In Convex Dashboard → Logs, you should see:
```
🔐 [Admin] Auth check for user: user_31djIXNb... (wahabbasa@gmail.com)
🔐 [Admin] User ID match: true, Email match: true, Result: true
```

## Troubleshooting

### Issue: Admin button still not showing
**Causes**:
1. Environment variable not added to Convex
2. Environment variable has wrong value
3. Convex hasn't redeployed yet

**Fix**:
- Verify variable in Convex Dashboard → Settings → Environment Variables
- Check spelling: `CLERK_JWT_ISSUER_DOMAIN` (exact match)
- Wait for Convex to finish deploying
- Hard refresh browser (Ctrl+Shift+R)

### Issue: OAuth still redirecting to login
**Causes**:
1. Browser cache/cookies interfering
2. Clerk session not establishing

**Fix**:
- Test in incognito/private window
- Clear browser cookies for localhost
- Check browser console for errors during OAuth
- Verify `afterSignInUrl` is set in ClerkProvider (already done in code)

### Issue: Calendar permissions causing problems
If OAuth fails specifically during calendar consent screen:

**Option 1**: Keep trying (permissions might be temporarily unavailable)
**Option 2**: Remove calendar scopes from initial login (see Alternative Approach below)

## Alternative Approach: Remove Calendar OAuth from Login

If calendar permissions continue causing OAuth failures, you can move them to Settings:

1. Edit `src/components/providers.tsx`
2. Remove the `additionalOAuthScopes` prop from `ClerkProvider`
3. Request calendar permissions only when user enables Calendar integration in Settings

This matches the Todoist integration pattern (OAuth only when needed).

## Files Modified

1. `src/components/providers.tsx` - Added afterSignInUrl/afterSignUpUrl
2. `src/components/CustomAuthForm.tsx` - Enhanced OAuth error handling
3. `src/App.tsx` - Added OAuth callback loading state
4. `src/context/sessions.tsx` - Added admin status debug logging

## Admin User Details

**Admin User ID**: `user_31djIXNbI5eC6xbvUIKyxWgUTrH`
**Admin Email**: `wahabbasa@gmail.com`

These are stored in `.env.local` as `ADMIN_USER_ID` and `ADMIN_EMAIL`, but **Convex needs its own copy** in the dashboard environment variables (which it already has based on the working admin check logic).

## Summary

✅ **Code changes**: All applied and ready
⚠️ **Manual step**: Add `CLERK_JWT_ISSUER_DOMAIN` to Convex Dashboard
✅ **Expected result**: Admin menu appears, OAuth redirects correctly

---

**Last Updated**: January 31, 2025
**Branch**: fix-google-calendar-tool-2025-09-30
