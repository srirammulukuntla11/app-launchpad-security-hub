import { Schema, model, Document } from 'mongoose';

export interface IPlatformUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

const platformUserSchema = new Schema<IPlatformUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Do not return passwordHash in queries by default
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
        return ret;
      },
    },
  }
);

export const PlatformUser = model<IPlatformUser>('PlatformUser', platformUserSchema);
