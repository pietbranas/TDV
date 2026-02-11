import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Save,
  FileDown,
  Upload,
  Plus,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
}

interface MetalComponent {
  id: string;
  name: string;
  priceZar: number | null;
  unit: string;
  quality: string | null;
}

interface DiamondLine {
  id: string;
  sizeMm: string;
  sizeCt: string;
  colour: string;
  inclusions: string;
  cutType: string;
  costEach: number;
  quantity: number;
}

// Diamond dropdown options
const DIAMOND_COLOURS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N-Z'];
const DIAMOND_INCLUSIONS = ['IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'I3'];
const DIAMOND_CUT_TYPES = ['RBC', 'Princess', 'Oval', 'Marquise', 'Pear', 'Emerald', 'Cushion', 'Radiant', 'Asscher', 'Heart', 'Baguette', 'Trillion'];

interface ComponentLine {
  id: string;
  description: string;
  costExVat: number;
  addVat: boolean;
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [metalComponents, setMetalComponents] = useState<MetalComponent[]>([]);

  // Quote fields
  const [customerId, setCustomerId] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [sketchPreview, setSketchPreview] = useState('');

  // Labour
  const [labourHours, setLabourHours] = useState<number>(0);
  const [labourRate, setLabourRate] = useState<number>(450);

  // Material
  const [useCustomMaterial, setUseCustomMaterial] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [materialWeight, setMaterialWeight] = useState<number>(0);
  const [materialPrice, setMaterialPrice] = useState<number>(0);
  const [materialAddVat, setMaterialAddVat] = useState(true);
  const [materialLossFactor, setMaterialLossFactor] = useState<number>(1.2);

  // Diamonds
  const [diamonds, setDiamonds] = useState<DiamondLine[]>([]);

  // Components
  const [components, setComponents] = useState<ComponentLine[]>([]);

  // Optional costs
  const [settingCost, setSettingCost] = useState<number>(0);
  const [packagingCost, setPackagingCost] = useState<number>(0);
  const [courierCost, setCourierCost] = useState<number>(0);

  // Markup & Pricing
  const [markupPercent, setMarkupPercent] = useState<number>(50);
  const [costPriceMultiplier, setCostPriceMultiplier] = useState<number>(2.5);

  // Notes
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
    if (!isNew && id) {
      fetchQuote(id);
    }
  }, [id, isNew]);

  const fetchData = async () => {
    try {
      const [custRes, metalsRes] = await Promise.all([
        api.get('/customers'),
        api.get('/components?category=metals'),
      ]);
      setCustomers(custRes.data.customers || []);
      setMetalComponents(metalsRes.data.components || []);
    } catch (error) {
      console.error('Failed to fetch data');
    }
  };

  const fetchQuote = async (quoteId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/quotes/${quoteId}`);
      const quote = response.data.quote;
      
      // Load all saved data
      setCustomerId(quote.customerId || '');
      setSkuCode(quote.skuCode || '');
      setNotes(quote.notes || '');
      setMarkupPercent(Number(quote.markupPct) || 50);
      
      // Parse JSON data fields
      if (quote.quoteData) {
        const data = typeof quote.quoteData === 'string' ? JSON.parse(quote.quoteData) : quote.quoteData;
        setLabourHours(data.labourHours || 0);
        setLabourRate(data.labourRate || 450);
        setUseCustomMaterial(data.useCustomMaterial || false);
        setSelectedMaterialId(data.selectedMaterialId || '');
        setCustomMaterialName(data.customMaterialName || '');
        setMaterialWeight(data.materialWeight || 0);
        setMaterialPrice(data.materialPrice || 0);
        setMaterialAddVat(data.materialAddVat !== false);
        setMaterialLossFactor(data.materialLossFactor || 1.2);
        setDiamonds(data.diamonds || []);
        setComponents(data.components || []);
        setSettingCost(data.settingCost || 0);
        setPackagingCost(data.packagingCost || 0);
        setCourierCost(data.courierCost || 0);
        setCostPriceMultiplier(data.costPriceMultiplier || 2.5);
        setSketchPreview(data.sketchPreview || '');
      }
    } catch (error) {
      toast.error('Failed to load quote');
      navigate('/quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialSelect = (componentId: string) => {
    setSelectedMaterialId(componentId);
    const component = metalComponents.find(m => m.id === componentId);
    if (component && component.priceZar) {
      setMaterialPrice(Number(component.priceZar));
    }
  };

  const handleSketchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setSketchPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addDiamond = () => {
    setDiamonds([...diamonds, { 
      id: `d-${Date.now()}`, 
      sizeMm: '',
      sizeCt: '',
      colour: '',
      inclusions: '',
      cutType: '',
      costEach: 0, 
      quantity: 1 
    }]);
  };

  const getDiamondDescription = (d: DiamondLine) => {
    const parts = [];
    if (d.sizeCt) parts.push(`${d.sizeCt}ct`);
    if (d.colour) parts.push(d.colour);
    if (d.inclusions) parts.push(d.inclusions);
    if (d.cutType) parts.push(d.cutType);
    if (d.sizeMm) parts.push(`(${d.sizeMm}mm)`);
    return parts.join(' ') || 'Diamond';
  };

  const updateDiamond = (id: string, field: keyof DiamondLine, value: any) => {
    setDiamonds(diamonds.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const removeDiamond = (id: string) => {
    setDiamonds(diamonds.filter(d => d.id !== id));
  };

  const addComponent = () => {
    setComponents([...components, { id: `c-${Date.now()}`, description: '', costExVat: 0, addVat: true }]);
  };

  const updateComponent = (id: string, field: keyof ComponentLine, value: any) => {
    setComponents(components.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  // Calculations
  const labourTotal = labourHours * labourRate;
  const materialBase = materialWeight * materialPrice;
  const materialVat = materialAddVat ? materialBase * 0.15 : 0;
  const materialTotal = (materialBase + materialVat) * materialLossFactor;
  const diamondsTotal = diamonds.reduce((sum, d) => sum + (d.costEach * d.quantity), 0);
  const componentsTotal = components.reduce((sum, c) => sum + c.costExVat * (c.addVat ? 1.15 : 1), 0);
  const subTotal = labourTotal + materialTotal + diamondsTotal + componentsTotal + settingCost + packagingCost + courierCost;
  const markupAmount = subTotal * (markupPercent / 100);
  const retailPrice = subTotal + markupAmount;
  const costPrice = subTotal * costPriceMultiplier;

  const handleSave = async () => {
    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }
    try {
      setSaving(true);
      
      // Store all form data in quoteData JSON field
      const quoteData = {
        labourHours,
        labourRate,
        useCustomMaterial,
        selectedMaterialId,
        customMaterialName,
        materialWeight,
        materialPrice,
        materialAddVat,
        materialLossFactor,
        diamonds,
        components,
        settingCost,
        packagingCost,
        courierCost,
        costPriceMultiplier,
        sketchPreview,
      };
      
      const payload = {
        customerId,
        skuCode,
        markupPct: markupPercent,
        subtotal: subTotal,
        totalZar: retailPrice,
        notes,
        status: 'DRAFT',
        quoteData: JSON.stringify(quoteData),
      };
      
      if (isNew) {
        const response = await api.post('/quotes', payload);
        toast.success('Quote created');
        navigate(`/quotes/${response.data.quote.id}`);
      } else {
        await api.put(`/quotes/${id}`, payload);
        toast.success('Quote saved');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (isNew) {
      toast.error('Please save the quote first');
      return;
    }
    try {
      setExporting(true);
      const response = await api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quote-${skuCode || id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF exported');
    } catch (error) {
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/quotes')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Quote' : 'Edit Quote'}</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} disabled={exporting || isNew} className="btn-secondary">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
            Export PDF
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </button>
        </div>
      </div>

      {/* Customer */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input max-w-md">
          <option value="">Select customer...</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* 1. SKU & 2. Sketch */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">1. SKU Code</label>
            <input type="text" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} className="input" placeholder="Enter SKU..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">2. Sketch</label>
            <input type="file" ref={fileInputRef} onChange={handleSketchUpload} accept="image/*" className="hidden" />
            {sketchPreview ? (
              <div className="relative">
                <img src={sketchPreview} alt="Sketch" className="w-full h-40 object-contain border rounded-lg bg-gray-50" />
                <button onClick={() => setSketchPreview('')} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                <Upload className="w-8 h-8 mb-2" />
                <span>Upload Sketch</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Labour */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">3. Labour</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hours</label>
            <input type="number" value={labourHours || ''} onChange={(e) => setLabourHours(Number(e.target.value) || 0)} className="input w-24" min="0" step="0.5" />
          </div>
          <span className="text-gray-400 mt-6">×</span>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Rate (R/hr)</label>
            <input type="number" value={labourRate || ''} onChange={(e) => setLabourRate(Number(e.target.value) || 0)} className="input w-28" min="0" />
          </div>
          <span className="text-gray-400 mt-6">=</span>
          <div className="mt-6">
            <span className="text-xl font-bold text-primary-600">{formatCurrency(labourTotal)}</span>
          </div>
        </div>
      </div>

      {/* 4. Material */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">4. Material</h3>
        <div className="flex items-center gap-6 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={!useCustomMaterial} onChange={() => setUseCustomMaterial(false)} className="text-primary-600" />
            <span>Select from list</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={useCustomMaterial} onChange={() => setUseCustomMaterial(true)} className="text-primary-600" />
            <span>Custom material</span>
          </label>
        </div>
        {!useCustomMaterial ? (
          <select value={selectedMaterialId} onChange={(e) => handleMaterialSelect(e.target.value)} className="input max-w-md mb-4">
            <option value="">Select material...</option>
            {metalComponents
              .filter(m => m.priceZar && m.priceZar > 0 && m.name.includes(' - '))
              .map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} - {formatCurrency(Number(m.priceZar))}/{m.unit || 'g'}
                </option>
              ))}
          </select>
        ) : (
          <input type="text" value={customMaterialName} onChange={(e) => setCustomMaterialName(e.target.value)} className="input max-w-md mb-4" placeholder="Enter material name..." />
        )}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Weight (g)</label>
            <input type="number" value={materialWeight || ''} onChange={(e) => setMaterialWeight(Number(e.target.value) || 0)} className="input w-24" min="0" step="0.1" />
          </div>
          <span className="text-gray-400 mt-6">×</span>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Price (R/g)</label>
            <input type="number" value={materialPrice || ''} onChange={(e) => setMaterialPrice(Number(e.target.value) || 0)} className="input w-28" min="0" />
          </div>
          <span className="text-gray-400 mt-6">=</span>
          <div className="mt-6"><span className="font-medium">{formatCurrency(materialBase)}</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-6 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={materialAddVat} onChange={(e) => setMaterialAddVat(e.target.checked)} className="rounded text-primary-600" />
            <span>Add VAT (15%)</span>
            {materialAddVat && <span className="text-gray-500 text-sm">+{formatCurrency(materialVat)}</span>}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Loss Factor:</span>
            <input type="number" value={materialLossFactor} onChange={(e) => setMaterialLossFactor(Number(e.target.value) || 1)} className="input w-20" min="1" step="0.1" />
          </div>
        </div>
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Material Total:</span>
            <span className="text-xl font-bold text-primary-600">{formatCurrency(materialTotal)}</span>
          </div>
        </div>
      </div>

      {/* 5. Diamonds */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">5. Diamonds</h3>
        {diamonds.length > 0 && (
          <div className="space-y-4 mb-4">
            {diamonds.map((d, idx) => (
              <div key={d.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Diamond {idx + 1}: {getDiamondDescription(d)}</span>
                  <button onClick={() => removeDiamond(d.id)} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Size (mm)</label>
                    <input 
                      type="text" 
                      value={d.sizeMm} 
                      onChange={(e) => updateDiamond(d.id, 'sizeMm', e.target.value)} 
                      className="input py-1.5 text-sm w-full" 
                      placeholder="e.g., 1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Size (ct)</label>
                    <input 
                      type="text" 
                      value={d.sizeCt} 
                      onChange={(e) => updateDiamond(d.id, 'sizeCt', e.target.value)} 
                      className="input py-1.5 text-sm w-full" 
                      placeholder="e.g., 0.05"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Colour</label>
                    <select 
                      value={d.colour} 
                      onChange={(e) => updateDiamond(d.id, 'colour', e.target.value)} 
                      className="input py-1.5 text-sm w-full"
                    >
                      <option value="">Select...</option>
                      {DIAMOND_COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Inclusions</label>
                    <select 
                      value={d.inclusions} 
                      onChange={(e) => updateDiamond(d.id, 'inclusions', e.target.value)} 
                      className="input py-1.5 text-sm w-full"
                    >
                      <option value="">Select...</option>
                      {DIAMOND_INCLUSIONS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cut Type</label>
                    <select 
                      value={d.cutType} 
                      onChange={(e) => updateDiamond(d.id, 'cutType', e.target.value)} 
                      className="input py-1.5 text-sm w-full"
                    >
                      <option value="">Select...</option>
                      {DIAMOND_CUT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cost Each (R)</label>
                    <input 
                      type="number" 
                      value={d.costEach || ''} 
                      onChange={(e) => updateDiamond(d.id, 'costEach', Number(e.target.value) || 0)} 
                      className="input py-1.5 text-sm w-full" 
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Qty</label>
                    <input 
                      type="number" 
                      value={d.quantity || ''} 
                      onChange={(e) => updateDiamond(d.id, 'quantity', Number(e.target.value) || 0)} 
                      className="input py-1.5 text-sm w-full" 
                      min="1"
                    />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <span className="text-sm text-gray-500">Line Total: </span>
                  <span className="font-medium text-primary-600">{formatCurrency(d.costEach * d.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={addDiamond} className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
          <Plus className="w-4 h-4" />
          Add diamond
        </button>
        {diamonds.length > 0 && (
          <div className="border-t pt-4 mt-4 flex justify-between items-center">
            <span className="font-medium">Diamonds Total:</span>
            <span className="text-xl font-bold text-primary-600">{formatCurrency(diamondsTotal)}</span>
          </div>
        )}
      </div>

      {/* 6. Components */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">6. Additional Components</h3>
        {components.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 rounded-tl-lg">Description</th>
                <th className="text-right p-3 w-28">Cost ex VAT</th>
                <th className="text-center p-3 w-20">+VAT</th>
                <th className="text-right p-3 w-28">Total</th>
                <th className="w-10 rounded-tr-lg"></th>
              </tr>
            </thead>
            <tbody>
              {components.map(c => (
                <tr key={c.id} className="border-b">
                  <td className="p-2"><input type="text" value={c.description} onChange={(e) => updateComponent(c.id, 'description', e.target.value)} className="input py-2 text-sm w-full" placeholder="e.g., Butterflies YUF 425" /></td>
                  <td className="p-2"><input type="number" value={c.costExVat || ''} onChange={(e) => updateComponent(c.id, 'costExVat', Number(e.target.value) || 0)} className="input py-2 text-sm w-full text-right" min="0" /></td>
                  <td className="p-2 text-center"><input type="checkbox" checked={c.addVat} onChange={(e) => updateComponent(c.id, 'addVat', e.target.checked)} className="rounded text-primary-600" /></td>
                  <td className="p-2 text-right font-medium">{formatCurrency(c.costExVat * (c.addVat ? 1.15 : 1))}</td>
                  <td className="p-2"><button onClick={() => removeComponent(c.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button onClick={addComponent} className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
          <Plus className="w-4 h-4" />
          Add component
        </button>
        {components.length > 0 && (
          <div className="border-t pt-4 mt-4 flex justify-between items-center">
            <span className="font-medium">Components Total:</span>
            <span className="text-xl font-bold text-primary-600">{formatCurrency(componentsTotal)}</span>
          </div>
        )}
      </div>

      {/* 7-9. Optional Costs */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Optional Costs</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm text-gray-600 mb-2">7. Setting</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
              <input type="number" value={settingCost || ''} onChange={(e) => setSettingCost(Number(e.target.value) || 0)} className="input pl-8" min="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">8. Packaging</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
              <input type="number" value={packagingCost || ''} onChange={(e) => setPackagingCost(Number(e.target.value) || 0)} className="input pl-8" min="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">9. Courier</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
              <input type="number" value={courierCost || ''} onChange={(e) => setCourierCost(Number(e.target.value) || 0)} className="input pl-8" min="0" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="card p-6 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-600">Labour:</span><span>{formatCurrency(labourTotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Material:</span><span>{formatCurrency(materialTotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Diamonds:</span><span>{formatCurrency(diamondsTotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Components:</span><span>{formatCurrency(componentsTotal)}</span></div>
          {settingCost > 0 && <div className="flex justify-between"><span className="text-gray-600">Setting:</span><span>{formatCurrency(settingCost)}</span></div>}
          {packagingCost > 0 && <div className="flex justify-between"><span className="text-gray-600">Packaging:</span><span>{formatCurrency(packagingCost)}</span></div>}
          {courierCost > 0 && <div className="flex justify-between"><span className="text-gray-600">Courier:</span><span>{formatCurrency(courierCost)}</span></div>}
        </div>
        <div className="border-t border-gray-300 mt-4 pt-4 space-y-4">
          <div className="flex justify-between text-lg">
            <span className="font-medium">10. Sub-Total:</span>
            <span className="font-bold">{formatCurrency(subTotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>11. Markup:</span>
              <input type="number" value={markupPercent} onChange={(e) => setMarkupPercent(Number(e.target.value) || 0)} className="input w-20 py-1" min="0" />
              <span>%</span>
            </div>
            <span className="font-medium text-green-600">+{formatCurrency(markupAmount)}</span>
          </div>
          <div className="flex justify-between text-xl border-t border-gray-300 pt-4">
            <span className="font-bold">12. Retail Price:</span>
            <span className="font-bold text-primary-600">{formatCurrency(retailPrice)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-300 pt-4">
            <div className="flex items-center gap-2">
              <span>13. Cost Price (Reseller):</span>
              <span className="text-sm text-gray-500">Sub-Total ×</span>
              <input type="number" value={costPriceMultiplier} onChange={(e) => setCostPriceMultiplier(Number(e.target.value) || 1)} className="input w-20 py-1" min="1" step="0.1" />
            </div>
            <span className="font-bold text-green-600">{formatCurrency(costPrice)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} placeholder="Additional notes..." />
      </div>
    </div>
  );
}
