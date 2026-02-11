import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Loader2,
  FolderOpen,
  Package,
  Eye,
  X,
  Filter
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

interface Resource {
  id: string;
  name: string;
  category: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  notes: string | null;
  uploadedAt: string;
  supplier: { id: string; name: string };
  _count: { components: number };
}

interface Component {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  subCategory: string | null;
  unit: string;
  priceUsd: number | null;
  priceZar: number | null;
  size: string | null;
  quality: string | null;
  specifications?: Record<string, any>;
}

interface ParsedPreview {
  headers: string[];
  rowCount: number;
  preview: Record<string, any>[];
  sheetNames?: string[];
}

const CATEGORIES = [
  { value: 'diamonds', label: 'Diamonds' },
  { value: 'gemstones', label: 'Gemstones' },
  { value: 'findings', label: 'Findings' },
  { value: 'metals', label: 'Metals' },
  { value: 'chains', label: 'Chains' },
  { value: 'components', label: 'Components' },
];

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showComponents, setShowComponents] = useState<string | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadForm, setUploadForm] = useState({
    supplierId: '',
    name: '',
    category: '',
    notes: '',
    file: null as File | null,
  });

  const fetchResources = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategory) params.append('category', filterCategory);
      if (filterSupplier) params.append('supplierId', filterSupplier);
      
      const response = await api.get(`/resources?${params}`);
      setResources(response.data.resources || []);
    } catch (error) {
      toast.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.suppliers || []);
    } catch (error) {
      console.error('Failed to load suppliers');
    }
  };

  const fetchComponents = async (resourceId: string) => {
    try {
      setLoadingComponents(true);
      const response = await api.get(`/resources/${resourceId}`);
      setComponents(response.data.resource?.components || []);
    } catch (error) {
      toast.error('Failed to load components');
    } finally {
      setLoadingComponents(false);
    }
  };

  useEffect(() => {
    fetchResources();
    fetchSuppliers();
  }, [filterCategory, filterSupplier]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm({ ...uploadForm, file, name: uploadForm.name || file.name.replace(/\.[^/.]+$/, '') });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.supplierId || !uploadForm.name || !uploadForm.category) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('supplierId', uploadForm.supplierId);
      formData.append('name', uploadForm.name);
      formData.append('category', uploadForm.category);
      if (uploadForm.notes) formData.append('notes', uploadForm.notes);

      const response = await api.post('/resources', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { parsedData, componentsCreated, parseError, replacedResource } = response.data;
      
      if (parseError) {
        toast.error(`Parsing error: ${parseError}`);
      }
      
      if (parsedData && parsedData.rowCount > 0) {
        setParsedPreview(parsedData);
        setShowPreview(true);
        if (replacedResource) {
          toast.success(`Replaced "${replacedResource}"! ${componentsCreated} items extracted.`);
        } else {
          toast.success(`Resource uploaded! ${componentsCreated} items extracted.`);
        }
      } else {
        if (replacedResource) {
          toast.success(`Replaced "${replacedResource}" successfully`);
        } else {
          toast.success('Resource uploaded successfully');
        }
      }
      
      setShowUpload(false);
      setUploadForm({ supplierId: '', name: '', category: '', notes: '', file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchResources();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload resource');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (resource: Resource) => {
    try {
      const response = await api.get(`/resources/${resource.id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', resource.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resource and all associated components?')) return;

    try {
      await api.delete(`/resources/${id}`);
      toast.success('Resource deleted');
      fetchResources();
    } catch (error) {
      toast.error('Failed to delete resource');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf': return '📄';
      case 'xlsx':
      case 'xls': return '📊';
      case 'csv': return '📋';
      case 'html':
      case 'htm': return '🌐';
      default: return '📁';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'diamonds': return 'bg-blue-50 text-blue-700';
      case 'gemstones': return 'bg-purple-50 text-purple-700';
      case 'findings': return 'bg-amber-50 text-amber-700';
      case 'metals': return 'bg-orange-50 text-orange-700';
      case 'chains': return 'bg-green-50 text-green-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Supplier Resources</h1>
          <p className="text-sm text-gray-500">Price lists and catalogs</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary text-sm">
          <Upload className="w-4 h-4 mr-1.5" />
          Upload
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          <span>Filter:</span>
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Suppliers</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {(filterCategory || filterSupplier) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterSupplier(''); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Resources List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FolderOpen className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-900 font-medium mb-1">No resources found</p>
          <p className="text-sm text-gray-500 mb-4">Upload supplier price lists to get started</p>
          <button onClick={() => setShowUpload(true)} className="btn-primary text-sm">
            <Upload className="w-4 h-4 mr-1.5" />
            Upload Resource
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {resources.map(resource => (
            <div key={resource.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{getFileIcon(resource.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{resource.name}</h3>
                      <p className="text-sm text-gray-500">{resource.supplier.name}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${getCategoryColor(resource.category)}`}>
                      {resource.category}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{formatFileSize(resource.fileSize)}</span>
                    <span>•</span>
                    <span>{new Date(resource.uploadedAt).toLocaleDateString()}</span>
                    {resource._count.components > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-primary-600">{resource._count.components} items</span>
                      </>
                    )}
                  </div>

                  {resource.notes && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-1">{resource.notes}</p>
                  )}

                  <div className="flex items-center gap-1 mt-3">
                    <button
                      onClick={() => handleDownload(resource)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setShowComponents(resource.id);
                        fetchComponents(resource.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      title="View Components"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(resource.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Upload Resource</h2>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                <select
                  value={uploadForm.supplierId}
                  onChange={(e) => setUploadForm({ ...uploadForm, supplierId: e.target.value })}
                  className="input"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                  className="input"
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Diamond Price List Jan 2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.html,.htm"
                  onChange={handleFileChange}
                  className="input text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">PDF, Excel, CSV, or HTML</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={uploadForm.notes}
                  onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowUpload(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleUpload} disabled={uploading} className="btn-primary text-sm">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-1.5" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parsed Data Preview Modal */}
      {showPreview && parsedPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900">Extracted Data Preview</h2>
                <p className="text-sm text-gray-500">{parsedPreview.rowCount} rows found</p>
              </div>
              <button onClick={() => { setShowPreview(false); setParsedPreview(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              {parsedPreview.preview.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        {parsedPreview.headers.map((header, idx) => (
                          <th key={idx} className="text-left py-2 px-3 font-medium text-gray-600 border-b whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedPreview.preview.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-gray-50">
                          {parsedPreview.headers.map((header, colIdx) => (
                            <td key={colIdx} className="py-2 px-3 text-gray-700 whitespace-nowrap max-w-xs truncate">
                              {row[header] !== null && row[header] !== undefined ? String(row[header]) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedPreview.rowCount > 10 && (
                    <p className="text-sm text-gray-500 mt-3 text-center">
                      Showing first 10 of {parsedPreview.rowCount} rows
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No structured data could be extracted from this file.</p>
                </div>
              )}
            </div>
            <div className="flex justify-end px-5 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => { setShowPreview(false); setParsedPreview(null); }} className="btn-primary text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Components Modal */}
      {showComponents && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-400" />
                Components
              </h2>
              <button onClick={() => setShowComponents(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {loadingComponents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : components.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-900 font-medium mb-1">No components yet</p>
                  <p className="text-sm text-gray-500">Components can be manually added or imported.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Name</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">SKU</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Category</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Size</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-500">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {components.map(comp => (
                        <tr key={comp.id} className="hover:bg-gray-50">
                          <td className="py-2 px-3">{comp.name}</td>
                          <td className="py-2 px-3 text-gray-500">{comp.sku || '-'}</td>
                          <td className="py-2 px-3">{comp.category}</td>
                          <td className="py-2 px-3">{comp.size || '-'}</td>
                          <td className="py-2 px-3 text-right">
                            {comp.priceZar ? `R${Number(comp.priceZar).toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}