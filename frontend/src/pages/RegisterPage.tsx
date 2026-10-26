import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, User, AlertCircle, Check, Eye, EyeOff } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const RegisterPage: React.FC = () => {
  const { register, error, clearError, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!name.trim() || !email.trim() || !password) {
      setValidationError('Please fill in all required fields.');
      return;
    }

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber) {
      setValidationError('Password does not satisfy all complexity requirements.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register(name.trim(), email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Handled by AuthContext
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
          Register Platform Account
        </h1>
        <p className="mt-2 text-[15px] sm:text-[16px] text-slate-500">
          Create your platform owner account to launch projects and configure security
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
              <label htmlFor="name" className="block text-[15px] font-semibold text-slate-800 mb-2">
                Full Name
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (displayedError) clearError();
                  }}
                  placeholder="Alex Mercer"
                  className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-[16px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-[15px] font-semibold text-slate-800 mb-2">
                Work Email Address
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
                  placeholder="alex@company.com"
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
                  autoComplete="new-password"
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

              {/* Password complexity checklist */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 text-[14px]">
                <div className={`flex items-center space-x-2 ${hasMinLength ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                  <Check className="w-4 h-4" />
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center space-x-2 ${hasUpper ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                  <Check className="w-4 h-4" />
                  <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center space-x-2 ${hasLower ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                  <Check className="w-4 h-4" />
                  <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center space-x-2 ${hasNumber ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                  <Check className="w-4 h-4" />
                  <span>Number</span>
                </div>
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
                Register Account
              </Button>
            </div>
          </form>

          <div className="mt-7 border-t border-slate-100 pt-5 text-center">
            <p className="text-[14px] text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
