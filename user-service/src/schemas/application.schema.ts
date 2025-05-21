import { z } from 'zod';
import { ApplicationStatus } from '@models/application.model';

export const CreateApplicationSchema = z.object({
    bio: z.string({
        required_error: "Bio is required",
        invalid_type_error: "Bio must be a string"
    })
    .trim()
    .min(10, { message: "Bio must be at least 10 characters long" })
    .max(500, { message: "Bio must be at most 500 characters long" }),

    organization: z.string({
        required_error: "Organization is required",
        invalid_type_error: "Organization must be a string"
    })
    .trim()
    .min(2, { message: "Organization name must be at least 2 characters long" })
    .max(100, { message: "Organization name must be at most 100 characters long" })
    .optional()
});

export const UpdateApplicationSchema = z.object({
    bio: z.string({
        invalid_type_error: "Bio must be a string"
    })
    .trim()
    .min(10, { message: "Bio must be at least 10 characters long" })
    .max(500, { message: "Bio must be at most 500 characters long" })
    .optional(),

    organization: z.string({
        invalid_type_error: "Organization must be a string"
    })
    .trim()
    .min(2, { message: "Organization name must be at least 2 characters long" })
    .max(100, { message: "Organization name must be at most 100 characters long" })
    .optional()
})

export const VerifyApplicationSchema = z.object({
    status: z.enum([ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED], {
        required_error: "Status is required",
        invalid_type_error: "Status must be either 'accepted' or 'rejected'"
    }),
    message: z.string()
        .trim()
        .max(500, { message: "Message must be at most 500 characters long" })
        .optional()
});

export const GetApplicationByStatusSchema = z.object({
    status: z.enum(Object.values(ApplicationStatus) as [string, ...string[]], {
        required_error: "Status is required",
        invalid_type_error: "Invalid status value"
    })
});

export const GetApplicationByUserSchema = z.object({
    username: z.string({
        required_error: "Username is required",
        invalid_type_error: "Username must be a string"
    })
    .trim()
    .min(2, { message: "Username must be at least 2 characters long" })
});

export const ApplicationIdSchema = z.object({
    applicationId: z.string({
        required_error: "Application ID is required",
        invalid_type_error: "Application ID must be a string"
    })
    .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid application ID format" })
});
