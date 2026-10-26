import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center selection:bg-indigo-100 selection:text-indigo-900">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl text-amber-600 mb-5 shadow-xs">
        <AlertTriangle className="w-10 h-10" />
      </div>
      <h1 className="text-3xl sm:text-[36px] font-extrabold text-slate-900 tracking-tight leading-tight">
        404 — Page Not Found
      </h1>
      <p className="mt-2.5 text-[15px] sm:text-[16px] text-slate-500 max-w-md leading-relaxed">
        The requested URL does not exist or has been relocated to another workspace.
      </p>
      <div className="mt-7">
        <Link to="/dashboard">
          <Button variant="primary" size="lg" icon={<ArrowLeft className="w-5 h-5" />} className="shadow-md shadow-indigo-200">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
