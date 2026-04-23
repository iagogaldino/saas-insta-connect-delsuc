import { Schema, model } from "mongoose";

const instaSessionProfileSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    instagramUsername: { type: String, required: true, trim: true, lowercase: true },
    lastLoginAt: { type: Date, required: true, default: Date.now },
  },
  {
    versionKey: false,
  },
);

instaSessionProfileSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

export const InstaSessionProfileModel = model("InstaSessionProfile", instaSessionProfileSchema);
