import { Schema, model, Document, Types } from 'mongoose';

export interface IProjectCredential extends Document {
  projectId: Types.ObjectId;
  publicKey: string;
  secretHash: string;
  name: string;
  status: 'active' | 'revoked';
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const projectCredentialSchema = new Schema<IProjectCredential>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    publicKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    secretHash: {
      type: String,
      required: true,
      select: false, // Never return secretHash in database queries by default
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Primary Secret Key',
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    lastUsedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.secretHash;
        delete ret.__v;
        if (ret._id) {
          ret.id = ret._id.toString();
          delete ret._id;
        }
        return ret;
      },
    },
  }
);

// Compound index for active credentials per project
projectCredentialSchema.index({ projectId: 1, status: 1 });

export const ProjectCredential = model<IProjectCredential>('ProjectCredential', projectCredentialSchema);
