# ChatApp Web

Modern chat client built with **Next.js 16 (App Router)** on top of an AWS-first backend. Users can register, confirm their email with a custom-styled message, find friends, start DM conversations, and exchange messages through DynamoDB-backed APIs.

---

## Key Features

- **Cognito authentication** with multi-step register → email confirmation → login flows.
- **Custom confirmation email** delivered by a Lambda trigger that renders the dark themed HTML template in `lambda/custom-message`.
- **Friend management** (search, send requests, accept/reject, remove) backed by DynamoDB tables.
- **Direct messaging** with conversation creation, chat dashboard, conversation drawer, and AWS Conversation Service helpers.
- **Optimistic UI** for friends and pending requests plus avatar/status caching.
- **Infrastructure-as-code** (CDK) + AWS Amplify Hosting pipeline, plus helper scripts for syncing stack outputs/SSM parameters.

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 18, TypeScript, Tailwind CSS, Turbopack |
| Auth | Amazon Cognito User Pools (password + confirmation code flow) |
| Data | Amazon DynamoDB (users, friends, friend-requests, conversations, messages) |
| Messaging | Next.js API routes calling AWS services, custom Lambda for email styling |
| Infra / Deploy | AWS CDK (in `infra/`), Amplify Hosting (build via `amplify.yml`), helper Node scripts |

---

## Project Structure

```
app/                    # Next.js routes (register, login, confirm, chat, etc.)
components/             # UI components (FriendsPanel, UserProfileCard, etc.)
hooks/                  # React hooks (auth, toast)
lib/aws/                # Client-side AWS helpers (DynamoDB, conversations, friends)
scripts/                # Utility scripts for syncing users/SSM parameters
infra/                  # CDK stacks for backend resources
lambda/custom-message/  # Cognito custom message Lambda + HTML template
emails/                 # Reference copy of confirmation email template
```

---

## Environment & Configuration

1. Copy the sample env file:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in the Cognito IDs, DynamoDB table names, API endpoints, S3 buckets, etc. You can also run `node scripts/generate-env-from-ssm.js` to pull parameters from AWS SSM (requires AWS credentials with read access).
3. Required tooling:
   - Node.js 20.x + npm 10+
   - AWS CLI configured for the target account
   - CDK CLI (`npm install -g aws-cdk`) if you plan to deploy infra from `infra/`.

---

## Development

```bash
npm install
npm run dev            # starts Next.js on http://localhost:3000
npm run lint           # optional linting
npm run build          # production build (also used by Amplify)
```

When running locally the app uses the values in `.env.local`. For cloud builds, Amplify runs `node scripts/generate-env-from-ssm.js` (see `amplify.yml`) to hydrate `.env.local` from SSM.

---

## AWS Helper Scripts

| Script | Purpose |
| --- | --- |
| `node scripts/generate-env-from-ssm.js` | Reads `/amplify/<appId>/<env>/` parameters from AWS SSM Parameter Store and writes `.env.local`. |
| `node scripts/sync-ssm-from-outputs.js` | Pushes the latest CDK stack outputs (Cognito IDs, DynamoDB table names, etc.) into SSM so Amplify and local builds stay in sync. Run after `cdk deploy`. |
| `node scripts/manual-sync-users.js` | One-time backfill that synchronizes existing Cognito users into the DynamoDB `chatapp-users` table. Only use when explicitly needed; registration normally writes users automatically. |

---

## Deployment Workflow

1. **Provision/update infrastructure**
   ```bash
   cd infra
   npm install
   npx cdk deploy --all
   cd ..
   ```
2. **Sync stack outputs to SSM**
   ```bash
   node scripts/sync-ssm-from-outputs.js
   ```
3. **Update the custom email Lambda (if template changed)**
   ```bash
   cd lambda/custom-message
   Compress-Archive -Path index.mjs,confirm-email.html -DestinationPath ../chatapp-custom-message.zip -Force
   # Upload the zip via Lambda console or AWS CLI, ensuring handler = index.handler
   ```
4. **Deploy frontend via Amplify Hosting**
   - Push to the `Final` branch (Amplify is configured via `amplify.yml` to run `npm ci`, generate env from SSM, and `npm run build`).
   - Monitor the Amplify build logs for success/failures.

---

## Custom Confirmation Email

The HTML template lives in `lambda/custom-message/confirm-email.html` (with a reference copy in `emails/`). The Lambda handler (`lambda/custom-message/index.mjs`) reads the template, replaces tokens like `{{displayName}}` and `{{####CODE####}}`, and populates `event.response.emailMessage`. Attach this Lambda as the **Custom message** trigger inside your Cognito User Pool to ensure every signup receives the styled email.

---

## Troubleshooting

- **USER_PASSWORD_AUTH flow not enabled**: ensure your Cognito App Client has “Allow user password auth” enabled.
- **Missing display names / avatars**: run the app after the DynamoDB tables are populated; the profile cache (`FriendsPanel.tsx`) fetches from `/api/users`.
- **Conversation stuck / missing after close**: refresh `app/chat/ChatDashboard.tsx` logic or clear the `conversations` DynamoDB table.
- **Custom email not sent**: check CloudWatch logs for the `chatapp-custom-message` Lambda; ensure the handler file is at the root of the uploaded zip and Handler is set to `index.handler`.