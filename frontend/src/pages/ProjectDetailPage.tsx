import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import {
  Project,
  ProjectCredential,
  ProjectDetailResponse,
  RotateCredentialResponse,
} from '../types/project';
import OneTimeSecretModal from '../components/credentials/OneTimeSecretModal';
import {
  ArrowLeft,
  Key,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Shield,
  Layers,
  Code2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [credentials, setCredentials] = useState<ProjectCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rotation & Revocation action state
  const [isRotating, setIsRotating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Archiving project state
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

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

  const fetchProjectData = async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get<ProjectDetailResponse>(`/projects/${projectId}`);
      setProject(res.data.data.project);
      setCredentials(res.data.data.credentials);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load project details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  const handleCopyPublicKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopySnippet = (snippetText: string) => {
    navigator.clipboard.writeText(snippetText);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleRotateCredentials = async () => {
    if (!projectId) return;
    try {
      setIsRotating(true);
      const res = await api.post<RotateCredentialResponse>(
        `/projects/${projectId}/credentials/rotate`,
        { name: 'Rotated Primary Secret' }
      );

      // Open one-time secret modal with new secret
      setSecretModalData({
        isOpen: true,
        title: 'Credentials Successfully Rotated',
        publicKey: res.data.data.credential.publicKey,
        secret: res.data.data.oneTimeSecret,
      });

      // Refresh credentials list
      await fetchProjectData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to rotate credentials.');
    } finally {
      setIsRotating(false);
    }
  };

  const handleRevokeCredential = async (credentialId: string) => {
    if (!projectId) return;
    const confirmRevoke = window.confirm(
      'Are you sure you want to revoke this credential? Any backend service using this key will immediately be denied access.'
    );
    if (!confirmRevoke) return;

    try {
      setRevokingId(credentialId);
      await api.post(`/projects/${projectId}/credentials/revoke`, { credentialId });
      await fetchProjectData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to revoke credential.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleArchiveProject = async () => {
    if (!projectId) return;
    try {
      setIsArchiving(true);
      await api.delete(`/projects/${projectId}`);
      navigate('/projects');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to archive project.');
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-28 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-[15px] font-medium text-slate-600">Loading project settings &amp; credentials...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="space-y-5">
        <Link
          to="/projects"
          className="inline-flex items-center space-x-2 text-[15px] font-medium text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 text-[15px]">
          {error || 'Project not found.'}
        </div>
      </div>
    );
  }

  const activeKey = credentials.find((c) => c.status === 'active')?.publicKey || 'YOUR_PUBLIC_KEY';
  const quickstartSnippet = `curl -X POST https://api.alsh.dev/api/v1/auth/${activeKey}/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'`;

  return (
    <div className="space-y-9">
      {/* Top Breadcrumb & Title Header */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center space-x-1.5 text-[15px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-3.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Projects</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3.5">
              <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight leading-tight">
                {project.name}
              </h1>
              <Badge
                variant={
                  project.environment === 'production'
                    ? 'success'
                    : project.environment === 'staging'
                    ? 'warning'
                    : 'brand'
                }
                size="md"
              >
                {project.environment}
              </Badge>
            </div>
            <p className="text-[14px] text-slate-500 font-mono">project slug: {project.slug}</p>
          </div>

          <div className="flex items-center space-x-2 text-[13px] font-semibold text-slate-600 font-mono bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs self-start sm:self-auto">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>ID: {project.id}</span>
          </div>
        </div>
      </div>

      {/* Overview & Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2.5">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>Configuration &amp; Environment Scope</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[15px]">
            <div>
              <span className="block font-semibold text-slate-800 mb-1.5">Description</span>
              <p className="text-slate-600 leading-relaxed">
                {project.description || 'No description provided.'}
              </p>
            </div>

            <div>
              <span className="block font-semibold text-slate-800 mb-1.5">Allowed Origins (CORS)</span>
              {project.allowedOrigins && project.allowedOrigins.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {project.allowedOrigins.map((origin, idx) => (
                    <span
                      key={idx}
                      className="font-mono text-[13px] text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200/80 inline-block font-medium"
                    >
                      {origin}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">No domain origin restrictions configured (open development mode).</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credentials Hub Section */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <CardTitle className="flex items-center space-x-2.5">
              <Key className="w-5 h-5 text-indigo-600" />
              <span>Project API Credentials</span>
            </CardTitle>
            <p className="text-[15px] text-slate-500 mt-1">
              Public identifiers and server credentials for client and server-side integrations.
            </p>
          </div>

          <Button
            onClick={handleRotateCredentials}
            isLoading={isRotating}
            variant="primary"
            size="md"
            icon={<RefreshCw className="w-4 h-4" />}
            className="shadow-sm shadow-indigo-200"
          >
            Rotate Credentials
          </Button>
        </CardHeader>

        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 uppercase tracking-wider text-[13px]">
                  <th className="px-6 sm:px-7 py-3.5 font-semibold">Key Name</th>
                  <th className="px-6 sm:px-7 py-3.5 font-semibold">Public Client Identifier</th>
                  <th className="px-6 sm:px-7 py-3.5 font-semibold">Status</th>
                  <th className="px-6 sm:px-7 py-3.5 font-semibold">Created</th>
                  <th className="px-6 sm:px-7 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {credentials.map((cred) => (
                  <tr key={cred.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 sm:px-7 py-4 font-semibold text-slate-900">{cred.name}</td>
                    <td className="px-6 sm:px-7 py-4 font-mono text-indigo-700 font-medium select-all">
                      <div className="flex items-center space-x-2">
                        <span>{cred.publicKey}</span>
                        <button
                          onClick={() => handleCopyPublicKey(cred.publicKey)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer p-1 rounded-md hover:bg-slate-100"
                          title="Copy Public Key"
                        >
                          {copiedKey === cred.publicKey ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 sm:px-7 py-4">
                      <Badge
                        variant={cred.status === 'active' ? 'success' : 'danger'}
                        size="md"
                        dot
                      >
                        {cred.status}
                      </Badge>
                    </td>
                    <td className="px-6 sm:px-7 py-4 text-slate-500 text-[14px]">
                      {new Date(cred.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 sm:px-7 py-4 text-right">
                      {cred.status === 'active' ? (
                        <button
                          onClick={() => handleRevokeCredential(cred.id)}
                          disabled={revokingId === cred.id}
                          className="text-rose-700 hover:text-rose-800 text-[13px] font-semibold px-3 py-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                        >
                          {revokingId === cred.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[13px]">Revoked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Developer Integration Quickstart */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center space-x-2.5">
              <Code2 className="w-5 h-5 text-indigo-600" />
              <span>Developer Integration Quickstart</span>
            </CardTitle>
            <p className="text-[15px] text-slate-500 mt-1">
              Call this endpoint from your application to authenticate project end-users:
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => handleCopySnippet(quickstartSnippet)}
            icon={copiedSnippet ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          >
            {copiedSnippet ? 'Copied' : 'Copy cURL'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 font-mono text-[14px] text-slate-100 overflow-x-auto space-y-2.5 shadow-sm">
            <p className="text-slate-400">// Register or login an end-user with your project's public key:</p>
            <p className="text-indigo-400 font-semibold">
              POST /api/v1/auth/{activeKey}/register
            </p>
            <p className="text-slate-300">
              Header: Content-Type: application/json
            </p>
            <p className="text-slate-300">
              Body: &#123; "email": "user@example.com", "password": "SecurePassword123!" &#125;
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone: Archiving */}
      <div className="bg-rose-50/70 border border-rose-200 rounded-3xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <h3 className="text-[19px] font-bold text-rose-900 flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Archive Project</span>
            </h3>
            <p className="text-[15px] text-slate-600 mt-1 max-w-xl leading-relaxed">
              Archiving disables all public and private credentials for this project. Historical audit logs will be permanently preserved.
            </p>
          </div>

          <Button
            variant="destructive"
            size="md"
            onClick={() => setIsArchiveConfirmOpen(true)}
            icon={<Trash2 className="w-4 h-4" />}
            className="self-start sm:self-auto shadow-sm"
          >
            Archive Project
          </Button>
        </div>
      </div>

      {/* Confirmation Modal for Archiving */}
      {isArchiveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-rose-200 rounded-3xl max-w-md w-full p-7 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-[20px] font-bold text-slate-900">Confirm Project Archival</h3>
            </div>
            <p className="text-[15px] text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to archive <strong>{project.name}</strong>? All associated credentials will be immediately revoked.
            </p>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsArchiveConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="md"
                onClick={handleArchiveProject}
                isLoading={isArchiving}
              >
                Yes, Archive Project
              </Button>
            </div>
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

export default ProjectDetailPage;
