import { Schema, model } from "mongoose";

const instaSessionProfileSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    instagramUsername: { type: String, required: true, trim: true, lowercase: true },
    instagramFullName: { type: String, required: false, default: null },
    instagramProfilePicUrl: { type: String, required: false, default: null },
    lastLoginAt: { type: Date, required: true, default: Date.now },
    requiresRelogin: { type: Boolean, required: true, default: false },
  },
  {
    versionKey: false,
  },
);

instaSessionProfileSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

export const InstaSessionProfileModel = model("InstaSessionProfile", instaSessionProfileSchema);
