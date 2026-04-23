import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    instaSessionIds: {
      type: [String],
      required: false,
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: { toString(): string } };

export const UserModel = model("User", userSchema);
