import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, Share2, MessageCircle, FileText, CheckCircle2, RotateCcw, ChevronDown, BookOpen, Users, BarChart3, Eye, ExternalLink, Smartphone, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2pdf from 'html2pdf.js';
import InvoiceForm from './components/InvoiceForm';
import InvoicePreview from './components/InvoicePreview';
import Modal from './components/Modal';
import { DEFAULT_INVOICE, InvoiceData } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { cn, generateInvNumber } from './lib/utils';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, onSnapshot, updateDoc, increment, serverTimestamp, setDoc, getDoc, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';

async function sanitizeStylesheets() {
  const restoredStyles: { element: HTMLStyleElement; text: string }[] = [];
  const restoredLinks: { element: HTMLLinkElement; tempStyle?: HTMLStyleElement }[] = [];

  // 1. Process inline <style> elements
  document.querySelectorAll('style').forEach((styleEl) => {
    const text = styleEl.textContent || '';
    if (text.includes('oklch') || text.includes('oklab')) {
      restoredStyles.push({ element: styleEl, text });
      styleEl.textContent = text.replace(/oklch/g, 'rgb').replace(/oklab/g, 'rgb');
    }
  });

  // 2. Process external <link> elements (same-origin only to avoid CORS exceptions)
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
  for (const link of links) {
    if (!link.href) continue;
    
    const isSameOrigin = link.href.startsWith(window.location.origin) || !link.href.startsWith('http');
    if (isSameOrigin) {
      try {
        const response = await fetch(link.href);
        if (response.ok) {
          const cssText = await response.text();
          if (cssText.includes('oklch') || cssText.includes('oklab')) {
            const tempStyle = document.createElement('style');
            tempStyle.textContent = cssText.replace(/oklch/g, 'rgb').replace(/oklab/g, 'rgb');
            document.head.appendChild(tempStyle);
            
            link.disabled = true;
            restoredLinks.push({ element: link, tempStyle });
          }
        }
      } catch (err) {
        console.warn('Failed to sanitize link stylesheet:', link.href, err);
      }
    }
  }

  // Return restore function
  return () => {
    for (const item of restoredStyles) {
      item.element.textContent = item.text;
    }
    for (const item of restoredLinks) {
      item.element.disabled = false;
      if (item.tempStyle) {
        item.tempStyle.remove();
      }
    }
  };
}

