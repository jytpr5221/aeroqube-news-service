import mongoose from "mongoose";

export interface IBlacklistToken {
    token: string;
    createdAt: Date;
}

const blacklistTokenSchema = new mongoose.Schema<IBlacklistToken>({
        token: {
            type: String,
            required: true,
            unique: true
        },
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 60*60*24*15 // 15 days in seconds
        }
    });


export const BlacklistToken = mongoose.model<IBlacklistToken>("BlacklistToken", blacklistTokenSchema);

