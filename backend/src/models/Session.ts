import { Schema, model, Document, Types } from 'mongoose';

export interface ISession extends Document {
  tokenHash: string;
  tokenFamily: string;
  userType: 'platform' | 'app';
  userId: Types.ObjectId;
  projectId?: Types.ObjectId;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  rotatedAt?: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenFamily: {
      type: String,
      required: true,
      index: true,
    },
    userType: {
      type: String,
      enum: ['platform', 'app'],
      default: 'platform',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'userTypeModel',
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
    },
    rotatedAt: {
      type: Date,
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index for automatic storage cleanup after token expiry
// Note: Application logic strictly verifies expiresAt and isRevoked in real-time.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<ISession>('Session', sessionSchema);