export default function App() {
  const [data, setData] = useLocalStorage<InvoiceData>('swift-invoice-data', {
    ...DEFAULT_INVOICE,
    number: `INV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeModal, setActiveModal] = useState<'how-to' | 'about' | 'stats' | null>(null);
  const [swappingText, setSwappingText] = useState('Invoice');
  const [stats, setStats] = useState({ invoiceDownloads: 0, receiptDownloads: 0 });
  const [isAdmin, setIsAdmin] = useLocalStorage('swift-admin-status', false);
  const [clickCount, setClickCount] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [generatedPdf, setGeneratedPdf] = useState<{ blob: Blob, url: string, name: string } | null>(null);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [isCapturingImage, setIsCapturingImage] = useState(false);
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [showCongratulation, setShowCongratulation] = useState(false);

  useEffect(() => {
    if (isAdmin && activeModal === 'stats') {
      const fetchHistory = async () => {
        try {
          const q = query(collection(db, 'exports_history'), orderBy('timestamp', 'desc'), limit(50));
          const snap = await getDocs(q);
          setExportHistory(snap.docs.map(d => ({id: d.id, ...d.data()})));
        } catch (e) {
          console.error("Could not fetch history:", e);
          handleFirestoreError(e, OperationType.LIST, 'exports_history');
        }
      };
      fetchHistory();
    }
  }, [isAdmin, activeModal]);

  useEffect(() => {
    return () => {
      if (generatedPdf?.url) {
        URL.revokeObjectURL(generatedPdf.url);
      }
    };
  }, [generatedPdf]);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleAdminClick = () => {
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    
    const newCount = clickCount + 1;
    if (newCount >= 5) {
      setIsAdmin(true);
      setClickCount(0);
      setActiveModal('stats');
      showToast('Admin Mode Activated!');
    } else {
      setClickCount(newCount);
      clickTimeoutRef.current = setTimeout(() => setClickCount(0), 1000);
    }
  };

  useEffect(() => {
    const statsRef = doc(db, 'stats', 'global');
    const unsubscribe = onSnapshot(statsRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setStats({
          invoiceDownloads: data.invoiceDownloads || 0,
          receiptDownloads: data.receiptDownloads || 0
        });
      } else {
        // Initialize if not exists
        setDoc(statsRef, {
          invoiceDownloads: 0,
          receiptDownloads: 0,
          updatedAt: serverTimestamp()
        }).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, 'stats/global');
        });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'stats/global');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSwappingText((prev) => (prev === 'Invoice' ? 'Receipt' : 'Invoice'));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Refresh number on mount to ensure dynamic behavior on reload
  useEffect(() => {
    setData(prev => ({
      ...prev,
      number: generateInvNumber(prev.type)
    }));
  }, []);

  const previewRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, duration: number = 3000) => {
    setToastMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), duration);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('invoice-preview');
    if (!element) return;

    setIsExporting(true);
    
    const filename = `${data.type === 'invoice' ? 'Invoice' : 'Receipt'}_${data.number || '001'}.pdf`;
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    let restoreStyles: (() => void) | null = null;
    try {
      restoreStyles = await sanitizeStylesheets();
      // Generate as Blob instead of direct save
      const blob = await html2pdf().set(opt).from(element).outputPdf('blob');
      const url = URL.createObjectURL(blob);
      
      setGeneratedPdf({ blob, url, name: filename });
      setShowExportModal(true);

      // Update Firebase Stats
      const statsRef = doc(db, 'stats', 'global');
      try {
        await updateDoc(statsRef, {
          [data.type === 'invoice' ? 'invoiceDownloads' : 'receiptDownloads']: increment(1),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'stats/global');
      }

      // Log History for Analytics
      try {
        await addDoc(collection(db, 'exports_history'), {
          type: data.type,
          businessName: data.businessName || 'N/A',
          customerName: data.customerName || 'N/A',
          number: data.number,
          date: new Date().toISOString(),
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error("Error logging history:", err);
        handleFirestoreError(err, OperationType.CREATE, 'exports_history');
      }

      showToast('PDF Prepared Successfully!');
    } catch (error) {
      console.error('PDF Generation Error:', error);
      showToast('Export failed. Please try again.');
    } finally {
      if (restoreStyles) restoreStyles();
      setIsExporting(false);
    }
  };

  const handleActionDownload = () => {
    if (!generatedPdf) return;
    const link = document.createElement('a');
    link.href = generatedPdf.url;
    link.download = generatedPdf.name;
    link.click();

    setShowCongratulation(true);
    setTimeout(() => {
      setShowCongratulation(false);
    }, 6000);
  };

  const handleActionView = () => {
    if (!generatedPdf) return;
    window.open(generatedPdf.url, '_blank');
  };

  const handleActionShareWhatsApp = async () => {
    const element = document.getElementById('invoice-preview');
    if (!element) return;

    setIsSharingWhatsApp(true);
    setIsCapturingImage(true);
    let restoreStyles: (() => void) | null = null;
    try {
      restoreStyles = await sanitizeStylesheets();
      // 1. Create a clean capture portal to avoid all parent styles/scaling/scroll
      const portal = document.createElement('div');
      portal.style.position = 'absolute';
      portal.style.top = '-9999px';
      portal.style.left = '-9999px';
      portal.style.width = '800px';
      portal.style.backgroundColor = 'white';
      portal.id = 'capture-portal';
      
      // 2. Clone the preview and strip UI-only styling
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.width = '800px';
      clone.style.boxShadow = 'none';
      clone.style.borderRadius = '0';
      clone.style.transition = 'none';
      clone.style.opacity = '1';
      clone.style.display = 'flex'; // Ensure flex layout remains
      clone.style.imageRendering = 'crisp-edges';
      (clone.style as any).webkitFontSmoothing = 'antialiased';
      clone.style.textRendering = 'optimizeLegibility';
      clone.removeAttribute('id'); // Avoid ID conflict
      
      portal.appendChild(clone);
      document.body.appendChild(portal);

      // 3. Small delay to ensure any images/fonts in the portal are ready
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(clone, {
        scale: 3, // High clarity while remaining within direct-share file size limits
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        imageTimeout: 0,
        // Force the capture viewport to the portal's dimensions
        width: 800,
        height: clone.scrollHeight,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      } as any);
      
      // Cleanup portal
      document.body.removeChild(portal);
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsSharingWhatsApp(false);
          setIsCapturingImage(false);
          return;
        }
        
        const fileName = `${data.type === 'invoice' ? 'Invoice' : 'Receipt'}_${data.number}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });

        // Include Notes in the share text
        const notesSection = data.notes ? `\n\nNotes: ${data.notes}` : '';
        const shareText = `Here is your ${data.type} from ${data.businessName || 'our business'}.${notesSection}`;

        // Primary: Native Share (This is the ONLY way to share an image + text directly into apps)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: fileName,
              text: shareText
            });
            showToast('Shared Successfully!');
          } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              // Fallback only if share fails
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = fileName;
              link.click();
              showToast('Sharing failed. Receipt downloaded.');
              setShowCongratulation(true);
              setTimeout(() => {
                setShowCongratulation(false);
              }, 6000);
            }
          }
        } else {
          // Fallback UI for browsers that don't support file sharing
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          
          const waMessage = encodeURIComponent(shareText + "\n\n(Image downloaded to your device, please attach it manually.)");
          window.open(`https://wa.me/?text=${waMessage}`, '_blank');
          showToast('Image saved. Please attach in WhatsApp.');
          setShowCongratulation(true);
          setTimeout(() => {
            setShowCongratulation(false);
          }, 6000);
        }
        setIsSharingWhatsApp(false);
        setIsCapturingImage(false);
      }, 'image/jpeg', 0.95); // High clarity as requested
    } catch (error) {
      console.error('Receipt capture error:', error);
      showToast('Capture failed. Using PDF fallback.');
      setIsSharingWhatsApp(false);
      setIsCapturingImage(false);
    } finally {
      if (restoreStyles) restoreStyles();
    }
  };

  const handleActionDownloadImage = async () => {
    const element = document.getElementById('invoice-preview');
    if (!element) return;

    setIsDownloadingImage(true);
    setIsCapturingImage(true);
    let restoreStyles: (() => void) | null = null;
    try {
      restoreStyles = await sanitizeStylesheets();
      const portal = document.createElement('div');
      portal.style.position = 'absolute';
      portal.style.top = '-9999px';
      portal.style.left = '-9999px';
      portal.style.width = '800px';
      portal.style.backgroundColor = 'white';
      
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.width = '800px';
      clone.style.boxShadow = 'none';
      clone.style.borderRadius = '0';
      clone.style.transition = 'none';
      clone.style.opacity = '1';
      clone.style.display = 'flex';
      clone.style.imageRendering = 'crisp-edges';
      (clone.style as any).webkitFontSmoothing = 'antialiased';
      clone.style.textRendering = 'optimizeLegibility';
      clone.removeAttribute('id');
      
      portal.appendChild(clone);
      document.body.appendChild(portal);

      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(clone, {
        scale: 4, // Maximum resolution for static downloads
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        imageTimeout: 0,
        width: 800,
        height: clone.scrollHeight,
        windowWidth: 800,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      } as any);
      
      document.body.removeChild(portal);
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsDownloadingImage(false);
          setIsCapturingImage(false);
          return;
        }
        
        const fileName = `${data.type === 'invoice' ? 'Invoice' : 'Receipt'}_${data.number}.jpg`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        
        showToast('Image Saved Successfully!');
        setIsDownloadingImage(false);
        setIsCapturingImage(false);
        
        setShowCongratulation(true);
        setTimeout(() => {
          setShowCongratulation(false);
        }, 6000);
      }, 'image/jpeg', 1.0);
    } catch (error) {
      console.error('Image capture error:', error);
      showToast('Download failed.');
      setIsDownloadingImage(false);
      setIsCapturingImage(false);
    } finally {
      if (restoreStyles) restoreStyles();
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all data?')) {
      setData({
        ...DEFAULT_INVOICE,
        businessPhone: '',
        businessEmail: '',
        number: `INV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
      });
      showToast('Data Reset Successfully');
    }
  };

  const handleCopyLink = () => {
    const shareLink = 'https://ais-pre-icebazhney54r3gqemnejm-526599491602.europe-west2.run.app';
    const shareText = `🔥 THE DUAL POWER OF SWIFT INVOICE & RECEIPT IS HERE! 🔥
(The Ultimate 2-in-1 Professional Branding Tool)

Stop losing clients to amateur paperwork. Unleash the most powerful documentation engine designed to build UNSTOPPABLE TRUST and EXPLODE your sales!

✨ Why this 2-in-1 Masterpiece by CIYA is a Game-Changer:
✅ DOUBLE THE VALUE: Generate Stunning Invoices AND Professional Receipts in seconds!
✅ 10X BRAND AUTHORITY: Look like a Fortune 500 company instantly.
✅ VISUAL CLARITY: Professional item images that leave no room for doubt.
✅ DIGITAL INTEGRITY: Secure signature pads for iron-clad agreements.
✅ REAL-TIME MASTERY: Live preview ensures perfection before you hit export.
✅ 1-CLICK SUCCESS: Lightning-fast PDF downloads for your clients.

Don't just run a business, command a BRAND that speaks for itself.

🚀 TRANSFORM YOUR BUSINESS NOW: ${shareLink}

✨ "Don't just sell, leave an impression that lasts!" ✨`;

    navigator.clipboard.writeText(shareText);
    showToast('Marketing share text copied!');
  };

  const handleShareWhatsApp = () => {
    const shareLink = 'https://ais-pre-icebazhney54r3gqemnejm-526599491602.europe-west2.run.app';
    const shareText = `🔥 THE DUAL POWER OF SWIFT INVOICE & RECEIPT IS HERE! 🔥
(The Ultimate 2-in-1 Professional Branding Tool)

Stop losing clients to amateur paperwork. Unleash the most powerful documentation engine designed to build UNSTOPPABLE TRUST and EXPLODE your sales!

✨ Why this 2-in-1 Masterpiece by CIYA is a Game-Changer:
✅ DOUBLE THE VALUE: Generate Stunning Invoices AND Professional Receipts in seconds!
✅ 10X BRAND AUTHORITY: Look like a Fortune 500 company instantly.
✅ VISUAL CLARITY: Professional item images that leave no room for doubt.
✅ DIGITAL INTEGRITY: Secure signature pads for iron-clad agreements.
✅ REAL-TIME MASTERY: Live preview ensures perfection before you hit export.
✅ 1-CLICK SUCCESS: Lightning-fast PDF downloads for your clients.

Don't just run a business, command a BRAND that speaks for itself.

🚀 TRANSFORM YOUR BUSINESS NOW: ${shareLink}

✨ "Don't just sell, leave an impression that lasts!" ✨`;

    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900 font-sans selection:bg-blue-500/30 selection:text-slate-900 relative">
      {/* Header */}
      <header className="relative bg-white shadow-sm border-b border-slate-200 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white shadow-lg shrink-0 mt-1">
              <FileText className="w-8 h-8 sm:w-12 sm:h-12" />
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row flex-wrap items-center gap-4">
                <button 
                  onClick={handleAdminClick}
                  className="text-left focus:outline-none"
                >
                  <h1 className="text-xl sm:text-4xl font-black tracking-tight text-slate-900 leading-[1.1] uppercase max-w-2xl">SWIFT INVOICE & RECEIPT PROFESSIONAL GENERATOR</h1>
                </button>
                
                <div className="relative inline-block group shrink-0">
                  <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-red-400 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative px-4 py-1.5 bg-white rounded-full border border-orange-200 backdrop-blur-sm">
                    <p className="text-[10px] sm:text-sm text-orange-600 font-extrabold uppercase tracking-[0.2em]">By CIYA (Create It Yourself Academy)</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-slate-200 group/btn"
                  title="Reset Data"
                >
                  <RotateCcw size={18} className="group-hover/btn:rotate-[-45deg] transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Reset</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 group/btn"
                  title="Copy Link"
                >
                  <Share2 size={18} className="group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Share</span>
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold transition-all border border-emerald-100 group/btn"
                >
                  <MessageCircle size={18} className="group-hover/btn:scale-110 transition-transform" />
                  <span className="text-xs uppercase tracking-widest">WhatsApp</span>
                </button>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => setActiveModal('how-to')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 border border-blue-700 rounded-lg text-[11px] font-black text-white uppercase tracking-wider hover:bg-blue-700 transition-all shadow-sm group/btn"
                >
                  <BookOpen size={14} className="group-hover/btn:scale-110 transition-transform" />
                  How to Use
                </button>
                <button
                  onClick={() => setActiveModal('about')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 border border-orange-600 rounded-lg text-[11px] font-black text-white uppercase tracking-wider hover:bg-orange-600 transition-all shadow-sm group/btn"
                >
                  <Users size={14} className="group-hover/btn:scale-110 transition-transform" />
                  About Us
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveModal('stats')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-black text-white uppercase tracking-wider hover:bg-slate-700 transition-all shadow-sm group/btn"
                  >
                    <BarChart3 size={14} className="group-hover/btn:scale-110 transition-transform" />
                    Admin
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto relative z-10 bg-slate-50 shadow-2xl rounded-t-[40px] px-6 py-8 md:px-12 lg:py-12 mt-4 lg:mt-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight flex items-center justify-center gap-x-2 flex-wrap">
              Create your swift business
              <span className="relative inline-block h-[1.1em] overflow-hidden align-bottom">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={swappingText}
                    initial={{ y: '100%' }}
                    animate={{ y: '0%' }}
                    exit={{ y: '-100%' }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500"
                  >
                    {swappingText}
                  </motion.span>
                </AnimatePresence>
              </span>
              in 60 seconds
              <span className="inline-block ml-2 -mt-1 align-middle">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                    <circle cx="12" cy="12" r="10" />
                    <motion.g
                      style={{ transformOrigin: "12px 12px" }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    >
                      <line x1="12" y1="12" x2="12" y2="7" />
                    </motion.g>
                    <line x1="12" y1="12" x2="16" y2="12" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                  </svg>
                </span>
            </h2>
            <p className="text-slate-500 text-lg">Fill in the details below to generate your professional document.</p>
          </div>
          
          <div className="pb-24">
            {activeTab === 'editor' ? (
              <InvoiceForm data={data} onChange={setData} />
            ) : (
              <div className="w-full flex flex-col items-center bg-slate-900 pt-8 pb-10 px-0 sm:px-8 rounded-[40px] relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
                 {/* Background decors for the preview block */}
                 <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent rounded-[40px] pointer-events-none"></div>
                 
                 <div className="relative z-20 mb-6 text-center px-4 w-full">
                   <h3 className="text-white font-black uppercase tracking-widest text-lg mb-1">Live Interactive Preview</h3>
                   <span className="text-[10px] font-bold text-slate-900 bg-emerald-400 px-3 py-1 rounded-full uppercase tracking-widest inline-block shadow-[0_0_15px_rgba(52,211,153,0.5)] animate-pulse mb-6">Click any text or image to edit directly!</span>
                   
                   <div className="max-w-xs mx-auto mb-2 text-left">
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Template Style</label>
                     <div className="relative">
                       <select
                         value={data.template}
                         onChange={(e) => setData({ ...data, template: e.target.value as any })}
                         className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white font-black focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer pr-10 shadow-sm backdrop-blur-sm"
                       >
                         <option className="text-slate-900" value="minimal">Minimalist Blue</option>
                         <option className="text-slate-900" value="corporate">Corporate Dark</option>
                         <option className="text-slate-900" value="elegant">Elegant Serif</option>
                         <option className="text-slate-900" value="modern">Modern Gradient</option>
                         <option className="text-slate-900" value="playful">Playful Yellow</option>
                       </select>
                       <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                         <ChevronDown size={16} className="text-slate-400" />
                       </div>
                     </div>
                   </div>
                 </div>

                 <div className="w-full flex flex-col items-center relative z-10 w-full overflow-x-hidden">
                   <div className="transform scale-[0.45] xs:scale-[0.55] sm:scale-[0.78] md:scale-[0.88] lg:scale-100 origin-top transition-transform duration-500" style={{ width: '800px' }}>
                     <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative bg-white">
                       <InvoicePreview 
                         data={data} 
                         onChange={setData} 
                         isExportMode={isExporting || isCapturingImage || isDownloadingImage}
                       />
                     </div>
                   </div>
                 </div>

                 {/* ACTION BUTTONS (Moved inside preview block) */}
                 <div className="flex flex-col items-center gap-6 relative z-20 mt-[-560px] xs:mt-[-450px] sm:mt-[-230px] md:mt-[-120px] lg:mt-12 w-full pt-4 px-4">
                   <button
                     onClick={handleDownloadPDF}
                     disabled={isExporting}
                     className={cn(
                       "flex items-center gap-3 px-12 py-5 bg-blue-600 text-white rounded-2xl font-black shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)] hover:scale-[1.05] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 uppercase tracking-widest text-sm",
                       isExporting && "animate-pulse"
                     )}
                   >
                     {isExporting ? (
                       <>
                         <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                         <span>Exporting...</span>
                       </>
                     ) : (
                       <>
                         <Share2 size={20} />
                         <span>Export & Share</span>
                       </>
                     )}
                   </button>

                   {/* Secondary Actions */}
                   <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                     <button
                       onClick={handleReset}
                       className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white hover:text-red-400 hover:bg-white/20 rounded-xl transition-all border border-white/10 backdrop-blur-sm group/btn"
                       title="Reset Data"
                     >
                       <RotateCcw size={16} className="group-hover/btn:rotate-[-45deg] transition-transform" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Reset</span>
                     </button>
                     <button
                       onClick={handleCopyLink}
                       className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white hover:text-blue-400 hover:bg-white/20 rounded-xl transition-all border border-white/10 backdrop-blur-sm group/btn"
                       title="Copy Link"
                     >
                       <Share2 size={16} className="group-hover/btn:scale-110 transition-transform" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Share Link</span>
                     </button>
                   </div>
                 </div>
              </div>
            )}
            
            <div className="w-full overflow-hidden bg-slate-900 border-y border-white/10 text-slate-400 font-bold uppercase tracking-widest py-3 my-8 text-[10px] rounded-xl shadow-lg relative flex">
              <motion.div 
                className="whitespace-nowrap flex items-center gap-10 min-w-max"
                animate={{ x: ["0%", "-50%"] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 45 }}
              >
                {Array(6).fill("✨  SWIFT INVOICE & RECEIPT • MODERN DOCUMENTS IN 60 SECS • POWERED BY CIYA ACADEMY • BUILD TRUST & DRIVE SALES").map((text, i) => (
                  <span key={i}>{text}</span>
                ))}
                {Array(6).fill("✨  SWIFT INVOICE & RECEIPT • MODERN DOCUMENTS IN 60 SECS • POWERED BY CIYA ACADEMY • BUILD TRUST & DRIVE SALES").map((text, i) => (
                  <span key={i + 6}>{text}</span>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex justify-center pointer-events-none w-max">
        <div className="flex bg-slate-100 p-1.5 rounded-full shadow-2xl border border-slate-200 pointer-events-auto">
          <button 
            onClick={() => setActiveTab('editor')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all", 
              activeTab === 'editor' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
             <FileText size={16}/> 
             Editor
          </button>
          <button 
            onClick={() => setActiveTab('preview')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all", 
              activeTab === 'preview' ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]" : "text-slate-500 hover:text-slate-700"
            )}
          >
             <Eye size={16}/> 
             Live Preview
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {/* Modals */}
      <Modal
        isOpen={activeModal === 'how-to'}
        onClose={() => setActiveModal(null)}
        title="How to Use Swift Invoice"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 font-black text-blue-600 text-[9px]">1</div>
            <div>
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider mb-1">Business Branding</h4>
              <p className="text-[10px] text-slate-600">Upload your logo (it will be made circular automatically) and enter your business name, address, and contact details.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 font-black text-blue-600 text-[9px]">2</div>
            <div>
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider mb-1">Customer Details</h4>
              <p className="text-[10px] text-slate-600">Enter the client's name and address in the "Bill To" section to personalize the document.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 font-black text-blue-600 text-[9px]">3</div>
            <div>
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider mb-1">Document Customization</h4>
              <p className="text-[10px] text-slate-600">Choose between "Invoice" or "Receipt". Use the <b>Template Style</b> selector below the live preview to switch between designs.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 font-black text-blue-600 text-[9px]">4</div>
            <div>
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider mb-1">Item Management</h4>
              <p className="text-[10px] text-slate-600">Add items with descriptions, quantities, and prices. You can even upload images for each item.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 font-black text-blue-600 text-[9px]">5</div>
            <div>
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider mb-1">Financials & Signature</h4>
              <p className="text-[10px] text-slate-600">Set your currency and add a discount percentage. Use the <b>Signature Pad</b> to draw your authorized signature.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 font-black text-blue-600 text-[9px]">6</div>
            <div>
              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider mb-1">Export & Share</h4>
              <p className="text-[10px] text-slate-600">Once satisfied, click <b>"Export & Share"</b> to get a professional PDF, or copy the link to share instantly.</p>
            </div>
          </div>
          
          <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-sm mt-4 lg:min-h-[400px]">
            <p className="text-[9px] font-bold text-center py-2 bg-slate-50 uppercase tracking-widest text-slate-500">Video Guide: How to use Swift Invoice</p>
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
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'about'}
        onClose={() => setActiveModal(null)}
        title="About CIYA & Swift Invoice"
      >
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-br from-blue-50 to-orange-50 rounded-2xl border border-slate-100">
            <h4 className="text-xl font-black text-slate-900 mb-4 tracking-tight">CIYA: Create It Yourself Academy</h4>
            <p className="text-sm leading-relaxed mb-4">
              Swift Invoice is a professional tool powered by <b>CIYA</b>. Our mission is to empower business owners to brand their businesses better, build unwavering trust with clients, and ultimately drive more sales through professional presentation.
            </p>
            <p className="text-sm leading-relaxed">
              At CIYA, we believe in the power of creation. We don't just provide tools; we teach people how to <b>build simple, powerful tools</b> that can be used for their personal life or business.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <h5 className="font-black text-blue-600 text-xs uppercase tracking-widest mb-2">Our Mission</h5>
              <p className="text-xs text-slate-500">Helping entrepreneurs upgrade their brand identity and professional workflow.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <h5 className="font-black text-orange-600 text-xs uppercase tracking-widest mb-2">Skill Upgrading</h5>
              <p className="text-xs text-slate-500">Teaching you to move from being a user to a creator of the tools you need.</p>
            </div>
          </div>

          <div className="pt-4 text-center">
            <p className="text-sm font-bold text-slate-400 italic">"Don't just use the future, build it." — CIYA</p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={activeModal === 'stats'}
        onClose={() => setActiveModal(null)}
        title="Secret Admin Dashboard"
      >
        <div className="space-y-8">
          <p className="text-sm text-slate-500">Real-time global tracking of professional documents generated by CIYA users.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col items-center text-center group">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <FileText size={24} />
              </div>
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Invoice Power</h4>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">
                {stats.invoiceDownloads.toLocaleString()}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Global Generations</p>
            </div>

            <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100 flex flex-col items-center text-center group">
              <div className="w-12 h-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Receipt Authority</h4>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">
                {stats.receiptDownloads.toLocaleString()}
              </p>
              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Global Generations</p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Sync Enabled</p>
            </div>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Data updates instantly across all connected devices</p>
          </div>

          <div className="mt-8">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Recent Exports By Date</h4>
            <div className="space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {exportHistory.length > 0 ? (
                Object.entries(exportHistory.reduce((acc, current) => {
                  const dateObj = new Date(current.date);
                  let dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  
                  // Simple check for today/yesterday if helpful
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  if (dateObj.toDateString() === today.toDateString()) dateStr = "Today";
                  else if (dateObj.toDateString() === yesterday.toDateString()) dateStr = "Yesterday";

                  if (!acc[dateStr]) acc[dateStr] = [];
                  acc[dateStr].push(current);
                  return acc;
                }, {} as Record<string, any[]>)).map(([dateLabel, items]: [string, any]) => (
                  <div key={dateLabel}>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">{dateLabel} ({items.length})</h5>
                    <div className="space-y-3">
                      {items.map((item: any) => (
                        <div key={item.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.businessName} <span className="text-slate-400 font-normal">→</span> {item.customerName}</p>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{item.type} • {item.number}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-700">{new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4 italic">No recent exports found.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setGeneratedPdf(null);
          // Refresh the number only when closing the final success modal
          setData(prev => ({
            ...prev,
            number: generateInvNumber(prev.type)
          }));
        }}
        title="Document Ready!"
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center p-6 bg-green-50 rounded-3xl border border-green-100">
            <div className="w-16 h-16 bg-green-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Export Successful!</h3>
            <p className="text-sm text-slate-500 font-medium">Your professional {data.type} is ready for delivery.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={handleActionShareWhatsApp}
              disabled={isSharingWhatsApp || isDownloadingImage}
              className={cn(
                "w-full flex items-center justify-between p-4 bg-white border-2 border-green-500 rounded-2xl hover:bg-green-50 transition-all group shadow-[0_4px_15px_rgba(34,197,94,0.15)]",
                isSharingWhatsApp && "opacity-70 animate-pulse"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isSharingWhatsApp ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <MessageCircle size={20} />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900 group-hover:text-green-700 uppercase tracking-wide">Share on WhatsApp</p>
                </div>
              </div>
              <Share2 size={18} className="text-green-500 group-hover:scale-125 transition-transform" />
            </button>

            <div className="h-px bg-slate-100 my-2" />

            <button
              onClick={handleActionDownload}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-slate-900 hover:bg-slate-50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Download size={20} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900 group-hover:text-slate-950">Download PDF</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Save document locally</p>
                </div>
              </div>
              <ChevronDown size={18} className="text-slate-300 -rotate-90 group-hover:text-slate-900" />
            </button>

            <button
              onClick={handleActionDownloadImage}
              disabled={isSharingWhatsApp || isDownloadingImage}
              className={cn(
                "w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group",
                isDownloadingImage && "opacity-70 animate-pulse"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isDownloadingImage ? (
                    <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  ) : (
                    <Image size={20} />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900 group-hover:text-emerald-700">Download as Image</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">High resolution JPG</p>
                </div>
              </div>
              <ChevronDown size={18} className="text-slate-300 -rotate-90 group-hover:text-emerald-500" />
            </button>
          </div>

          <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed px-4">
            Note: On some mobile browsers, you may need to download the file first before sharing manually.
          </p>
        </div>
      </Modal>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest border border-white/10"
          >
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCongratulation && (
          <div className="fixed top-0 left-0 right-0 z-[100001] flex justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, y: -150, scale: 0.95 }}
              animate={{ opacity: 1, y: 24, scale: 1 }}
              exit={{ opacity: 0, y: -150, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 rounded-[2rem] p-6 text-center shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(16,185,129,0.2)] pointer-events-auto"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent rounded-[2rem] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center">
                {/* Animated Icon */}
                <motion.div
                  initial={{ rotate: -15, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", delay: 0.15 }}
                  className="w-14 h-14 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg mb-4"
                >
                  🎉
                </motion.div>
                
                <motion.h4
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl font-black text-white uppercase tracking-wider mb-2"
                >
                  Success!
                </motion.h4>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-xs font-bold text-emerald-300 uppercase tracking-widest mb-3 bg-emerald-500/10 px-4 py-1 rounded-full border border-emerald-500/20"
                >
                  Document Downloaded Successfully
                </motion.p>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-slate-300 text-xs sm:text-sm max-w-md leading-relaxed"
                >
                  Your professional document has been saved. Send it to your client to build trust, command authority, and accelerate payment!
                </motion.p>
                
                {/* Progress timer bar */}
                <div className="w-full bg-slate-800 h-1 rounded-full mt-5 overflow-hidden">
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 6, ease: "linear" }}
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
        @media print {
          .no-print { display: none; }
        }
      `}} />
    </div>
  );
}
