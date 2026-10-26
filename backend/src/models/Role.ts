import { Schema, model, Document, Types } from 'mongoose';

export interface IRole extends Document {
  projectId: Types.ObjectId;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 255,
    },
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
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

// Unique role name per project
roleSchema.index({ projectId: 1, name: 1 }, { unique: true });

export const Role = model<IRole>('Role', roleSchema);
