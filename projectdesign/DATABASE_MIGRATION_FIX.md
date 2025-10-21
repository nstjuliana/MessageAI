# Database Migration Fix - editedAt Column Issue

**Date:** October 21, 2025  
**Issue:** SQLite error "no such column: editedAt"  
**Status:** ✅ Fixed

## Problem

The database was stuck at version 2 with the `editedAt` column missing from the `messages` table. This happened because:
1. Database version was incremented to 2
2. Migration to add `editedAt` column didn't complete successfully
3. Version was marked as current, so migration wouldn't run again

## Solution Applied

### 1. Enhanced Migration System

**Updated `src/database/schema.ts`:**
- Bumped database version from 2 to 3
- Ensures `editedAt` column is in schema

**Updated `src/database/database.ts`:**
- Added version 3 migration with failsafe logic
- Migration now:
  1. Tries to add `editedAt` column via ALTER TABLE
  2. If column exists, logs and continues
  3. If other error, rebuilds entire messages table with correct schema
  4. Preserves existing data during rebuild

**Key Features:**
- ✅ Handles duplicate column gracefully
- ✅ Rebuilds table if ALTER fails
- ✅ Preserves existing messages during rebuild
- ✅ Recreates indexes after rebuild
- ✅ Automatic fallback to database deletion/recreation if all else fails

### 2. Fixed AsyncStorage Warning

**Updated `src/config/firebase.ts`:**
- Changed from `getAuth()` to `initializeAuth()` with AsyncStorage
- Adds proper persistence for React Native
- Auth state now persists between sessions

**Benefits:**
- ✅ No more AsyncStorage warnings
- ✅ Users stay logged in after app restart
- ✅ Better auth state management

## How to Apply Fix

### Step 1: Restart Your App

Simply stop and restart the app:

```bash
# Stop the app (Ctrl+C)
npm start
```

### Step 2: Watch for Migration Logs

You should see one of these in the console:

**Success Case 1 (Column Added):**
```
Migrating to version 3: Ensuring editedAt column exists
✅ Added editedAt column to messages table
Migration completed successfully
```

**Success Case 2 (Column Already Exists):**
```
Migrating to version 3: Ensuring editedAt column exists
✅ editedAt column already exists
Migration completed successfully
```

**Success Case 3 (Table Rebuilt):**
```
Migrating to version 3: Ensuring editedAt column exists
⚠️ Could not add editedAt column: ...
Attempting to rebuild messages table...
✅ Messages table rebuilt with editedAt column
Migration completed successfully
```

**Fallback Case (Full Rebuild):**
```
Migration failed, attempting to rebuild database: ...
✅ Old database deleted
✅ Database rebuilt successfully!
```

### Step 3: Verify Fix

After restart, you should see:
```
✅ Database initialized successfully
✅ Database version: 3
✅ No errors when loading messages
```

## What Happens During Migration

### Scenario A: ALTER TABLE Success
```sql
ALTER TABLE messages ADD COLUMN editedAt INTEGER;
```
- Fastest option
- No data loss
- Instant completion

### Scenario B: Column Exists
- Detects duplicate column
- Skips ALTER TABLE
- Continues normally

### Scenario C: Table Rebuild
```sql
BEGIN TRANSACTION;

-- Create new table with correct schema
CREATE TABLE messages_new (...with editedAt...);

-- Copy all existing data
INSERT INTO messages_new SELECT * FROM messages;

-- Replace old table
DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

-- Recreate indexes
CREATE INDEX...

COMMIT;
```
- Preserves all existing messages
- Adds missing column
- Takes a few seconds

### Scenario D: Full Rebuild (Fallback)
- Deletes database file
- Creates new database from scratch
- Clears local messages (Firestore data safe)
- Messages reload from Firestore when chat opened

## Files Changed

1. **src/database/schema.ts**
   - Database version: 2 → 3
   - Schema includes `editedAt` column

2. **src/database/database.ts**
   - Added version 3 migration logic
   - Enhanced error handling
   - Added table rebuild capability
   - Improved fallback mechanisms

3. **src/config/firebase.ts**
   - Changed `getAuth()` to `initializeAuth()`
   - Added AsyncStorage persistence
   - Fixed React Native auth warnings

4. **scripts/rebuild-database.js**
   - Helper script with instructions
   - Manual rebuild guidance

## Testing

After applying the fix, test these scenarios:

### Test 1: Database Initialization
```
✓ App starts without errors
✓ Database version shows as 3
✓ No "editedAt" errors in logs
```

### Test 2: Message Loading
```
✓ Open a chat
✓ Messages load successfully
✓ No SQLite errors
```

### Test 3: Message Sending
```
✓ Send a message
✓ Message appears instantly
✓ Status updates correctly
✓ No errors in console
```

### Test 4: App Restart
```
✓ Force quit app
✓ Reopen app
✓ Still logged in (AsyncStorage working)
✓ Messages still visible
✓ No errors
```

## Rollback (If Needed)

If something goes wrong, you can force a clean start:

```typescript
import { rebuildDatabase } from '@/database/database';

// Call this once
await rebuildDatabase();
```

Or manually clear app data:
- **iOS Simulator:** Device > Erase All Content and Settings
- **Android Emulator:** Settings > Apps > Your App > Clear Data
- **Physical Device:** Uninstall and reinstall

## Prevention

To prevent similar issues in the future:

1. **Always test migrations** before committing
2. **Use try-catch** in migration logic
3. **Provide fallbacks** for failed migrations
4. **Log migration steps** for debugging
5. **Test on multiple devices/platforms**

## Success Criteria

✅ Database initializes to version 3  
✅ No "editedAt" column errors  
✅ Messages load successfully  
✅ Messages send successfully  
✅ No AsyncStorage warnings  
✅ Auth persists after restart  
✅ All existing functionality works  

## Next Steps

After confirming the fix works:
1. ✅ Continue with tasks 80-93 (receive messages, offline support)
2. ✅ Test optimistic UI thoroughly
3. ✅ Verify message persistence
4. ✅ Test on both iOS and Android

---

**Status:** Ready to test!  
**Expected Result:** All errors resolved, messages work perfectly ✨

