import { Request, Response, NextFunction } from 'express';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  archiveProject,
  rotateProjectCredentials,
  revokeProjectCredential,
} from '../services/projectService';

export const handleCreateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const result = await createProject(ownerId, req.body);

    res.status(201).json({
      success: true,
      data: {
        project: result.project,
        credential: result.credential,
        oneTimeSecret: result.oneTimeSecret, // Revealed only once upon creation
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleListProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projects = await listProjects(ownerId);

    res.status(200).json({
      success: true,
      data: {
        projects,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    const result = await getProject(ownerId, projectId);

    res.status(200).json({
      success: true,
      data: {
        project: result.project,
        credentials: result.credentials,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleUpdateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    const project = await updateProject(ownerId, projectId, req.body);

    res.status(200).json({
      success: true,
      data: {
        project,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleArchiveProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    await archiveProject(ownerId, projectId);

    res.status(200).json({
      success: true,
      message: 'Project archived successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const handleRotateCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);

    const result = await rotateProjectCredentials(ownerId, projectId, req.body?.name);

    res.status(200).json({
      success: true,
      data: {
        credential: result.credential,
        oneTimeSecret: result.oneTimeSecret, // Revealed only once upon rotation
      },
    });
  } catch (error) {
    next(error);
  }
};

export const handleRevokeCredential = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ownerId = req.platformUser!._id;
    const projectId = String(req.params.projectId);
    const { credentialId } = req.body;

    const credential = await revokeProjectCredential(ownerId, projectId, credentialId);

    res.status(200).json({
      success: true,
      message: 'Credential revoked successfully.',
      data: {
        credential,
      },
    });
  } catch (error) {
    next(error);
  }
};
