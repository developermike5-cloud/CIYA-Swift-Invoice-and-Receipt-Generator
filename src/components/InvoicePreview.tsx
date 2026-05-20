import React, { useState, useEffect, createContext, useContext } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { InvoiceData } from '../types';
import { cn, formatCurrency } from '../lib/utils';

interface InvoicePreviewProps {
  data: InvoiceData;
  onChange?: (data: InvoiceData) => void;
  isExportMode?: boolean;
}

const PreviewContext = createContext(false);

const EditableText = ({ 
  value, 
  onChange, 
  as: Component = 'span', 
  className, 
  placeholder, 
  multiline
}: any) => {
  const isExportMode = useContext(PreviewContext);
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  
  useEffect(() => { setTempValue(value) }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (tempValue !== value && onChange) onChange(tempValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
    }
  };

  if (!onChange || isExportMode) {
    if (isExportMode && !value) return null;
    return <Component className={className}>{value || placeholder}</Component>;
  }

  if (isEditing) {
    const Editor = multiline ? 'textarea' : 'input';
    return (
      <Editor
        autoFocus
        value={tempValue}
        onChange={(e: any) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "bg-transparent outline-none ring-2 ring-blue-500 rounded p-0 m-0 w-full text-inherit font-inherit leading-inherit tracking-inherit text-slate-800", 
          className
        )}
        style={{ resize: 'none' }}
        rows={multiline ? (tempValue?.split('\n').length || 1) : undefined}
      />
    );
  }

  return (
    <Component
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-text hover:ring-2 hover:ring-blue-400/50 hover:bg-blue-400/10 rounded transition-all min-w-[20px] inline-block", 
        className, 
        !value && "opacity-50"
      )}
    >
      {value || placeholder}
    </Component>
  );
};

