import React from 'react';

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

const LegalPage: React.FC<LegalPageProps> = ({ title, lastUpdated, children }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <a 
          href="/" 
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to SkillSync
        </a>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: {lastUpdated}</p>
          
          <div className="prose prose-slate max-w-none">
            {children}
          </div>
        </div>
        
        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>© 2026 SkillSync. Built for Google Gemini Hackathon.</p>
        </footer>
      </div>
    </div>
  );
};

export default LegalPage;
