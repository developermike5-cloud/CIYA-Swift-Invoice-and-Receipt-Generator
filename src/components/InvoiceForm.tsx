import React, { useRef, useEffect } from 'react';
import { Plus, Trash2, Upload, X, Eraser, ChevronDown, Sparkles } from 'lucide-react';
import SignaturePad from 'signature_pad';
import { InvoiceData, InvoiceItem } from '../types';
import { cn } from '../lib/utils';

interface InvoiceFormProps {
  data: InvoiceData;
  onChange: (data: InvoiceData) => void;
  children?: React.ReactNode;
}

export default function InvoiceForm({ data, onChange, children }: InvoiceFormProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const dataRef = useRef(data);

  // Update ref on every render to avoid closure staleness in useEffect
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      
      // Set dimensions first
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);

      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
        minWidth: 1,
        maxWidth: 2.5
      });

      signaturePadRef.current.addEventListener('endStroke', () => {
        saveSignature();
      });

      signaturePadRef.current.clear();
    }

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    const newItems = data.items.map((item) => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.total = Number(updatedItem.quantity) * Number(updatedItem.unitPrice);
        }
        return updatedItem;
      }
      return item;
    });
    onChange({ ...data, items: newItems });
  };

  const handleItemImageUpload = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItems = data.items.map((item) => 
          item.id === id ? { ...item, image: reader.result as string } : item
        );
        onChange({ ...data, items: newItems });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeItemImage = (id: string) => {
    const newItems = data.items.map((item) => 
      item.id === id ? { ...item, image: undefined } : item
    );
    onChange({ ...data, items: newItems });
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    onChange({ ...data, items: [...data.items, newItem] });
  };

  const removeItem = (id: string) => {
    if (data.items.length === 1) return;
    onChange({ ...data, items: data.items.filter((item) => item.id !== id) });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ ...data, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (field: 'logo' | 'signature') => {
    onChange({ ...data, [field]: undefined });
  };

  const saveSignature = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      onChange({ ...dataRef.current, signature: signaturePadRef.current.toDataURL('image/png') });
    }
  };

  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      onChange({ ...data, signature: undefined });
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Document Type & Template */}
      <section className="space-y-6">
        <h3 className="text-base font-black uppercase tracking-[0.2em] text-blue-600/80 underline underline-offset-8">Document Type & Template</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div>
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Select Type</label>
            <div className="flex p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <button
                onClick={() => {
                  const defaultNote = `Payment is expected within 7 days. Thank you for choosing ${data.businessName || 'our business'}. We appreciate your trust.`;
                  onChange({ 
                    ...data, 
                    type: 'invoice', 
                    number: data.number.replace('REC', 'INV'),
                    notes: defaultNote
                  });
                }}
                className={cn(
                  "flex-1 py-4 text-base font-black rounded-xl transition-all uppercase tracking-widest",
                  data.type === 'invoice' ? "bg-blue-600 text-white shadow-lg scale-[1.02]" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                Invoice
              </button>
              <button
                onClick={() => {
                  const defaultNote = `Payment received with thanks. ${data.businessName || 'our business'} values your patronage! Keep this receipt for your records. We look forward to seeing you again soon!`;
                  onChange({ 
                    ...data, 
                    type: 'receipt', 
                    number: data.number.replace('INV', 'REC'),
                    notes: defaultNote
                  });
                }}
                className={cn(
                  "flex-1 py-4 text-base font-black rounded-xl transition-all uppercase tracking-widest",
                  data.type === 'receipt' ? "bg-blue-600 text-white shadow-lg scale-[1.02]" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                Receipt
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Select Template Style</label>
            <div className="relative">
              <select
                value={data.template}
                onChange={(e) => onChange({ ...data, template: e.target.value as any })}
                className="w-full px-6 py-5 bg-white border border-slate-200 rounded-2xl text-base text-slate-900 font-black focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer pr-12 shadow-sm"
              >
                <option value="minimal">Minimalist Blue</option>
                <option value="corporate">Corporate Dark</option>
                <option value="elegant">Elegant Serif</option>
                <option value="modern">Modern Gradient</option>
                <option value="playful">Playful Yellow</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown size={20} className="text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {children && (
        <section className="space-y-6 pt-4 pb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black uppercase tracking-[0.2em] text-blue-600/80 underline underline-offset-8">Live Interactive Preview</h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full uppercase tracking-widest hidden sm:inline-block">Click text/images to edit</span>
          </div>
          <div className="w-full flex justify-center">
            {children}
          </div>
        </section>
      )}

      {/* Business Info */}
      <section className="space-y-10">
        <h3 className="text-base font-black uppercase tracking-[0.2em] text-blue-600/80 underline underline-offset-8">Business Details</h3>
        
        {/* Logo at Top */}
        <div className="flex justify-center mb-10">
          <div className="w-48 h-48 relative group">
            {data.logo ? (
              <div className="w-full h-full relative rounded-3xl overflow-hidden border border-slate-200 bg-white p-3 shadow-sm">
                <img src={data.logo} alt="Logo" className="w-full h-full object-contain" />
                <button
                  onClick={() => removeFile('logo')}
                  className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full transition-all hover:scale-110 shadow-lg z-10"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <Upload size={32} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                <span className="text-sm font-bold mt-4 text-slate-500 group-hover:text-blue-600 uppercase tracking-widest">Logo</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo')} />
              </label>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <input
            type="text"
            name="businessName"
            placeholder="Business Name"
            value={data.businessName || ''}
            onChange={handleInputChange}
            className="w-full px-0 py-3 text-3xl font-black bg-transparent border-b-2 border-slate-200 focus:border-blue-600 text-slate-900 placeholder:text-slate-400 outline-none transition-all"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Phone</label>
              <input
                type="text"
                name="businessPhone"
                placeholder="Business Phone"
                value={data.businessPhone || ''}
                onChange={handleInputChange}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-base text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Email</label>
              <input
                type="email"
                name="businessEmail"
                placeholder="Business Email"
                value={data.businessEmail || ''}
                onChange={handleInputChange}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-base text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Address</label>
            <textarea
              name="businessAddress"
              placeholder="Business Address"
              value={data.businessAddress || ''}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-5 py-4 text-base bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400 outline-none resize-none transition-all shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* Bank Details (Only for Invoice) */}
      {data.type === 'invoice' && (
        <section className="space-y-6 p-8 bg-blue-50/50 rounded-3xl border border-blue-100/50">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">Business Bank Details</h3>
            <div className="px-3 py-1 bg-blue-600 text-[10px] text-white font-bold rounded-full uppercase tracking-tighter">Required for Transfer</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Bank Name</label>
              <input
                type="text"
                name="bankName"
                placeholder="e.g. GTBank, Zenith"
                value={data.bankName || ''}
                onChange={handleInputChange}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Account Name</label>
              <input
                type="text"
                name="accountName"
                placeholder="Business Account Name"
                value={data.accountName || ''}
                onChange={handleInputChange}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Account Number</label>
              <input
                type="text"
                name="accountNumber"
                placeholder="0000000000"
                value={data.accountNumber || ''}
                onChange={handleInputChange}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
          </div>
        </section>
      )}

      {/* Customer Info */}
      <section className="space-y-6">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-600/80 underline underline-offset-8">Bill To</h3>
        <div className="space-y-6">
          <input
            type="text"
            name="customerName"
            placeholder="Customer Name"
            value={data.customerName || ''}
            onChange={handleInputChange}
            className="w-full px-0 py-3 text-2xl font-bold bg-transparent border-b border-slate-200 focus:border-blue-600 text-slate-900 placeholder:text-slate-400 outline-none transition-all"
          />
          <textarea
            name="customerAddress"
            placeholder="Customer Address"
            value={data.customerAddress || ''}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-5 py-4 text-base bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400 outline-none resize-none transition-all shadow-sm"
          />
        </div>
      </section>

      {/* Meta Info */}
      <section className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">
            {data.type === 'invoice' ? 'Invoice' : 'Receipt'} Number
          </label>
          <input
            type="text"
            name="number"
            value={data.number || ''}
            onChange={handleInputChange}
            className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Date</label>
          <input
            type="date"
            name="date"
            value={data.date || ''}
            onChange={handleInputChange}
            className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
      </section>

      {/* Items */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-600/80 underline underline-offset-8">Items</h3>
          <button
            onClick={addItem}
            className="flex items-center gap-3 px-6 py-3 text-sm font-black text-blue-600 hover:text-blue-700 bg-blue-50 rounded-full border border-blue-100 transition-all hover:scale-105 active:scale-95 uppercase tracking-widest shadow-sm"
          >
            <Plus size={20} /> Add Item
          </button>
        </div>
        <div className="space-y-8">
          {data.items.map((item) => (
            <div key={item.id} className="space-y-4 p-4 bg-white rounded-2xl border border-slate-200 group relative shadow-sm">
              <button
                onClick={() => removeItem(item.id)}
                className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all hover:scale-110 z-10 shadow-lg"
              >
                <X size={14} />
              </button>
              
              <div className="flex gap-4">
                {/* Item Image */}
                <div className="w-20 h-20 shrink-0 relative group/img">
                  {item.image ? (
                    <div className="w-full h-full relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={item.image} alt="Item" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeItemImage(item.id)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full transition-all shadow-lg z-10"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                      <Upload size={16} className="text-slate-400" />
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleItemImageUpload(e, item.id)} />
                    </label>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    placeholder="Item Name"
                    value={item.name || ''}
                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                    className="w-full px-0 py-1 font-bold bg-transparent border-b border-slate-100 focus:border-blue-600 text-slate-900 outline-none"
                  />
                  <textarea
                    placeholder="Description (Optional)"
                    value={item.description || ''}
                    onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                    rows={1}
                    className="w-full px-0 py-1 text-xs bg-transparent border-b border-slate-100 focus:border-blue-600 text-slate-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pb-2">
                <div>
                  <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Quantity</label>
                  <input
                    type="number"
                    value={item.quantity ?? 1}
                    onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 px-1 text-blue-600">Price per Item ({data.currency === 'NGN' ? '₦' : data.currency === 'USD' ? '$' : data.currency === 'EUR' ? '€' : data.currency === 'GBP' ? '£' : data.currency === 'INR' ? '₹' : data.currency})</label>
                  <input
                    type="number"
                    value={item.unitPrice ?? 0}
                    onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {item.quantity > 1 && (
                <div className="px-1 flex justify-end">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Item Total: {data.currency === 'NGN' ? '₦' : data.currency === 'USD' ? '$' : data.currency === 'EUR' ? '€' : data.currency === 'GBP' ? '£' : data.currency === 'INR' ? '₹' : data.currency}{item.total.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Totals & Extra */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-slate-200">
        <div className="space-y-8">
          {data.type === 'receipt' && (
            <div className="relative">
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Payment Method</label>
              <div className="relative">
                <select
                  name="paymentMethod"
                  value={data.paymentMethod || 'Transfer'}
                  onChange={handleInputChange}
                  className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer pr-12 shadow-sm"
                >
                  <option value="Cash">Cash</option>
                  <option value="Transfer">Bank Transfer</option>
                  <option value="POS">POS / Card</option>
                  <option value="Cryptocurrency">Cryptocurrency</option>
                </select>
                <ChevronDown size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
          
          {/* Signature Canvas */}
          <div className="max-w-[220px] mr-auto">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest text-[10px]">Draw Signature</label>
              <button 
                onClick={clearSignature}
                className="text-[10px] font-black text-red-500 flex items-center gap-1 hover:text-red-600 transition-colors"
              >
                <Eraser size={14} /> Clear
              </button>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden h-28 border border-slate-200 shadow-inner">
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair touch-none"
                width={220}
                height={112}
              />
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest">Discount (%)</label>
            <input
              type="number"
              name="discount"
              value={data.discount ?? 0}
              onChange={handleInputChange}
              className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-xl text-slate-900 font-black focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            />
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest">Currency</label>
            <div className="relative">
              <select
                name="currency"
                value={data.currency || 'NGN'}
                onChange={handleInputChange}
                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-lg text-slate-900 font-black focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer pr-12 shadow-sm"
              >
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
              <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="space-y-10">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Notes</label>
          <div className="relative group/templates">
            <select
              defaultValue=""
              onChange={(e) => {
                const template = e.target.value;
                if (template) {
                  onChange({ ...data, notes: template });
                }
                e.target.value = "";
              }}
              className="pl-12 pr-6 py-3.5 text-sm font-black text-blue-600 bg-blue-50 border border-blue-100 rounded-full cursor-pointer hover:bg-blue-100 transition-all outline-none appearance-none uppercase tracking-widest shadow-sm"
            >
              <option value="" disabled>✨ Magic {data.type === 'invoice' ? 'Invoice' : 'Receipt'} Notes</option>
              {data.type === 'invoice' ? (
                <>
                  <option value={`Payment is expected within 7 days. Thank you for choosing ${data.businessName || 'our business'}. We appreciate your trust.`}>Professional & Direct (Default)</option>
                  <option value={`It was a pleasure serving you! At ${data.businessName || 'our business'}, we value your trust. Please settle the payment to help us continue providing top-tier service. Refer a friend and get 5% off your next order!`}>Marketing & Referral</option>
                  <option value={`Your order is ready! Complete your payment to ${data.businessName || 'our business'} to finalize delivery. Join our VIP list today for exclusive professional updates and early access to sales!`}>Urgent & Persuasive</option>
                </>
              ) : (
                <>
                  <option value={`Payment received with thanks. ${data.businessName || 'our business'} values your patronage! Keep this receipt for your records. We look forward to seeing you again soon!`}>Professional & Direct (Default)</option>
                  <option value={`Thank you for your purchase from ${data.businessName || 'our business'}! You've just made a great investment. Remember to tag us on social media for a chance to be featured on our page!`}>Growth & Engagement</option>
                  <option value={`Transaction successful. At ${data.businessName || 'our business'}, we don't just sell, we build lasting relationships. Thank you for being a part of our journey!`}>Branding & Connection</option>
                </>
              )}
            </select>
            <Sparkles size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
          </div>
        </div>
        <textarea
          name="notes"
          placeholder="Payment terms, thank you message, etc."
          value={data.notes || ''}
          onChange={handleInputChange}
          rows={4}
          className="w-full px-6 py-5 text-base bg-white rounded-3xl border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400 outline-none resize-none transition-all shadow-sm"
        />
        
        {/* Tutorial Video */}
        <div className="w-full aspect-video rounded-3xl overflow-hidden border border-slate-200 shadow-sm mt-8">
          <p className="text-xs font-bold text-center py-2 bg-slate-50 uppercase tracking-widest text-slate-500">Video Guide: How to use Swift Invoice</p>
          <iframe 
            width="100%" 
            height="100%" 
            src="https://www.youtube.com/embed/umOOmKBJwwE?si=zRfiE4X8CjGjvKLY" 
            title="How to Use Swift Invoice Guide" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
          ></iframe>
        </div>
      </section>
    </div>
  );
}
