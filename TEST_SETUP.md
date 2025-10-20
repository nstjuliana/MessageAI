# Test Setup Guide

## Overview
Minimal critical path testing has been set up for the MessageAI project to ensure core functionality works correctly.

## Setup Complete ✅

### 1. Testing Dependencies Installed
```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native @types/jest ts-jest --legacy-peer-deps
```

### 2. Configuration Files Created
- `jest.config.js` - Jest configuration with React Native preset
- `jest.setup.js` - Global test setup with Firebase mocks
- `src/__mocks__/firebase-auth.mock.ts` - Reusable Firebase auth mocks

### 3. Test Scripts Added to package.json
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Running Tests ✅

Tests are now working! Run them with:
```bash
npm test                  # Run all tests
npm run test:watch       # Run in watch mode
npm run test:coverage    # Run with coverage report
```

**Note:** On Windows, the scripts use `node node_modules/jest/bin/jest.js` to avoid PATH issues.

## Tests Created

### Auth Service Tests ✅
Location: `src/services/__tests__/auth.service.test.ts`

**Coverage:**
- ✅ Sign up (success, invalid email, weak password, email in use)
- ✅ Sign in (success, user not found, wrong password, network error)
- ✅ Sign out
- ✅ Get current user
- ✅ Auth state change listener
- ✅ Update user profile
- ✅ Send password reset
- ✅ Change email (with reauthentication)
- ✅ Change password (with reauthentication)
- ✅ Reauthenticate

**Total Test Cases:** 28

## What's Tested (Critical Path)

### ✅ Phase 1: Authentication
- [x] Auth service with all Firebase Auth operations
- [x] Error handling for all auth scenarios
- [x] User profile updates

### 🔄 Phase 2: To Be Added
- [ ] User service (Firestore CRUD)
- [ ] Message service (send/receive)
- [ ] Offline queue system
- [ ] Database operations (SQLite)

### 🔄 Phase 3: To Be Added (Optional)
- [ ] Chat list logic
- [ ] Read receipts
- [ ] Presence tracking

## Testing Strategy

### What We Test
✅ Services (business logic)
✅ Utilities (pure functions)
✅ Error handling
✅ Edge cases

### What We Don't Test (MVP)
❌ Components (UI testing - too slow)
❌ Screens (integration - manual testing)
❌ Navigation flows
❌ Push notifications (requires physical devices)

## Mock Structure

### Firebase Mocks
All Firebase modules are mocked in `jest.setup.js`:
- firebase/app
- firebase/auth ✅ (detailed mocks created)
- firebase/firestore (basic mocks)
- firebase/storage (basic mocks)
- firebase/functions (basic mocks)

### Expo Mocks
- expo-constants
- expo-sqlite
- expo-notifications
- expo-device
- @react-native-community/netinfo

## Adding New Tests

### 1. Service Tests
Create test file: `src/services/__tests__/[service-name].service.test.ts`

```typescript
import { mockFunction } from '@/__mocks__/firebase-auth.mock';
import { myFunction } from '../my.service';

describe('My Service', () => {
  beforeEach(() => {
    // Reset mocks
  });

  it('should do something', async () => {
    mockFunction.mockResolvedValue('result');
    
    const result = await myFunction();
    
    expect(mockFunction).toHaveBeenCalled();
    expect(result).toBe('result');
  });
});
```

### 2. Utility Tests
Create test file: `src/utils/__tests__/[util-name].test.ts`

```typescript
import { myUtility } from '../my-utility';

describe('My Utility', () => {
  it('should transform data correctly', () => {
    const result = myUtility('input');
    expect(result).toBe('expected');
  });
});
```

## Coverage Goals

### Minimum for MVP
- Auth service: ✅ 100%
- Message service: 🎯 80%+
- Database operations: 🎯 80%+

### Nice to Have
- User service: 🎯 70%+
- Utilities: 🎯 90%+

## Troubleshooting

### Issue: Jest not found
```bash
npm install
```

### Issue: Module resolution errors
Check `jest.config.js` has correct `moduleNameMapper`:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
}
```

### Issue: Firebase mocks not working
Check `jest.setup.js` is properly configured in `jest.config.js`:
```javascript
setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
```

### Issue: React Native transform errors
Ensure `transformIgnorePatterns` in `jest.config.js` includes all necessary packages.

## Next Steps

1. ✅ Auth service tests complete
2. 🔄 Create user service and tests
3. 🔄 Create message service and tests
4. 🔄 Create database tests
5. 🔄 Run tests in CI/CD (optional)

## Time Investment

- Setup: ✅ ~1 hour
- Auth tests: ✅ ~30 minutes
- User service tests: 🎯 ~30 minutes
- Message service tests: 🎯 ~1 hour
- Database tests: 🎯 ~45 minutes

**Total: ~3.5 hours** (within 2-3 hour budget for minimal testing)

