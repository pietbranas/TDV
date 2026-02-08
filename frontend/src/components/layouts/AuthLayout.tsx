import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">💎 Jeweller</h1>
          <p className="text-gray-600 mt-2">Pricing & Quote Management</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {children}
        </div>
        <p className="text-center text-sm text-gray-500 mt-6">
          © {new Date().getFullYear()} Jeweller Pricing Platform
        </p>
      </div>
    </div>
  );
}