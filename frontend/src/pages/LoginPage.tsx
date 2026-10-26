import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const { login, error, clearError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!email.trim() || !password) {
      setValidationError('Please enter both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email.trim(), password);
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedError = validationError || error;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-indigo-100 selection:text-indigo-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex p-3.5 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl text-white mb-4 shadow-md shadow-indigo-200">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-[36px] font-extrabold text-slate-900 tracking-tight leading-tight">
          ALSH Platform Sign In
        </h1>
        <p className="mt-2 text-[15px] sm:text-[16px] text-slate-500">
          Sign in to access your App Launchpad &amp; Security Hub dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="p-7 sm:p-9 bg-white shadow-xl border-slate-200/90 rounded-3xl">
          {displayedError && (
            <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-800 text-[14px]">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
              <span className="font-medium">{displayedError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-[15px] font-semibold text-slate-800 mb-2">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (displayedError) clearError();
                  }}
                  placeholder="owner@example.com"
                  className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-[16px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[15px] font-semibold text-slate-800 mb-2">
                Password
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (displayedError) clearError();
                  }}
                  placeholder="••••••••••••"
                  className="block w-full pl-11 pr-11 py-3 bg-white border border-slate-300 rounded-xl text-[16px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                className="w-full py-3 shadow-md shadow-indigo-200"
              >
                Sign In
              </Button>
            </div>
          </form>

          <div className="mt-7 border-t border-slate-100 pt-5 text-center">
            <p className="text-[14px] text-slate-500">
              Don't have an ALSH account?{' '}
              <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                Register as Platform Owner
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
