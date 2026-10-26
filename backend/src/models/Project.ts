import { Schema, model, Document, Types } from 'mongoose';

export interface IProject extends Document {
  ownerId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  environment: 'development' | 'staging' | 'production';
  allowedOrigins: string[];
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformUser',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development',
      required: true,
    },
    allowedOrigins: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
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

// Compound index for fast queries of owner's active projects
projectSchema.index({ ownerId: 1, status: 1 });

export const Project = model<IProject>('Project', projectSchema);
