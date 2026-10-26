import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Project, ProjectListResponse, CreateProjectResponse } from '../types/project';
import OneTimeSecretModal from '../components/credentials/OneTimeSecretModal';
import {
  FolderGit2,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
  Shield,
  X,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Project Creation Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('development');
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // One-time secret reveal modal
  const [secretModalData, setSecretModalData] = useState<{
    isOpen: boolean;
    title: string;
    publicKey: string;
    secret: string;
  }>({
    isOpen: false,
    title: '',
    publicKey: '',
    secret: '',
  });

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get<ProjectListResponse>('/projects');
      setProjects(res.data.data.projects);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load projects.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSlugAutoFill = (val: string) => {
    setName(val);
    const generated = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generated);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !slug.trim()) {
      setFormError('Project name and slug are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const origins = allowedOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await api.post<CreateProjectResponse>('/projects', {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        environment,
        allowedOrigins: origins,
      });

      setIsCreateOpen(false);
      setName('');
      setSlug('');
      setDescription('');
      setAllowedOrigins('');

      setSecretModalData({
        isOpen: true,
        title: `Project "${res.data.data.project.name}" Created`,
        publicKey: res.data.data.credential.publicKey,
        secret: res.data.data.oneTimeSecret,
      });

      await fetchProjects();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEnvBadgeVariant = (env: string) => {
    if (env === 'production') return 'success';
    if (env === 'staging') return 'warning';
    return 'brand';
  };

  return (
    <div className="space-y-8">
      {/* Header & Launch Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <h1 className="text-3xl sm:text-[34px] font-bold text-slate-900 tracking-tight leading-tight">
            Registered Projects
          </h1>
          <p className="text-[15px] sm:text-[16px] text-slate-500 mt-1.5">
            Manage your registered applications, public client keys, and isolated security perimeters.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          icon={<Plus className="w-5 h-5" />}
          size="lg"
          className="self-start sm:self-auto shadow-md shadow-indigo-200"
        >
          New Project
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center space-x-3 text-rose-800 text-[15px]">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-28 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-[15px] font-medium text-slate-600">Loading registered projects...</p>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-14 text-center shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderGit2 className="w-7 h-7" />
          </div>
          <h3 className="text-[22px] font-bold text-slate-900 mb-1.5">No Projects Registered</h3>
          <p className="text-[15px] text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
            Get started by registering your first application. ALSH will generate dedicated public keys and server secrets.
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            icon={<Plus className="w-5 h-5" />}
            size="lg"
            className="shadow-sm shadow-indigo-200"
          >
            Create Your First Project
          </Button>
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group block"
            >
              <Card className="h-full hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant={getEnvBadgeVariant(project.environment)} size="md">
                      {project.environment}
                    </Badge>
                    <span className="text-[14px] text-slate-500 group-hover:text-indigo-600 flex items-center space-x-1 transition-colors font-semibold">
                      <span>Manage</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>

                  <div>
                    <h3 className="text-[21px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-[15px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {project.description || 'No description provided.'}
                    </p>
                  </div>
                </CardContent>

                <div className="px-6 sm:px-7 py-3.5 border-t border-slate-100 bg-slate-50/80 rounded-b-2xl flex items-center justify-between text-[13px] text-slate-500 font-mono">
                  <span className="font-medium text-slate-600">slug: {project.slug}</span>
                  <span className="text-slate-600 flex items-center space-x-1 font-sans text-[13px] font-medium">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Isolated</span>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-7 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-[22px] font-bold text-slate-900 tracking-tight">Register New Project</h3>
            <p className="text-[15px] text-slate-500 mt-1 mb-6">
              Provision an isolated authentication and authorization scope
            </p>

            {formError && (
              <div className="mb-5 bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center space-x-2 text-rose-800 text-[14px]">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-5">
              <div>
                <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleSlugAutoFill(e.target.value)}
                  placeholder="Billing Portal"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-[16px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                  Project Slug (URL Safe)
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="billing-portal"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-[15px] font-mono text-indigo-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                    Environment
                  </label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-[15px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                    Allowed Origins (optional)
                  </label>
                  <input
                    type="text"
                    value={allowedOrigins}
                    onChange={(e) => setAllowedOrigins(e.target.value)}
                    placeholder="https://app.example.com"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-[15px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Customer identity management service..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-[15px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                >
                  Register Project
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Secret Modal */}
      <OneTimeSecretModal
        isOpen={secretModalData.isOpen}
        onClose={() => setSecretModalData((prev) => ({ ...prev, isOpen: false }))}
        title={secretModalData.title}
        publicKey={secretModalData.publicKey}
        secret={secretModalData.secret}
      />
    </div>
  );
};

export default ProjectsPage;
