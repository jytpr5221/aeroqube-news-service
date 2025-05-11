import mongoose, { Document, Schema, Types } from "mongoose";

export enum NewsStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  REJECTED = "rejected",
}

export enum Languages {
  "as" = "Assamese",
  "bn" = "Bengali",
  "bho" = "Bhojpuri",
  "gu" = "Gujarati",
  "hi" = "Hindi",
  "kn" = "Kannada",
  "kok" = "Konkani",
  "mai" = "Maithili",
  "ml" = "Malayalam",
  "mni-Mtei" = "Manipuri",
  "mr" = "Marathi",
  "or" = "Odia",
  "pa" = "Punjabi",
  "sa" = "Sanskrit",
  "sd" = "Sindhi",
  "ta" = "Tamil",
  "te" = "Telugu",
  "ur" = "Urdu",
  "en" = "English",
}

export interface ITranslatedService {
  translatedContent: string;
  title: string;
  audioURL?: string;
  languageCode: Languages;
}

export interface INews extends Document {
  title: string;
  content: string;
  summerizedContent?: string;
  category: Types.ObjectId;
  status: NewsStatus;
  reportedBy?: Types.ObjectId;
  isSystemGenerated: boolean;
  isFake: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  serviceGeneratedAt?: Date;
  source?: string;
  originalURL?: string;
  language: Languages;
  editedBy?: Types.ObjectId;
  publishedBy?: Types.ObjectId;
  imageURL?: string[];
  tags?: string[];
  location?: string;
  translatedServices?: ITranslatedService[];
}

export const NewsSchema = new Schema<INews>({
  title: {
    type: String,
    required: true,
    unique: true,
  },
  content: {
    type: String,
    required: true,
  },
  summerizedContent: {
    type: String,
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(NewsStatus),
    default: NewsStatus.DRAFT,
  },
  reportedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  isSystemGenerated: {
    type: Boolean,
    default: false,
  },
  isFake: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  publishedAt: {
    type: Date,
  },
  serviceGeneratedAt: {
    type: Date,
  },
  source: {
    type: String,
  },
  originalURL: {
    type: String,
  },
  language: {
    type: String,
    enum: Object.values(Languages),
    default: Languages["en"],
  },
  editedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default:null
  },
  publishedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  imageURL: [
    {
      type: String,
    },
  ],
  tags: [
    {
      type: String,
    },
  ],
  location: {
    type: String,
  },

  translatedServices: [
    {
      translatedContent: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      audioURL: {
        type: String,
      },
      languageCode: {
        type: String,
        enum: Object.values(Languages),
        required: true,
      },
    },
  ],
});


NewsSchema.pre<INews>('save',function(next){
    this.updatedAt=new Date()
    next()
})

NewsSchema.pre<INews>('save',function(next){
  if(this.reportedBy!==null && !this.isSystemGenerated) this.isFake=true     //marking all reported news as fake
  next()
})

export const News = mongoose.model<INews>("News", NewsSchema);