import z from 'zod';

export const PaginationSchema = z.object({

    offset: z.string().refine((val) => !isNaN(Number(val)) || Number(val)<1, {
      message: "Offset is invalid"
    }),
    limit: z.string().refine((val) => !isNaN(Number(val)) || Number(val)<1, {
      message: "Limit is invalid"
    }),
  })