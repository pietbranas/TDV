import { useQuery } from '@tanstack/react-query';
import { quotesApi, pricesApi, customersApi } from '../lib/api';
import { FileText, Users, DollarSign, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

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

  const { data: pricesData } = useQuery({
    queryKey: ['prices', 'metals'],
    queryFn: () => pricesApi.getMetals(),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers', 'count'],
    queryFn: () => customersApi.list({ limit: 1 }),
  });

  const quotes = quotesData?.data?.quotes || [];
  const metals = pricesData?.data?.metals || [];
  const totalCustomers = customersData?.data?.pagination?.total || 0;
  const totalQuotes = quotesData?.data?.pagination?.total || 0;

  // Calculate stats
  const draftQuotes = quotes.filter((q: { status: string }) => q.status === 'DRAFT').length;
  const acceptedQuotes = quotes.filter((q: { status: string }) => q.status === 'ACCEPTED').length;

  // Get gold price
  const gold18kt = metals.find((m: { metalType: string; karat: number }) => m.metalType === 'gold' && m.karat === 18);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to your jewellery pricing platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title="Gold 18kt/g"
          value={gold18kt ? `R${Number(gold18kt.priceZar).toFixed(2)}` : 'Loading...'}
          icon={DollarSign}
          color="bg-gold-500"
          subtitle="Per gram"
        />
        <StatCard
          title="Accepted"
          value={acceptedQuotes}
          icon={CheckCircle}
          color="bg-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        {/* Metal Prices */}
        <div className="card">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Current Metal Prices</h2>
            <p className="text-sm text-gray-500">Per gram in ZAR</p>
          </div>
          <div className="divide-y">
            {metals.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Loading prices...</p>
              </div>
            ) : (
              metals.slice(0, 6).map((metal: {
                id: string;
                metalType: string;
                karat: number | null;
                priceZar: number;
                fetchedAt: string;
              }) => (
                <div key={metal.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      metal.metalType === 'gold' ? 'bg-gold-400' :
                      metal.metalType === 'silver' ? 'bg-gray-400' :
                      metal.metalType === 'platinum' ? 'bg-slate-400' :
                      'bg-blue-400'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {metal.metalType} {metal.karat ? `${metal.karat}kt` : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        Updated {format(new Date(metal.fetchedAt), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">
                    R{Number(metal.priceZar).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/quotes" className="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary-500" />
            <p className="font-medium text-gray-900">New Quote</p>
          </a>
          <a href="/customers" className="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="font-medium text-gray-900">Add Customer</p>
          </a>
          <a href="/materials" className="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-center">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="font-medium text-gray-900">Materials</p>
          </a>
          <a href="/prices" className="p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-gold-300 hover:bg-gold-50 transition-colors text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gold-500" />
            <p className="font-medium text-gray-900">View Prices</p>
          </a>
        </div>
      </div>
    </div>
  );
}