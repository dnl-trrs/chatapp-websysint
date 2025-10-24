// Lambda function for auto-confirming Cognito users during registration
// Deploy this as a Pre Sign Up Lambda trigger in your Cognito User Pool

exports.handler = async (event) => {
    // Auto-confirm the user
    event.response.autoConfirmUser = true;
    
    // Auto-verify email
    if (event.request.userAttributes.hasOwnProperty('email')) {
        event.response.autoVerifyEmail = true;
    }
    
    // Auto-verify phone number
    if (event.request.userAttributes.hasOwnProperty('phone_number')) {
        event.response.autoVerifyPhone = true;
    }
    
    // Return the event back to Cognito
    return event;
};