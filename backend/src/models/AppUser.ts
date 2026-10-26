import { Schema, model, Document, Types } from 'mongoose';

export interface IAppUser extends Document {
  projectId: Types.ObjectId;
  email: string;
  passwordHash: string;
  profile: {
    name?: string;
    metadata?: Record<string, any>;
  };
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

const appUserSchema = new Schema<IAppUser>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never return passwordHash in queries by default
    },
    profile: {
      name: {
        type: String,
        trim: true,
        default: '',
      },
      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.passwordHash;
        delete ret.__v;
        if (ret._id) {
          ret.id = ret._id.toString();
          delete ret._id;
        }
        if (ret.projectId) {
          ret.projectId = ret.projectId.toString();
        }
        return ret;
      },
    },
  }
);

// Compound unique index: email is unique WITHIN a project, enabling the same email across multiple projects
appUserSchema.index({ projectId: 1, email: 1 }, { unique: true });
appUserSchema.index({ projectId: 1, status: 1 });

export const AppUser = model<IAppUser>('AppUser', appUserSchema);
