import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, LogOut, User, FolderKanban, LayoutDashboard } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: FolderKanban },
  ];

  return (
    <header className="bg-white/95 border-b border-slate-200/90 sticky top-0 z-40 backdrop-blur-md shadow-xs">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Main Nav */}
        <div className="flex items-center space-x-6 sm:space-x-8">
          <Link to="/dashboard" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-all duration-150">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">ALSH</span>
              <span className="text-[12px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Security Hub
              </span>
            </div>
          </Link>

          {user && (
            <nav className="flex items-center space-x-1 pl-4 sm:pl-6 border-l border-slate-200">
              {navLinks.map((link) => {
                const isActive =
                  location.pathname === link.path ||
                  (link.path === '/projects' && location.pathname.startsWith('/projects'));
                const IconComponent = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-[15px] font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* User Identity & Logout */}
        {user && (
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-[14px]">
              <div className="w-5 h-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                <User className="w-3 h-3" />
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="font-semibold text-slate-800">{user.name}</span>
                <span className="text-[13px] text-slate-500 max-w-[180px] truncate">({user.email})</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign out of ALSH"
              className="inline-flex items-center space-x-1.5 text-[14px] font-medium text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-rose-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-400 hover:text-rose-600" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
