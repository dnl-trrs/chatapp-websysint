const fs = require('fs');
const path = require('path');
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');

const REGION = 'us-east-2'; // Hardcode region as it's known from CDK deployment

async function generateEnvFile() {
  const client = new SSMClient({ region: REGION });
  const params = {
    Path: '/chatapp/prod/',
    Recursive: true,
    WithDecryption: false, // Assuming no encrypted parameters for now
  };

  try {
    const command = new GetParametersByPathCommand(params);
    const response = await client.send(command);

    let envContent = '';
    if (response.Parameters) {
      response.Parameters.forEach(param => {
        // Remove the path prefix from the parameter name to get the environment variable name
        const name = param.Name.replace(params.Path, '');
        envContent += `${name}=${param.Value}\n`;
      });
    }

    fs.writeFileSync(path.join(__dirname, '../.env.local'), envContent);
    console.log('Successfully created .env.local file from SSM parameters.');
  } catch (error) {
    console.error('Error generating .env.local from SSM:', error);
    process.exit(1);
  }
}

generateEnvFile();
