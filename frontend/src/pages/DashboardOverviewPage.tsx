import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Layers,
  FileText,
  Users,
  ArrowRight,
  Database,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const DashboardOverviewPage: React.FC = () => {
  const { user } = useAuth();

  const securityGuarantees = [
    {
      title: 'In-Memory Access Tokens',
      description:
        'Short-lived 15m JWTs stored exclusively in client memory. Completely zero persistence in localStorage or sessionStorage.',
      icon: KeyRound,
      badge: 'Zero Storage',
      bgTint: 'bg-indigo-50 border-indigo-100 text-indigo-600',
      badgeVariant: 'brand' as const,
    },
    {
      title: 'HttpOnly Refresh Cookies',
      description:
        'Secure, SameSite refresh cookies with rotation on every cycle. Completely protected against client-side script interception.',
      icon: Lock,
      badge: 'Protected Cookie',
      bgTint: 'bg-teal-50 border-teal-100 text-teal-600',
      badgeVariant: 'teal' as const,
    },
    {
      title: 'Token-Family Reuse Detection',
      description:
        'If an expired or rotated refresh token is replayed, the entire session family lineage is immediately revoked in MongoDB.',
      icon: ShieldCheck,
      badge: 'Lineage Revocation',
      bgTint: 'bg-emerald-50 border-emerald-100 text-emerald-600',
      badgeVariant: 'success' as const,
    },
  ];

  const platformCapabilities = [
    {
      title: 'Project Isolation & Multi-Tenancy',
      description:
        'Strict owner authorization and cryptographically unique public key pairs per application workspace.',
      icon: Layers,
      bgTint: 'bg-purple-50 text-purple-600 border-purple-100',
      status: 'Live & Operational',
    },
    {
      title: 'App-User Authentication Engine',
      description:
        'End-user registration and logins isolated per project with Argon2id password hashing and scoped uniqueness.',
      icon: Users,
      bgTint: 'bg-blue-50 text-blue-600 border-blue-100',
      status: 'Live & Operational',
    },
    {
      title: 'Granular Role-Based Access Control',
      description:
        'Project-scoped role definitions, custom permissions, and middleware guard enforcement.',
      icon: Lock,
      bgTint: 'bg-amber-50 text-amber-600 border-amber-100',
      status: 'Live & Operational',
    },
    {
      title: 'Tamper-Evident Security Audit Stream',
      description:
        'Centralized append-only audit trail logging security events, actor IDs, project scopes, and IP addresses.',
      icon: FileText,
      bgTint: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      status: 'Live & Operational',
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-9">
      {/* Welcome Banner - Clean, Compact & Properly Aligned */}
      <div className="rounded-2xl border border-indigo-100/90 bg-gradient-to-br from-indigo-50/75 via-violet-50/45 to-sky-50/60 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Welcome back, {user?.name || 'Alex'}
            </h1>
            <p className="text-[15px] sm:text-[16px] text-slate-600 leading-relaxed">
              Manage your projects, team access, and account settings from one simple dashboard.
            </p>
          </div>

          <div className="flex items-center self-start sm:self-center flex-shrink-0">
            <Link to="/projects">
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight className="w-4 h-4 ml-1 order-last" />}
                className="shadow-sm shadow-indigo-200/80 px-5 py-2.5"
              >
                Go to Projects
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Security Architecture Guarantees - Balanced 3-column Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-[22px] sm:text-[24px] font-bold text-slate-900 tracking-tight">
            Cryptographic Token Architecture
          </h2>
          <p className="text-[14px] sm:text-[15px] text-slate-500 mt-0.5">
            Strict memory boundaries and HttpOnly cookie rotation protecting all platform sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {securityGuarantees.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="hover:border-indigo-200/80 transition-all flex flex-col justify-between">
                <CardContent className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl border ${item.bgTint}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <Badge variant={item.badgeVariant} size="sm">
                      {item.badge}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-[18px] sm:text-[19px] font-semibold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[14px] text-slate-600 mt-1.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Platform Capabilities - Balanced 4-column Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-[22px] sm:text-[24px] font-bold text-slate-900 tracking-tight">
            Security Engine Status &amp; Modules
          </h2>
          <p className="text-[14px] sm:text-[15px] text-slate-500 mt-0.5">
            Core security subsystems verified and running against the active cluster.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {platformCapabilities.map((mod) => {
            const ModIcon = mod.icon;
            return (
              <Card key={mod.title} className="hover:border-indigo-200/80 transition-all flex flex-col justify-between">
                <CardContent className="space-y-3 pb-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl border ${mod.bgTint}`}>
                      <ModIcon className="w-4 h-4" />
                    </div>
                    <Badge variant="success" size="sm" dot>
                      Active
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-[17px] sm:text-[18px] font-semibold text-slate-900 leading-snug">
                      {mod.title}
                    </h3>
                    <p className="text-[13.5px] text-slate-600 mt-1.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </CardContent>
                <div className="px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl text-[13px] font-medium text-slate-600 flex items-center justify-between">
                  <span>{mod.status}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Access Resource Panel */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 flex-shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-[17px] sm:text-[18px] font-semibold text-slate-900">
                Developer Integration &amp; Documentation
              </h4>
              <p className="text-[14px] text-slate-500 mt-0.5">
                Explore project management, one-time secret reveals, and RBAC authentication headers.
              </p>
            </div>
          </div>
          <Link to="/projects" className="flex-shrink-0">
            <Button variant="secondary" size="sm" icon={<ExternalLink className="w-4 h-4" />}>
              Open Projects Hub
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverviewPage;
