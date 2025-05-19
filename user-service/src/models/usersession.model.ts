import { Schema, model, Types } from "mongoose";

export interface IUserSession {
  userId: Schema.Types.ObjectId;
  loginTime?: Date;
  logoutTime?: Date;
  isLoggedIn: boolean;
  platform: string;
  ip: string;
  createdOn: Date;
}

const UserSessionsSchema = new Schema<IUserSession>({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  loginTime: { type: Date },
  logoutTime: { type: Date },
  isLoggedIn: { type: Boolean, default: true,required:true },
  platform: { type: String },
  ip: { type: String, required: true,unique:true },
  createdOn: { type: Date, default: Date.now },
});
// we can add FCM token from client if user allows notification


export const UserSession = model<IUserSession>(
  "UserSession",
  UserSessionsSchema
);