const EditableImage = ({ src, placeholder, onChange, onRemove, className, containerClassName }: any) => {
  const isExportMode = useContext(PreviewContext);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onChange && onChange(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (!onChange || isExportMode) {
    return src ? <img src={src} className={className} alt="" /> : null;
  }

  return (
    <div className={cn("relative group cursor-pointer inline-block", containerClassName)}>
      {src ? (
        <>
           <img src={src} className={className} alt="" />
           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-[inherit]">
             <label className="p-2 bg-white/20 hover:bg-white/40 rounded-full cursor-pointer text-white">
               <Upload size={16} />
               <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
             </label>
             <button onClick={onRemove} className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white">
               <Trash2 size={16} />
             </button>
           </div>
        </>
      ) : (
        <label className={cn("flex flex-col items-center justify-center border-2 border-dashed border-gray-400 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer rounded-[inherit] bg-white text-gray-400", className)}>
          <Upload size={24} className="text-gray-400" />
          <span className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-widest">{placeholder}</span>
          <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
        </label>
      )}
    </div>
  )
};

export default function InvoicePreview({ data, onChange, isExportMode }: InvoicePreviewProps) {
  const subtotal = data.items.reduce((acc, item) => acc + item.total, 0);
  const discountAmount = (subtotal * (data.discount || 0)) / 100;
  const total = subtotal - discountAmount;

  const isInvoice = data.type === 'invoice';

  const getTemplateStyles = () => {
    switch (data.template) {
      case 'corporate':
        return {
          header: 'bg-pdf-slate-900 text-white p-12',
          accent: 'text-pdf-slate-900',
          border: 'border-pdf-slate-800',
          tableHeader: 'bg-pdf-slate-900 text-white',
          font: 'font-sans',
          footer: 'bg-pdf-slate-50 p-8 border-t border-pdf-slate-200'
        };
      case 'elegant':
        return {
          header: 'bg-white text-pdf-stone-900 p-12 border-b-8 border-pdf-stone-900',
          accent: 'text-pdf-stone-900',
          border: 'border-pdf-stone-900',
          tableHeader: 'bg-transparent border-b-2 border-pdf-stone-900 text-pdf-stone-900',
          font: 'font-serif',
          footer: 'bg-white p-8 border-t-2 border-pdf-stone-100'
        };
      case 'modern':
        return {
          header: 'bg-pdf-slate-900 text-white p-12',
          accent: 'text-pdf-blue-600',
          border: 'border-pdf-slate-800',
          tableHeader: 'bg-pdf-slate-900 text-white',
          font: 'font-sans',
          footer: 'bg-pdf-slate-900 text-white p-8'
        };
      case 'playful':
        return {
          header: 'bg-pdf-yellow-400 text-pdf-gray-900 p-12 rounded-br-[5rem]',
          accent: 'text-pdf-yellow-600',
          border: 'border-pdf-yellow-600',
          tableHeader: 'bg-pdf-yellow-100 text-pdf-yellow-800',
          font: 'font-sans',
          footer: 'bg-pdf-yellow-50 p-8'
        };
      default: // minimal
        return {
          header: 'bg-pdf-blue-600 text-white p-12 rounded-b-[3rem]',
          accent: 'text-pdf-blue-600',
          border: 'border-pdf-gray-800',
          tableHeader: 'bg-pdf-blue-50 text-pdf-blue-700',
          font: 'font-sans',
          footer: 'bg-white p-8'
        };
    }
  };

  const styles = getTemplateStyles();

  return (
    <PreviewContext.Provider value={isExportMode || false}>
      <div id="invoice-preview" className={cn("w-full bg-white min-h-[1123px] flex flex-col text-pdf-gray-800", styles.font)}>
      {/* Header */}
      <div className={cn("w-full relative overflow-hidden", styles.header)}>
        {/* Subtle Background Text */}
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none select-none">
          <h2 className="text-9xl font-black tracking-tighter leading-none">
            {isInvoice ? 'INVOICE' : 'RECEIPT'}
          </h2>
        </div>

        <div className={cn(
          "relative z-10 flex w-full pl-6",
          data.template === 'elegant' ? "flex-col items-center gap-10" : "flex-row justify-between items-start gap-12"
        )}>
          {/* Business Branding */}
          <div className={cn("flex flex-col gap-8", data.template === 'elegant' ? "items-center" : "items-start max-w-[60%]")}>
            <EditableImage 
              src={data.logo}
              placeholder="Upload Logo"
              onChange={(logo: string) => onChange && onChange({ ...data, logo })}
              onRemove={() => onChange && onChange({ ...data, logo: undefined })}
              className="h-24 w-24 object-cover rounded-full border-2 border-pdf-white-20 pdf-shadow"
            />
            <div className={cn("space-y-3", data.template === 'elegant' ? "text-center" : "text-left")}>
              <EditableText
                as="h1"
                value={data.businessName}
                placeholder="YOUR BUSINESS"
                onChange={(businessName: string) => onChange && onChange({ ...data, businessName })}
                className="text-4xl font-black tracking-tight uppercase leading-none"
              />
              <div className="text-lg opacity-90 font-medium space-y-2 flex flex-col">
                <EditableText
                  as="p"
                  value={data.businessPhone}
                  placeholder="Business Phone"
                  onChange={(businessPhone: string) => onChange && onChange({ ...data, businessPhone })}
                  className="text-xl"
                />
                <EditableText
                  as="p"
                  value={data.businessEmail}
                  placeholder="Business Email"
                  onChange={(businessEmail: string) => onChange && onChange({ ...data, businessEmail })}
                  className="text-xl"
                />
                <EditableText
                  as="p"
                  multiline
                  value={data.businessAddress}
                  placeholder="Business Address"
                  onChange={(businessAddress: string) => onChange && onChange({ ...data, businessAddress })}
                  className="text-2xl whitespace-pre-line leading-relaxed font-bold"
                />
              </div>
            </div>
          </div>

          {/* Document Meta Info */}
          <div className={cn(
            "flex flex-col gap-8",
            data.template === 'elegant' ? "items-center" : "items-end text-right"
          )}>
            <div className={cn(
              "px-10 py-5 rounded-2xl font-black text-lg tracking-widest uppercase text-center",
              data.template === 'minimal' ? "bg-white text-pdf-blue-600 pdf-shadow" : 
              data.template === 'modern' ? "bg-pdf-white-20 border border-pdf-white-30" :
              data.template === 'elegant' ? "border-2 border-pdf-stone-900" : "bg-pdf-white-10"
            )}>
              {isInvoice ? 'INVOICE' : 'RECEIPT'}
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2 flex flex-col items-end">
                <p className="text-sm font-black opacity-60 uppercase tracking-[0.2em]">Document No.</p>
                <div className="flex items-center text-3xl font-black tracking-tight">
                  #<EditableText
                    value={data.number}
                    placeholder="001"
                    onChange={(number: string) => onChange && onChange({ ...data, number })}
                  />
                </div>
              </div>

              <div className="space-y-2 flex flex-col items-end">
                <p className="text-sm font-black opacity-60 uppercase tracking-[0.2em]">Issue Date</p>
                <EditableText
                  as="p"
                  value={data.date}
                  placeholder="Apr 16, 2026"
                  onChange={(date: string) => onChange && onChange({ ...data, date })}
                  className="text-xl font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-12 pl-16 flex-1 flex flex-col">
        {/* Bill To */}
        <div className={cn("mb-16 flex justify-between items-end pb-8 border-b", styles.border)}>
          <div className="flex flex-col items-start w-full max-w-sm">
            <h3 className={cn("text-sm font-black uppercase tracking-[0.3em] mb-4 w-full", styles.accent)}>
              {isInvoice ? 'BILLING TO' : 'CUSTOMER DETAILS'}
            </h3>
            <div className="space-y-2 w-full flex flex-col items-start">
              <EditableText
                as="p"
                value={data.customerName}
                placeholder="Client Name"
                onChange={(customerName: string) => onChange && onChange({ ...data, customerName })}
                className="font-black text-4xl tracking-tight w-full max-w-sm"
              />
              <EditableText
                as="p"
                multiline
                value={data.customerAddress}
                placeholder="Client Address"
                onChange={(customerAddress: string) => onChange && onChange({ ...data, customerAddress })}
                className="text-2xl text-pdf-gray-500 whitespace-pre-line leading-relaxed font-bold w-full max-w-sm"
              />
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-pdf-gray-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-xl font-bold text-pdf-green-600 uppercase tracking-widest">Confirmed</p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1">
          <table className={cn("w-full text-left border-collapse border-2", styles.border)}>
            <thead>
              <tr className={cn("text-sm font-black uppercase tracking-[0.2em] border-b-2", styles.tableHeader, styles.border)}>
                <th className={cn("py-6 px-6 border-r-2", styles.border)}>Description</th>
                <th className={cn("py-6 px-6 text-center border-r-2", styles.border)}>Qty</th>
                <th className={cn("py-6 px-6 text-right border-r-2", styles.border)}>Price</th>
                <th className="py-6 px-6 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={item.id || index} className={cn("group border-b-2", styles.border)}>
                  <td className={cn("py-8 px-6 border-r-2", styles.border)}>
                    <div className="flex items-center gap-6">
                      <EditableImage
                        src={item.image}
                        placeholder="Image"
                        onChange={(image: string) => {
                          if (!onChange) return;
                          const newItems = [...data.items];
                          newItems[index] = { ...newItems[index], image };
                          onChange({ ...data, items: newItems });
                        }}
                        onRemove={() => {
                          if (!onChange) return;
                          const newItems = [...data.items];
                          newItems[index] = { ...newItems[index], image: undefined };
                          onChange({ ...data, items: newItems });
                        }}
                        className="w-20 h-20 rounded-xl overflow-hidden border-2 border-pdf-gray-200 shrink-0 object-cover"
                      />
                      <div className="flex-1">
                        <EditableText
                          as="p"
                          value={item.name}
                          placeholder="Item Name"
                          onChange={(name: string) => {
                            if (!onChange) return;
                            const newItems = [...data.items];
                            newItems[index] = { ...newItems[index], name };
                            onChange({ ...data, items: newItems });
                          }}
                          className="font-bold text-2xl text-pdf-gray-900 w-full"
                        />
                        <EditableText
                          as="p"
                          multiline
                          value={item.description}
                          placeholder="Item Description"
                          onChange={(description: string) => {
                            if (!onChange) return;
                            const newItems = [...data.items];
                            newItems[index] = { ...newItems[index], description };
                            onChange({ ...data, items: newItems });
                          }}
                          className="text-lg text-pdf-gray-400 mt-1 leading-relaxed w-full"
                        />
                      </div>
                    </div>
                  </td>
                  <td className={cn("py-8 px-6 text-center text-xl font-medium text-pdf-gray-600 border-r-2", styles.border)}>
                    <EditableText
                      value={item.quantity.toString()}
                      placeholder="0"
                      onChange={(qty: string) => {
                        if (!onChange) return;
                        const quantity = Number(qty) || 0;
                        const newItems = [...data.items];
                        newItems[index] = { ...newItems[index], quantity, total: quantity * newItems[index].unitPrice };
                        onChange({ ...data, items: newItems });
                      }}
                      className="w-16 text-center"
                    />
                  </td>
                  <td className={cn("py-8 px-6 text-right text-xl font-medium text-pdf-gray-600 border-r-2", styles.border)}>
                    {data.currency}
                    <EditableText
                      value={item.unitPrice.toString()}
                      placeholder="0"
                      onChange={(priceStr: string) => {
                        if (!onChange) return;
                        const unitPrice = Number(priceStr) || 0;
                        const newItems = [...data.items];
                        newItems[index] = { ...newItems[index], unitPrice, total: newItems[index].quantity * unitPrice };
                        onChange({ ...data, items: newItems });
                      }}
                      className="w-24 text-right inline-block ml-1"
                    />
                  </td>
                  <td className="py-8 px-6 text-right text-2xl font-black text-pdf-gray-900">{formatCurrency(item.total, data.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="mt-16 flex justify-end">
          <div className="w-full max-w-sm space-y-6 mr-10 pb-10">
            <div className="flex justify-between text-xl font-bold text-pdf-gray-500 uppercase tracking-widest">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, data.currency)}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between text-xl font-bold text-pdf-red-500 uppercase tracking-widest">
                <span>Discount ({data.discount}%)</span>
                <span>-{formatCurrency(discountAmount, data.currency)}</span>
              </div>
            )}
            <div className={cn("pt-8 border-t-8 flex justify-between items-center", styles.border)}>
              <span className="text-base font-black uppercase tracking-[0.3em]">Total Amount</span>
              <span className={cn("text-6xl font-black tracking-tighter", styles.accent)}>
                {formatCurrency(total, data.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={cn("space-y-12", styles.footer)}>
        {isInvoice && data.accountNumber && (
          <div className={cn(
            "p-10 rounded-[3rem] border flex flex-col items-center text-center space-y-8 pdf-shadow-sm",
            data.template === 'modern' ? "bg-pdf-white-10 border-pdf-white-20" : "bg-pdf-blue-50/50 border-pdf-blue-100"
          )}>
            <h4 className={cn(
              "text-base font-black uppercase tracking-[0.4em]",
              data.template === 'modern' ? "text-pdf-blue-400" : "text-pdf-blue-600"
            )}>Direct Bank Transfer Details</h4>
            <div className="flex flex-wrap justify-center gap-x-20 gap-y-10 w-full">
              <div className="space-y-2 flex flex-col items-center">
                <p className="text-xs font-black text-pdf-gray-400 uppercase tracking-widest text-center">Bank Name</p>
                <EditableText
                  as="p"
                  value={data.bankName}
                  placeholder="Bank Name"
                  onChange={(bankName: string) => onChange && onChange({ ...data, bankName })}
                  className={cn("text-3xl font-black tracking-tight text-center", data.template === 'modern' ? "text-white" : "text-pdf-gray-900")}
                />
              </div>
              <div className="space-y-2 flex flex-col items-center">
                <p className="text-xs font-black text-pdf-gray-400 uppercase tracking-widest text-center">Account Name</p>
                <EditableText
                  as="p"
                  value={data.accountName}
                  placeholder="Account Name"
                  onChange={(accountName: string) => onChange && onChange({ ...data, accountName })}
                  className={cn("text-3xl font-black tracking-tight text-center", data.template === 'modern' ? "text-white" : "text-pdf-gray-900")}
                />
              </div>
              <div className="space-y-2 flex flex-col items-center">
                <p className="text-xs font-black text-pdf-gray-400 uppercase tracking-widest text-center">Account Number</p>
                <EditableText
                  as="p"
                  value={data.accountNumber}
                  placeholder="Account Number"
                  onChange={(accountNumber: string) => onChange && onChange({ ...data, accountNumber })}
                  className={cn("text-5xl font-black tracking-tighter tabular-nums text-center", data.template === 'modern' ? "text-pdf-blue-400" : "text-pdf-blue-600")}
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-16 pt-6 pl-10">
          <div className="space-y-10">
            {!isInvoice && (
              <div className="flex flex-col items-start">
                <h4 className="text-sm font-black text-pdf-gray-400 uppercase tracking-widest mb-3">Payment Info</h4>
                <EditableText
                  as="p"
                  value={data.paymentMethod}
                  placeholder="Payment Method"
                  onChange={(paymentMethod: string) => onChange && onChange({ ...data, paymentMethod })}
                  className="text-xl font-bold text-pdf-gray-900 max-w-sm"
                />
              </div>
            )}
            <div className="flex flex-col items-start">
              <h4 className="text-sm font-black text-pdf-gray-400 uppercase tracking-widest mb-3">Notes</h4>
              <EditableText
                as="p"
                multiline
                value={data.notes}
                placeholder="Add Notes"
                onChange={(notes: string) => onChange && onChange({ ...data, notes })}
                className="text-lg text-pdf-gray-700 leading-relaxed font-bold italic w-full max-w-sm"
              />
            </div>
          </div>
          <div className="flex flex-col items-end justify-end">
            {data.signature && (
              <div className="text-center">
                <img src={data.signature} alt="Signature" className="h-28 w-auto object-contain mb-3" />
                <div className="w-64 h-px bg-pdf-gray-200 mb-3" />
                <p className="text-sm font-black text-pdf-gray-600 uppercase tracking-widest">Authorized Signature</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 pt-6 text-center bg-white">
        <p className="text-xs font-black text-pdf-gray-900 uppercase tracking-[0.4em]">
          {isInvoice ? 'SWIFTINVOICE' : 'SWIFTRECEIPT'} • PROFESSIONAL DOCUMENT • POWERED BY CIYA
        </p>
      </div>
    </div>
    </PreviewContext.Provider>
  );
}
