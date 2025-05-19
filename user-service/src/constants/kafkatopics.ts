export enum DeviceTokenService {
    DELETE_DEVICE_TOKEN = 'delete-device-token',
    CREATE_DEVICE_TOKEN= 'create-device-token',
}

export enum UserServiceEvents {
    SEND_VERIFICATION_EMAIL = 'send-verification-email',
    SEND_PASSWORD_RESET_EMAIL = 'send-password-reset-email',
    SEND_WELCOME_EMAIL = 'send-welcome-email'
}

export enum ApplicationServiceEvents {
    APPLICATION_CREATED = 'application-created',
    APPLICATION_UPDATED = 'application-updated',
    APPLICATION_VERIFIED = 'application-verified',
    APPLICATION_REJECTED = 'application-rejected',
    APPLICATION_DELETED = 'application-deleted'
}