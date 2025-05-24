import z from 'zod'

export const CreateCategorySchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    parent: z.string().optional()
})

export const UpdateCategorySchema = z.object({
    categoryId: z.string().trim().min(1, "Category ID is required"),
    name: z.string().trim().min(1, "Name is required"),
})

export const DeleteCategorySchema = z.object({
    categoryId: z.string().trim().min(1, "Category ID is required"),
})

export const GetCategoriesSchema = z.object({
    categoryId: z.string().trim().min(1, "Category ID is required"),
})