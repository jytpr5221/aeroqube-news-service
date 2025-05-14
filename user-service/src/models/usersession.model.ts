import { Schema, model, Types } from "mongoose";

export interface IUserSession {
  userId: Schema.Types.ObjectId;
  loginTime?: number;
  logoutTime?: number;
  isLogIn: boolean;
  platform: string;
  ip: number;
  createdOn: Date;
}

const UserSessionsSchema = new Schema<IUserSession>({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  loginTime: { type: Number },
  logoutTime: { type: Number },
  isLogIn: { type: Boolean, default: true,required:true },
  platform: { type: String },
  ip: { type: Number, required: true },
  createdOn: { type: Date, default: Date.now },
});


export const UserSession = model<IUserSession>(
  "UserSession",
  UserSessionsSchema
);
