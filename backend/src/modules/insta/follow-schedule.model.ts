import { Schema, model } from "mongoose";

const followScheduleEntrySchema = new Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    quantity: { type: Number, required: true, min: 1, max: 100 },
    /** Preenchido quando a automação desse dia foi disparada e concluiu com sucesso. */
    dispatchedAt: { type: Date, required: false, default: null },
  },
  { _id: false },
);

const followScheduleRunLogSchema = new Schema(
  {
    ranAt: { type: Date, required: true, default: Date.now },
    success: { type: Boolean, required: true },
    message: { type: String, required: false, default: null },
  },
  { _id: false },
);

const followScheduleSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    flowType: { type: String, enum: ["suggested", "followers"], required: true, index: true },
    privacyFilter: { type: String, enum: ["any", "public", "private"], required: true },
    targetUsername: { type: String, required: false, default: null },
    status: { type: String, enum: ["active", "paused", "completed"], required: true, default: "active", index: true },
    keepActive: { type: Boolean, required: true, default: false },
    weeklyDays: [{ type: Number, min: 0, max: 6 }],
    runAtHour: { type: Number, required: true, min: 0, max: 23, default: 10 },
    runAtMinute: { type: Number, required: true, min: 0, max: 59, default: 0 },
    entries: { type: [followScheduleEntrySchema], default: [] },
    oneOffRemainingDates: { type: [String], default: [] },
    nextRunAt: { type: Date, required: false, default: null, index: true },
    lastRunAt: { type: Date, required: false, default: null },
    lastRunStatus: { type: String, required: false, default: null },
    lastRunError: { type: String, required: false, default: null },
    runLogs: { type: [followScheduleRunLogSchema], default: [] },
    /** Última execução bem-sucedida do modo `keepActive` (recorrente). */
    recurrenceLastRunAt: { type: Date, required: false, default: null },
    lockedAt: { type: Date, required: false, default: null, index: true },
    lockOwner: { type: String, required: false, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

followScheduleSchema.index({ userId: 1, sessionId: 1, flowType: 1, status: 1 });
followScheduleSchema.index({ status: 1, nextRunAt: 1 });

export const FollowScheduleModel = model("FollowSchedule", followScheduleSchema);
