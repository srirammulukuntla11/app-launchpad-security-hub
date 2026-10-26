import { Schema, model, Document, Types } from 'mongoose';

export type AuditActorType = 'platform' | 'app' | 'system';
export type AuditOutcome = 'success' | 'failure';

export interface IAuditLog extends Document {
  projectId?: Types.ObjectId;
  actorType: AuditActorType;
  actorId?: Types.ObjectId | string;
  actorEmail?: string;
  eventType: string;
  action: string;
  outcome: AuditOutcome;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
      default: null,
    },
    actorType: {
      type: String,
      enum: ['platform', 'app', 'system'],
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.Mixed,
      default: null,
      index: true,
    },
    actorEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    outcome: {
      type: String,
      enum: ['success', 'failure'],
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    bufferCommands: false,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        if (ret._id) {
          ret.id = ret._id.toString();
          delete ret._id;
        }
        if (ret.projectId) {
          ret.projectId = ret.projectId.toString();
        }
        if (ret.actorId && typeof ret.actorId === 'object' && ret.actorId.toString) {
          ret.actorId = ret.actorId.toString();
        }
        return ret;
      },
    },
  }
);

// Compound indexes for performant querying and filtering
auditLogSchema.index({ projectId: 1, timestamp: -1 });
auditLogSchema.index({ projectId: 1, eventType: 1, timestamp: -1 });
auditLogSchema.index({ projectId: 1, outcome: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
