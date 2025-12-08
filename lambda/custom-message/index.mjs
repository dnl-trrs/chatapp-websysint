import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = join(__dirname, 'confirm-email.html');

let cachedTemplate;
const getTemplate = () => {
  if (!cachedTemplate) {
    cachedTemplate = readFileSync(templatePath, 'utf8');
  }
  return cachedTemplate;
};

export const handler = async (event) => {
  const { triggerSource } = event;
  if (!triggerSource?.startsWith('CustomMessage_')) {
    return event;
  }

  const code = event.request.codeParameter ?? '------';
  const displayName =
    event.request.userAttributes?.name ||
    event.request.userAttributes?.preferred_username ||
    event.request.userAttributes?.email?.split('@')[0] ||
    'there';
  const confirmationLink =
    event.request.clientMetadata?.confirmationLink ||
    event.request.clientMetadata?.redirectUrl ||
    '#';

  const template = getTemplate();
  const populated = template
    .replace(/{{displayName}}/g, displayName)
    .replace(/{{####CODE####}}/g, code)
    .replace(/{{confirmationLink}}/g, confirmationLink)
    .replace(/{{currentYear}}/g, new Date().getFullYear().toString());

  event.response.emailSubject = 'Confirm your ChatApp account';
  event.response.emailMessage = populated;

  return event;
};
