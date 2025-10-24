// Unified services - automatically selects AWS or Firebase based on configuration

// Check if AWS is configured
const isAWSConfigured = () => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID && 
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.NEXT_PUBLIC_AWS_REGION
  );
};

// Friend Service
export * as friendService from './aws-friend-service';
export * from './aws-friend-service';

// Conversation Service  
export * as conversationService from './aws-conversation-service';
export * from './aws-conversation-service';

// Re-export for backward compatibility
export const getServiceType = () => {
  return isAWSConfigured() ? 'aws' : 'firebase';
};

export const isUsingAWS = isAWSConfigured;

// Log which service is being used
if (typeof window !== 'undefined') {
  console.log(`Chat app is using ${getServiceType()} services`);
}