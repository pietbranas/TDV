import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { quotesApi } from '../lib/api';
import { Plus, Search, FileText, Download, Copy, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QuotesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['quotes', search, status],
    queryFn: () => quotesApi.list({ search, status: status || undefined }),
  });

  const quotes = data?.data?.quotes || [];

  const handleDownloadPdf = async (id: string, quoteNumber: string) => {
    try {
      const response = await quotesApi.getPdf(id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quote-${quoteNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await quotesApi.duplicate(id);
      toast.success('Quote duplicated');
      refetch();
    } catch {
      toast.error('Failed to duplicate quote');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quote?')) return;
    try {
      await quotesApi.delete(id);
      toast.success('Quote deleted');
      refetch();
    } catch {
      toast.error('Failed to delete quote');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-600">Manage your quotes and proposals</p>
        </div>
        <Link to="/quotes/new" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          New Quote
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search quotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="card">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : quotes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No quotes found</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote: {
                  id: string;
                  quoteNumber: string;
                  customer: { name: string; company?: string };
                  _count: { items: number };
                  totalZar: number;
                  status: string;
                  createdAt: string;
                }) => (
                  <tr key={quote.id}>
                    <td>
                      <Link to={`/quotes/${quote.id}`} className="font-medium text-primary-600 hover:underline">
                        {quote.quoteNumber}
                      </Link>
                    </td>
                    <td>
                      <div>
                        <p className="font-medium">{quote.customer?.name}</p>
                        {quote.customer?.company && (
                          <p className="text-xs text-gray-500">{quote.customer.company}</p>
                        )}
                      </div>
                    </td>
                    <td>{quote._count?.items || 0}</td>
                    <td className="font-medium">
                      R{Number(quote.totalZar).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`badge ${
                        quote.status === 'ACCEPTED' ? 'badge-success' :
                        quote.status === 'SENT' ? 'badge-info' :
                        quote.status === 'REJECTED' ? 'badge-danger' :
                        quote.status === 'EXPIRED' ? 'badge-warning' :
                        'badge-gray'
                      }`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {new Date(quote.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownloadPdf(quote.id, quote.quoteNumber)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(quote.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(quote.id)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}