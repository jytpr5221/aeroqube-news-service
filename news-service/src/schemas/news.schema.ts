import { z } from 'zod';
import { Languages, NewsStatus } from '@models/news.model';


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
  
    // tags: z.array(z.string()).optional(),
    location: z.string().optional()
  });



// Schema for editing news
export const EditNewsSchema = UploadNewsSchema.extend({
  isFake: z.boolean({
    required_error: "isFake status is required",
    invalid_type_error: "isFake must be a boolean"
  })
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
  status: z.nativeEnum(NewsStatus).optional()
});

// Schema for deleting news
export const DeleteNewsSchema = z.object({
  newsId: z.string({
    required_error: "News ID is required",
    invalid_type_error: "News ID must be a string"
  })
  .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid news ID format" })
});