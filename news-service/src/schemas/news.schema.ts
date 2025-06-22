import { z } from 'zod';
import { Languages, NewsStatus } from '@models/news.model';
import mongoose from 'mongoose';


// Schema for uploading news
export const UploadNewsSchema = z.object({
    title: z.string({
      required_error: "Title is required",
      invalid_type_error: "Title must be a string"
    })
    .min(5, { message: "Title should be atleast of 5 characters" })
    .max(200, { message: "Title must be at most 200 characters" }),
  
    content: z.string({
      required_error: "Content is required",
      invalid_type_error: "Content must be a string"
    })
    .min(1, { message: "Content cannot be empty" }),
  
    category: z.string( {
      required_error: "Category is required",
      invalid_type_error: "Category must be of type string"
    })
    .min(1, { message: "At least one category must be selected" }),
  
    language: z.nativeEnum(Languages, {
      required_error: "Language is required",
      invalid_type_error: "Invalid language"
    }),
  
    tags: z.array(z.string()).optional(),
    location: z.string().optional()
  });



  export const EditNewsSchema = z
  .object({
    title: z
      .string({
        invalid_type_error: "Title must be a string",
      })
      .min(5, { message: "Title should be at least 5 characters" })
      .max(200, { message: "Title must be at most 200 characters" })
      .optional(),

    content: z
      .string({
        required_error: "Content is required",
        invalid_type_error: "Content must be a string",
      })
      .min(1, { message: "Content cannot be empty" })
      .optional(),

    category: z
      .string({
        invalid_type_error: "Category must be a string (ObjectId)",
      })
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid category ID",
      })
      .optional(),

    language: z
      .nativeEnum(Languages, {
        required_error: "Language is required",
        invalid_type_error: "Invalid language",
      })
      .optional(),

    tags: z.array(z.string()).optional(),

    location: z.string().optional(),

    isFake: z
      .preprocess(
        (val) => {
          if (typeof val === "string") {
            return val.toLowerCase() === "true";
          }
          return val;
        },
        z.boolean({
          required_error: "isFake status is required",
          invalid_type_error: "isFake must be a boolean",
        })
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).some((key) => data[key] !== undefined), {
    message: "At least one field must be provided to update.",
    path: [],
  });
  

// Schema for verifying news
export const VerifyNewsSchema = z.object({
  status: z.nativeEnum(NewsStatus, {
    required_error: "Status is required",
    invalid_type_error: "Invalid status"
  })
});

// Schema for getting news by status
export const GetNewsByStatusSchema = z.object({
  status: z.nativeEnum(NewsStatus)
});

// Schema for deleting news
export const DeleteNewsSchema = z.object({
  newsId: z.string({
    required_error: "News ID is required",
    invalid_type_error: "News ID must be a string"
  })
  .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid news ID format" })
});

// Schema for getting news by ID
export const GetNewsByIdSchema = z.object({
  newsId: z.string({
    required_error: "News ID is required",
    invalid_type_error: "News ID must be a string"
  })
  .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid news ID format" })
});

// Schema for getting news by reporter
export const GetNewsByReporterSchema = z.object({
  reporterId: z.string({
    required_error: "Reporter ID is required",
    invalid_type_error: "Reporter ID must be a string"
  })
  .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid reporter ID format" })
});

// Schema for getting news by category
export const GetNewsByCategorySchema = z.object({
  categoryId: z.string({
    required_error: "Category ID is required",
    invalid_type_error: "Category ID must be a string"
  })
  .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid category ID format" })
});

// Schema for publishing news
export const PublishNewsSchema = z.object({
  newsId: z.string({
    required_error: "News ID is required",
    invalid_type_error: "News ID must be a string"
  })
  .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid news ID format" })
});

