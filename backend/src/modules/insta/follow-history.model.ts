import { Schema, model } from "mongoose";

const followHistorySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    username: { type: String, required: true, trim: true, lowercase: true, index: true },
    fullName: { type: String, required: false, default: null },
    profilePicUrl: { type: String, required: false, default: null },
    href: { type: String, required: false, default: null },
    instagramUserId: { type: String, required: false, default: null },
    followedByInstagramUsername: { type: String, required: false, default: null, index: true },
    isPrivate: { type: Boolean, required: false, default: null },
    isVerified: { type: Boolean, required: false, default: null },
    reason: { type: String, required: false, default: null },
    followedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  {
    versionKey: false,
  },
);

followHistorySchema.index({ userId: 1, followedAt: -1 });

export const FollowHistoryModel = model("FollowHistory", followHistorySchema);
