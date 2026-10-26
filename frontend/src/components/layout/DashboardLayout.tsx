import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-5 sm:px-6 lg:px-8 py-7 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200/80 bg-white py-5 text-center text-[14px] text-slate-500">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">ALSH</span>
            <span>&bull;</span>
            <span className="text-slate-600">Enterprise Application Launchpad &amp; Security Hub</span>
          </div>
          <div className="text-[13px] text-slate-500 font-medium">
            RBAC &bull; HttpOnly Cookie Auth &bull; Isolated Tenant Scopes
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
