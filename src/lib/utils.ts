import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'NGN') {
  const locale = currency === 'NGN' ? 'en-NG' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function generateInvNumber(type: 'invoice' | 'receipt' = 'invoice') {
  const prefix = type === 'invoice' ? 'INV' : 'REC';
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${random}`;
}
