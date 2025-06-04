import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID format");

export const getCategoryNewsSchema = z.object({
  categoryId: objectId,
});

export const getNewsByIdSchema = z.object({
  newsId: objectId,
});

export const getNewsByTagSchema = z.object({
  tag: z.string(),
});

export const getNewsBySearchSchema = z.object({
  q: z.string().min(1, "Search query cannot be empty")
});

export const getNewsByReporterSchema = z.object({
  reporterId: objectId,
});

export const getNewsBySourceSchema = z.object({
  source: z.string(),
});
