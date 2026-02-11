import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { 
  Save, 
  Building, 
  Mail, 
  Phone, 
  MapPin,
  FileText,
  Loader2,
  DollarSign,
  Clock,
  Percent
} from 'lucide-react';

interface Settings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_vat: string;
  default_labour_rate: string;
  default_markup_pct: string;
  quote_validity_days: string;
  quote_terms: string;
  quote_notes: string;
  currency: string;
  currency_symbol: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<Settings>();

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings');
      const settingsMap: Record<string, string> = {};
      response.data.settings.forEach((s: { key: string; value: string }) => {
        settingsMap[s.key] = s.value;
      });
      reset(settingsMap as unknown as Settings);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const onSubmit = async (data: Settings) => {
    try {
      setSaving(true);
      // Convert to array of key-value pairs
      const settings = Object.entries(data).map(([key, value]) => ({
        key,
        value: value || '',
      }));
      await api.put('/settings', { settings });
      toast.success('Settings saved successfully');
      reset(data); // Reset form state to mark as not dirty
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your business settings and defaults</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Company Information */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-primary-600" />
            Company Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Company Name</label>
              <input
                {...register('company_name')}
                className="input"
                placeholder="Your Business Name"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('company_email')}
                  type="email"
                  className="input pl-10"
                  placeholder="info@yourbusiness.com"
                />
              </div>
            </div>
            <div>
              <label className="label">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('company_phone')}
                  className="input pl-10"
                  placeholder="+27 12 345 6789"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  {...register('company_address')}
                  className="input pl-10 min-h-[80px]"
                  placeholder="Street address, city, postal code"
                />
              </div>
            </div>
            <div>
              <label className="label">VAT Number</label>
              <input
                {...register('company_vat')}
                className="input"
                placeholder="VAT registration number"
              />
            </div>
          </div>
        </div>

        {/* Pricing Defaults */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Pricing Defaults
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Default Labour Rate (ZAR/hour)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('default_labour_rate')}
                  type="number"
                  className="input pl-10"
                  placeholder="350"
                />
              </div>
            </div>
            <div>
              <label className="label">Default Markup (%)</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('default_markup_pct')}
                  type="number"
                  className="input pl-10"
                  placeholder="30"
                />
              </div>
            </div>
            <div>
              <label className="label">Currency</label>
              <select {...register('currency')} className="input">
                <option value="ZAR">ZAR - South African Rand</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>
            <div>
              <label className="label">Currency Symbol</label>
              <input
                {...register('currency_symbol')}
                className="input"
                placeholder="R"
              />
            </div>
          </div>
        </div>

        {/* Quote Settings */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Quote Settings
          </h2>
          <div className="space-y-4">
            <div className="w-48">
              <label className="label">Quote Validity (days)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  {...register('quote_validity_days')}
                  type="number"
                  className="input pl-10"
                  placeholder="30"
                />
              </div>
            </div>
            <div>
              <label className="label">Default Terms & Conditions</label>
              <textarea
                {...register('quote_terms')}
                className="input min-h-[100px]"
                placeholder="Payment due within 30 days of acceptance..."
              />
            </div>
            <div>
              <label className="label">Default Quote Notes</label>
              <textarea
                {...register('quote_notes')}
                className="input min-h-[80px]"
                placeholder="Additional notes to appear on quotes..."
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={saving || !isDirty}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}