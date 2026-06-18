
import React, { useState, useRef } from 'react';
import { 
  Eye, 
  Download, 
  Maximize2, 
  FileText, 
  Smartphone, 
  Camera, 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  Zap,
  Files,
  Trash2,
  X,
  ShieldCheck,
  Cpu
} from 'lucide-react';

interface DocumentViewerProps {
  proposalAde: string;
  onFilesAttached: (files: File[]) => void;
  hasFiles: boolean;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ proposalAde, onFilesAttached, hasFiles }) => {
  const [activeTab, setActiveTab] = useState<'ID' | 'CARD' | 'SELFIE'>('ID');
  const [isProcessingAPI, setIsProcessingAPI] = useState(false);
  const [isApiDone, setIsApiDone] = useState(false);
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs = [
    { id: 'ID', label: 'RG / CNH', icon: <FileText size={16} /> },
    { id: 'CARD', label: 'Convênio', icon: <Smartphone size={16} /> },
    { id: 'SELFIE', label: 'Selfie', icon: <Camera size={16} /> },
  ] as const;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesAttached(files);
      setIsApiDone(false); // Reset API state for new files
    }
  };

  const handleSendToAPI = () => {
    if (!hasFiles) return;
    setIsProcessingAPI(true);
    // Simulate Document AI / OCR Processing
    setTimeout(() => {
      setIsProcessingAPI(false);
      setIsApiDone(true);
    }, 2000);
  };

  const currentImage = activeTab === 'ID' 
    ? 'https://picsum.photos/800/1000?random=11' 
    : activeTab === 'CARD' 
    ? 'https://picsum.photos/800/1000?random=22' 
    : 'https://picsum.photos/800/1000?random=33';

  return (
    <div className="bg-white rounded-2xl shadow-sm border flex flex-col h-[650px] relative overflow-hidden">
      {/* Full Screen View Modal */}
      {isFullViewOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in duration-300">
           <div className="absolute top-6 right-6 flex gap-4">
              <button className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all">
                <Download size={24} />
              </button>
              <button 
                onClick={() => setIsFullViewOpen(false)}
                className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all"
              >
                <X size={24} />
              </button>
           </div>
           <img 
              src={currentImage} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/50" 
              alt="Visualização do Documento" 
            />
        </div>
      )}

      {/* Header Tabs */}
      <div className="p-4 border-b flex items-center justify-between shrink-0 bg-slate-50/50">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'bg-white border text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => hasFiles && setIsFullViewOpen(true)}
             className={`p-2 rounded-xl border transition-all ${hasFiles ? 'text-slate-600 hover:text-blue-600 hover:bg-blue-50' : 'text-slate-200 cursor-not-allowed'}`}
             title="Visualizar Detalhado"
           >
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden p-6 relative group">
        {!hasFiles ? (
          <div className="flex flex-col items-center justify-center text-center p-10 bg-white border-2 border-dashed border-slate-200 rounded-3xl max-w-sm shadow-xl shadow-slate-200/50 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
              <UploadCloud size={32} />
            </div>
            <h4 className="font-black text-slate-800 mb-2">Central de Documentos</h4>
            <p className="text-xs text-slate-500 mb-8 leading-relaxed font-medium">
              Aguardando inserção de arquivos locais para triagem. Clique abaixo para anexar.
            </p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3"
            >
              <Files size={18} />
              Anexar Arquivo Local
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              multiple 
              className="hidden" 
              onChange={handleFileChange}
              accept="image/*,.pdf"
            />
          </div>
        ) : (
          <>
            {/* Quick Actions Overlay */}
            <div className="absolute top-6 right-6 z-20 flex flex-col gap-3">
               <button 
                 onClick={() => setIsFullViewOpen(true)}
                 className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-xl text-slate-700 hover:text-blue-600 hover:scale-105 transition-all border group"
               >
                  <Eye size={20} />
                  <span className="absolute right-full mr-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Visualizar</span>
               </button>
               <button className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-xl text-slate-700 hover:text-red-600 hover:scale-105 transition-all border group">
                  <Trash2 size={20} />
                  <span className="absolute right-full mr-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Remover</span>
               </button>
            </div>
            
            <img 
              src={currentImage} 
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain bg-white animate-in fade-in duration-500 cursor-zoom-in"
              alt="Document content"
              onClick={() => setIsFullViewOpen(true)}
            />
            
            {isApiDone && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-xs font-bold animate-in slide-in-from-bottom-4 border border-slate-700">
                 <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} /> 
                 </div>
                 <div>
                    <p className="text-emerald-400">OCR IA PROCESSADO</p>
                    <p className="text-[10px] text-slate-400 font-medium">Dados extraídos com 98% de acurácia.</p>
                 </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Actions - SEPARATED BY STEPS */}
      <div className="p-6 bg-white border-t flex flex-col lg:flex-row items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Passo 1: Local</span>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border-2 ${
                  hasFiles 
                  ? 'border-emerald-500 text-emerald-600 bg-emerald-50' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Files size={18} />
                {hasFiles ? "Arquivo Anexado" : "Anexar ao Sistema"}
              </button>
            </div>

            <div className="h-10 w-[1px] bg-slate-100 hidden lg:block"></div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Passo 2: Cloud</span>
              <button 
                disabled={!hasFiles || isProcessingAPI || isApiDone}
                onClick={handleSendToAPI}
                className={`px-6 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xl ${
                  isApiDone 
                  ? 'bg-emerald-600 text-white shadow-emerald-200'
                  : isProcessingAPI
                  ? 'bg-slate-100 text-slate-400 cursor-wait'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-200 disabled:opacity-30 disabled:grayscale'
                }`}
              >
                {isProcessingAPI ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isApiDone ? (
                  <ShieldCheck size={18} />
                ) : (
                  <Cpu size={18} />
                )}
                {isProcessingAPI ? "Processando..." : isApiDone ? "Validado via API" : "Extrair via IA (API)"}
              </button>
            </div>
          </div>

          {hasFiles && (
            <button 
              onClick={() => setIsFullViewOpen(true)}
              className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl transition-all flex items-center gap-2"
            >
              <Eye size={16} />
              Visualizar Documento
            </button>
          )}

          <input 
              type="file" 
              ref={fileInputRef} 
              multiple 
              className="hidden" 
              onChange={handleFileChange}
              accept="image/*,.pdf"
          />
      </div>
    </div>
  );
};
