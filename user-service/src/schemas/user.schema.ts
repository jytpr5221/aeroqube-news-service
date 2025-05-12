import {z} from 'zod';

export const RegisterUserSchmea = z.object({

    name:z.string({
        required_error:"Name is required",
        invalid_type_error:"Name must be a string"
    })
    .trim()
    .min(2,{message:"Name must be atleast 1 character long"})
    .max(50,{message:"Name must be atmost 50 characters long"})
    .regex(/^[A-Za-z\s-]+$/, {message: "Name must contain only letters, spaces, or hyphens"}),
     
    email:z.string({
        required_error:"Email is required",
        invalid_type_error:"Email must be a string"
    })
    .email({message:'Email is not valid'}),

    password:z.string({
        required_error:"Password is required",
        invalid_type_error:"Password must be a string"
    })
    .trim()
    .min(6,{message:"Password must be atleast 6 characters long"}),

    contact:z.string().trim().regex(/^[0-9]{10}$/, {message: "Contact number must be 10 digits"}).optional(),
})


export const LoginUserSchema = z.object({

    email:z.string({
        required_error:"Email is required",
        invalid_type_error:"Email must be a string"
    })
    .email({message:'Email is not valid'}),

    password:z.string({
        required_error:"Password is required",
        invalid_type_error:"Password must be a string"
    })
    .trim()
    .min(6,{message:"Password must be atleast 6 characters long"})
})

export const verifyUserSchema = z.object({
    token:z.string({
        required_error:'Token is required!',
        invalid_type_error:'Token should be a string'
    })
})


export const GetUserByIdSchema = z.object({
    userId:z.string({
        required_error:"UserId is required",
        invalid_type_error:"UserId must be a string"
    })
})


export const GetUserByQuerySchema = z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    })
    .refine((data) => data.name || data.email, {
    message: "Either name or email is required",
    path:[]
})


export const UpdateUserSchema = z.object({

    name:z.string({
        required_error:"Name is required",
        invalid_type_error:"Name must be a string"
    })
    .trim()
    .min(2,{message:"Name must be atleast 1 character long"})
    .max(50,{message:"Name must be atmost 50 characters long"})
    .regex(/^[A-Za-z\s-]+$/, {message: "Name must contain only letters, spaces, or hyphens"})
    .optional(),

    email:z.string({
        required_error:"Email is required",
        invalid_type_error:"Email must be a string"
    })
    .email({message:'Email is not valid'}).optional(),

    newpassword:z.string({
        required_error:"Password is required",
        invalid_type_error:"Password must be a string"
    })
    .trim()
    .min(6,{message:"Password must be atleast 6 characters long"}).optional(),

    currentpassword:z.string({
        required_error:"Password is required",
        invalid_type_error:"Password must be a string"
    }) 
    .trim()
    .min(6,{message:"Password must be atleast 6 characters long"}).optional(),

    contact:z.string().trim().regex(/^[0-9]{10}$/, {message: "Contact number must be 10 digits"}).optional(),
}).refine(
    (data) =>
      data.name ||
      data.email ||
      (data.newpassword && data.currentpassword) ||
      data.contact,
    {
      message: "At least one field must be provided for update",
      path: [], 
    }
  );