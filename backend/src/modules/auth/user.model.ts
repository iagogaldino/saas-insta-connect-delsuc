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
    /** Legado (sessão única); migrado para instaSessionIds ao ler o usuário. */
    instaSessionId: { type: String, required: false },
    /** Legado; migrado para ordem em instaSessionIds. */
    activeInstaSessionId: { type: String, required: false },
    /** Sessões cujo Chromium estava ligado na última vez; reabertas automaticamente após restart do servidor. */
    instaRestoreRuntimeSessionIds: {
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
