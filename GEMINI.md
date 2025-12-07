# GEMINI.md

## Project Overview

This is a modern real-time messaging application built with Next.js, React, TypeScript, and Tailwind CSS. The backend is powered by Next.js API routes and utilizes various AWS services for its core functionalities.

**Key Features:**

*   **User Authentication:** Secure user registration and login using AWS Cognito.
*   **Real-time Messaging:** Direct and group messaging capabilities.
*   **Friend Management:** Users can send, accept, and manage friend requests.
*   **Profile Customization:** Users can upload profile pictures, which are stored in AWS S3.
*   **Persistent Data:** All conversations and messages are stored in AWS DynamoDB.

**Tech Stack:**

*   **Framework:** Next.js 16
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI:** React 19, Lucide React icons
*   **Backend:** Next.js API Routes
*   **Database:** AWS DynamoDB
*   **Authentication:** AWS Cognito
*   **File Storage:** AWS S3

## Building and Running

### Prerequisites

*   Node.js 18+
*   npm or yarn
*   An AWS account with configured Cognito User Pool, DynamoDB tables, and S3 bucket.

### Environment Variables

Create a `.env.local` file in the project root and populate it with your AWS credentials as described in the `README.md` and `DEVELOPMENT_GUIDE.md`.

### Key Commands

*   **Install Dependencies:**
    ```bash
    npm install
    ```
*   **Run Development Server:**
    ```bash
    npm run dev
    ```
*   **Build for Production:**
    ```bash
    npm run build
    ```
*   **Start Production Server:**
    ```bash
    npm start
    ```
*   **Lint the Code:**
    ```bash
    npm run lint
    ```

## Development Conventions

*   **Code Style:** The project uses ESLint for code quality and Prettier for formatting (inferred from standard Next.js practices, though not explicitly configured in `package.json`).
*   **Type Safety:** TypeScript is used throughout the project.
*   **Component-Based Architecture:** The frontend is built with React components, located in the `components/` directory.
*   **API Routes:** The backend logic is handled by Next.js API routes located in `app/api/`.
*   **Services Layer:** Business logic is abstracted into a services layer in the `lib/` directory, which separates the core application logic from the AWS-specific implementation.
*   **Custom Hooks:** Custom React hooks in the `hooks/` directory are used for managing state and side effects, such as authentication and user profiles.
*   **Styling:** Styling is done using Tailwind CSS. Global styles are in `app/globals.css`.
*   **Testing:** There are no automated tests configured for this project. Manual testing is required.
