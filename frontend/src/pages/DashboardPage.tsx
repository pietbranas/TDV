import { useQuery } from '@tanstack/react-query';
import { quotesApi, customersApi } from '../lib/api';
import { FileText, Users, CheckCircle } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: quotesData } = useQuery({
    queryKey: ['quotes', 'recent'],
    queryFn: () => quotesApi.list({ limit: 5 }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', 'count'],
    queryFn: () => customersApi.list({ limit: 1 }),
  });

  const quotes = quotesData?.data?.quotes || [];
  const totalCustomers = customersData?.data?.pagination?.total || 0;
  const totalQuotes = quotesData?.data?.pagination?.total || 0;

  // Calculate stats
  const acceptedQuotes = quotes.filter((q: { status: string }) => q.status === 'ACCEPTED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to your jewellery pricing platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Quotes"
          value={totalQuotes}
          icon={FileText}
          color="bg-primary-500"
        />
        <StatCard
          title="Customers"
          value={totalCustomers}
          icon={Users}
          color="bg-green-500"
        />
        <StatCard
          title="Accepted"
          value={acceptedQuotes}
          icon={CheckCircle}
          color="bg-emerald-500"
        />
      </div>

      {/* Recent Quotes */}
      <div className="card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Quotes</h2>
        </div>
        <div className="divide-y">
          {quotes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No quotes yet</p>
              <p className="text-sm">Create your first quote to get started</p>
            </div>
          ) : (
            quotes.map((quote: {
              id: string;
              quoteNumber: string;
              customer: { name: string };
              totalZar: number;
              status: string;
              createdAt: string;
            }) => (
              <div key={quote.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{quote.quoteNumber}</p>
                    <p className="text-sm text-gray-500">{quote.customer?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      R{Number(quote.totalZar).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                    <span className={`badge ${
                      quote.status === 'ACCEPTED' ? 'badge-success' :
                      quote.status === 'SENT' ? 'badge-info' :
                      quote.status === 'REJECTED' ? 'badge-danger' :
                      'badge-gray'
                    }`}>
                      {quote.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <a href="/quotes" className="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary-500" />
            <p className="font-medium text-gray-900">New Quote</p>
          </a>
          <a href="/customers" className="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="font-medium text-gray-900">Add Customer</p>
          </a>
          <a href="/materials" className="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="font-medium text-gray-900">Materials</p>
          </a>
        </div>
      </div>
    </div>
  );
}