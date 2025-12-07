const fs = require('fs');
const path = require('path');
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');

const region =
  process.env.SSM_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'us-east-2';
const basePath = (process.env.SSM_BASE_PATH || '/chatapp/prod/').replace(/\/?$/, '/');

async function generateEnvFile() {
  const client = new SSMClient({ region });
  const params = {
    Path: basePath,
    Recursive: true,
    WithDecryption: false, // Assuming no encrypted parameters for now
  };

  try {
    let envContent = '';
    let nextToken = undefined;

    do {
      const command = new GetParametersByPathCommand({
        ...params,
        NextToken: nextToken,
      });
      const response = await client.send(command);

      if (response.Parameters) {
        response.Parameters.forEach(param => {
          const name = param.Name.replace(basePath, '');
          envContent += `${name}=${param.Value}\n`;
        });
      }

      nextToken = response.NextToken;
    } while (nextToken);

    if (!envContent) {
      console.warn(`No parameters found under ${basePath} in ${region}.`);
    }

    fs.writeFileSync(path.join(__dirname, '../.env.local'), envContent);
    console.log(`Successfully created .env.local file from SSM parameters in ${region}.`);
  } catch (error) {
    console.error('Error generating .env.local from SSM:', error);
    process.exit(1);
  }
}

generateEnvFile();
