import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit2, 
  Trash2, 
  Loader2,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  AlertCircle,
  Filter
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  company: string | null;
}

interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customer: Customer;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
  subtotal: number;
  markupPct: number;
  markupAmt: number;
  discount: number;
  totalZar: number;
  notes: string | null;
  validUntil: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: <FileText className="w-3 h-3" /> },
  SENT: { label: 'Sent', color: 'bg-blue-100 text-blue-800', icon: <Send className="w-3 h-3" /> },
  ACCEPTED: { label: 'Accepted', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> },
  EXPIRED: { label: 'Expired', color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="w-3 h-3" /> },
  CONVERTED: { label: 'Converted', color: 'bg-purple-100 text-purple-800', icon: <CheckCircle className="w-3 h-3" /> },
};

export default function QuotesPage() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newQuoteCustomerId, setNewQuoteCustomerId] = useState('');

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (customerFilter) params.append('customerId', customerFilter);
      params.append('limit', '100');
      
      const response = await api.get(`/quotes?${params.toString()}`);
      setQuotes(response.data.quotes || []);
    } catch (error) {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers?limit=100');
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Failed to load customers');
    }
  };

  useEffect(() => {
    fetchQuotes();
    fetchCustomers();
  }, [searchTerm, statusFilter, customerFilter]);

  const handleCreateQuote = async () => {
    if (!newQuoteCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    try {
      setCreating(true);
      const response = await api.post('/quotes', { customerId: newQuoteCustomerId });
      toast.success('Quote created successfully');
      setShowCreateModal(false);
      navigate(`/quotes/${response.data.quote.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create quote');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (quote: Quote) => {
    if (!confirm(`Are you sure you want to delete quote ${quote.quoteNumber}?`)) {
      return;
    }

    try {
      await api.delete(`/quotes/${quote.id}`);
      toast.success('Quote deleted successfully');
      fetchQuotes();
    } catch (error) {
      toast.error('Failed to delete quote');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  if (loading && quotes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-600">Manage customer quotes and estimates</p>
        </div>
        <button onClick={() => navigate('/quotes/new')} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          New Quote
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-36"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="">All Customers</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quote #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valid Until
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {quotes.map((quote) => {
                const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.DRAFT;
                const expired = quote.status === 'SENT' && isExpired(quote.validUntil);
                
                return (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{quote.quoteNumber}</span>
                        {quote.version > 1 && (
                          <span className="ml-2 text-xs text-gray-500">v{quote.version}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{quote.customer?.name}</div>
                      {quote.customer?.company && (
                        <div className="text-sm text-gray-500">{quote.customer.company}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                        expired ? 'bg-yellow-100 text-yellow-800' : statusConfig.color
                      }`}>
                        {expired ? <AlertCircle className="w-3 h-3 mr-1" /> : <span className="mr-1">{statusConfig.icon}</span>}
                        {expired ? 'Expired' : statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(Number(quote.totalZar))}
                      </span>
                      {quote._count && quote._count.items > 0 && (
                        <div className="text-xs text-gray-500">
                          {quote._count.items} item{quote._count.items !== 1 ? 's' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {quote.validUntil ? (
                        <span className={`text-sm ${expired ? 'text-red-600' : 'text-gray-600'}`}>
                          {formatDate(quote.validUntil)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(quote.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/quotes/${quote.id}`)}
                        className="text-primary-600 hover:text-primary-900 mr-3"
                        title="View/Edit"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(quote)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No quotes found</p>
                    <button 
                      onClick={() => setShowCreateModal(true)} 
                      className="mt-2 text-primary-600 hover:text-primary-800"
                    >
                      Create your first quote
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Quote Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Create New Quote</h2>
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Customer *
                </label>
                <select
                  value={newQuoteCustomerId}
                  onChange={(e) => setNewQuoteCustomerId(e.target.value)}
                  className="input"
                >
                  <option value="">Choose a customer...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.company ? `(${customer.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {customers.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    No customers found. Please add a customer first.
                  </p>
                  <button 
                    onClick={() => navigate('/customers')}
                    className="mt-2 text-sm text-yellow-700 underline"
                  >
                    Go to Customers
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button 
                  onClick={() => setShowCreateModal(false)} 
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateQuote} 
                  disabled={creating || !newQuoteCustomerId}
                  className="btn-primary"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Quote'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}