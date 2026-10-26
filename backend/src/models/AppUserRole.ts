import { Schema, model, Document, Types } from 'mongoose';

export interface IAppUserRole extends Document {
  projectId: Types.ObjectId;
  appUserId: Types.ObjectId;
  roleId: Types.ObjectId;
  assignedAt: Date;
}

const appUserRoleSchema = new Schema<IAppUserRole>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    appUserId: {
      type: Schema.Types.ObjectId,
      ref: 'AppUser',
      required: true,
      index: true,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (_doc, ret: Record<string, any>) => {
        delete ret.__v;
        if (ret._id) {
          ret.id = ret._id.toString();
          delete ret._id;
        }
        if (ret.projectId) ret.projectId = ret.projectId.toString();
        if (ret.appUserId) ret.appUserId = ret.appUserId.toString();
        if (ret.roleId) ret.roleId = ret.roleId.toString();
        return ret;
      },
    },
  }
);

// Compound unique index: a user can only be assigned a specific role once per project
appUserRoleSchema.index({ projectId: 1, appUserId: 1, roleId: 1 }, { unique: true });
appUserRoleSchema.index({ projectId: 1, appUserId: 1 });

export const AppUserRole = model<IAppUserRole>('AppUserRole', appUserRoleSchema);
