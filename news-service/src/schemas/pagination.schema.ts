import z from 'zod';

export const PaginationSchema = z.object({

    offset: z.string({
      required_error: "Offset is required",
      invalid_type_error: "Offset must be a string"
    }).refine((val) => !isNaN(Number(val)) || Number(val)<1, {
      message: "Offset is invalid"
    }),
    limit: z.string({
      required_error: "Limit is required",
      invalid_type_error: "Limit must be a string"
    }).refine((val) => !isNaN(Number(val)) || Number(val)<1, {
      message: "Limit is invalid"
    }),
  })