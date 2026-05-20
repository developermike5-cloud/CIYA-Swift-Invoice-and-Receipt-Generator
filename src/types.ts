export type DocumentType = 'invoice' | 'receipt';

export type TemplateStyle = 'minimal' | 'corporate' | 'elegant' | 'modern' | 'playful';

export interface InvoiceItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  type: DocumentType;
  template: TemplateStyle;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  customerName: string;
  customerAddress: string;
  number: string;
  date: string;
  items: InvoiceItem[];
  discount: number;
  tax: number;
  paymentMethod: string;
  notes: string;
  logo?: string;
  signature?: string;
  currency: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}

export const DEFAULT_INVOICE: InvoiceData = {
  type: 'invoice',
  template: 'minimal',
  businessName: '',
  businessAddress: '',
  businessPhone: '',
  businessEmail: '',
  customerName: '',
  customerAddress: '',
  number: '',
  date: new Date().toISOString().split('T')[0],
  items: [
    { id: '1', name: '', quantity: 1, unitPrice: 0, total: 0 }
  ],
  discount: 0,
  tax: 0,
  paymentMethod: 'Transfer',
  notes: '',
  currency: 'NGN',
  bankName: '',
  accountName: '',
  accountNumber: '',
};
