# MessageAI

A powerful messaging application with AI capabilities, built with React Native and Expo.

## Features

- Real-time messaging
- AI-powered chat assistance
- Group chats
- Offline support
- Presence indicators
- Typing indicators
- Message delivery status
- And more!

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Firebase project
- OpenAI API key

### Installation

1. Clone the repository

   ```bash
   git clone <repository-url>
   cd MessageAI
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Set up environment variables

   ```bash
   cp env.example .env
   ```

   Then edit `.env` and add your configuration values:
   - Firebase configuration (from your Firebase project settings)
   - OpenAI API key (required)
   - n8n webhook URL (optional, for RAG agent features)

4. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go)

## Project Structure

- `app/` - Main application screens and routing
- `src/` - Core source code
  - `components/` - Reusable components
  - `contexts/` - React contexts for state management
  - `database/` - Database layer
  - `hooks/` - Custom React hooks
  - `services/` - Business logic and API services
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
- `functions/` - Cloud functions (Firebase)
- `projectdesign/` - Design documents and technical specifications

## Tech Stack

- React Native
- Expo
- Firebase (Firestore, Realtime Database, Storage, Authentication)
- TypeScript
- SQLite (local database)

## Learn More

- [Expo documentation](https://docs.expo.dev/)
- [Firebase documentation](https://firebase.google.com/docs)
- [React Native documentation](https://reactnative.dev/)
