import mongoose, { Schema } from "mongoose";
import { reference, textField } from "../../../shared/database/fields.js";
import { NOTIFICATION_RESOURCES, NOTIFICATION_TYPES } from "../notification.constants.js";

const notificationSchema = new Schema({
  userId: reference("User"),
  type: { type: String, enum: NOTIFICATION_TYPES, required: true },
  title: textField(200, true),
  message: textField(2000, true),
  resourceType: { type: String, enum: NOTIFICATION_RESOURCES },
  resourceId: { type: Schema.Types.ObjectId },
  isRead: { type: Boolean, required: true, default: false },
  readAt: { type: Date },
  sourceAuditId: { type: Schema.Types.ObjectId },
  eventKey: { ...textField(80), immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: "throw", collection: "notifications" });

notificationSchema.pre("validate", function () {
  if (Boolean(this.resourceType) !== Boolean(this.resourceId)) {
    this.invalidate("resourceId", "resourceType and resourceId must be supplied together");
  }
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
// Sparse so older rows without an event key remain valid. Live Atlas must not receive this index without owner approval.
notificationSchema.index({ eventKey: 1 }, { unique: true, sparse: true });

export type NotificationDocument = mongoose.InferSchemaType<typeof notificationSchema> & { _id: mongoose.Types.ObjectId };
export const Notification = (mongoose.models.Notification as mongoose.Model<NotificationDocument> | undefined) ?? mongoose.model<NotificationDocument>("Notification", notificationSchema);
