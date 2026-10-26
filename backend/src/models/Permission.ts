import { Schema, model, Document, Types } from 'mongoose';

export interface IPermission extends Document {
  projectId?: Types.ObjectId;
  key: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
      default: null,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 255,
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
        if (ret.projectId) {
          ret.projectId = ret.projectId.toString();
        }
        return ret;
      },
    },
  }
);

// Unique permission key per project scope (null projectId represents standard catalog)
permissionSchema.index({ projectId: 1, key: 1 }, { unique: true });

export const Permission = model<IPermission>('Permission', permissionSchema);
