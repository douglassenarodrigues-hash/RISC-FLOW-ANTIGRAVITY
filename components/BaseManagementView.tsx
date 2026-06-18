import React, { useState, useRef } from 'react';
import { BaseImport } from '../types';
import { decodeArrayBuffer } from '../utils';
import { 
  Database, 
  Settings, 
  Trash2, 
  Download, 
  Upload, 
  Eye, 
  Search, 
  X, 
  Check, 
  AlertTriangle,
  FileText
} from 'lucide-react';

interface BaseManagementViewProps {
  bases: BaseImport[];
  onDeleteBase: (baseId: string) => void;
  onUpdateBaseContent: (baseId: string, updatedRawContent: string, newFileName?: string) => void;
  isDarkMode?: boolean;
  onDeleteAllProposals?: () => void;
}

export const BaseManagementView: React.FC<BaseManagementViewProps> = ({
  bases,
  onDeleteBase,
  onUpdateBaseContent,
  isDarkMode = false,
  onDeleteAllProposals
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dropdown active status
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modals status
  const [reuploadingBase, setReuploadingBase] = useState<BaseImport | null>(null);
  const [deletingBase, setDeletingBase] = useState<BaseImport | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter bases based on search term (file name or bank name)
  const filteredBases = bases.filter(b => 
    b.bankName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.importedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format timestamp to PT-BR date/time
  const formatDateTime = (ms: number) => {
    return new Date(ms).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Triggers CSV download
  const handleDownloadCSV = (b: BaseImport) => {
    // Add BOM for windows excel support
    const blob = new Blob(['\ufeff' + b.rawContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', b.fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setActiveMenuId(null);
  };

  // Open re-upload picker
  const handleOpenReupload = (b: BaseImport) => {
    setReuploadingBase(b);
    setActiveMenuId(null);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  // Process reuploaded file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !reuploadingBase) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
       alert('Formato inválido. Por favor envie um arquivo CSV.');
       setReuploadingBase(null);
       return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const text = decodeArrayBuffer(buffer);
        onUpdateBaseContent(reuploadingBase.id, text, file.name);
      } catch (err: any) {
        alert('Erro ao carregar o arquivo: ' + err.message);
      }
      setReuploadingBase(null);
    };
    reader.readAsArrayBuffer(file);
  };

  // Delete confirmation
  const handleRequestDelete = (b: BaseImport) => {
    setDeletingBase(b);
    setActiveMenuId(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingBase) return;
    onDeleteBase(deletingBase.id);
    setDeletingBase(null);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="header-riskflow">
        <h1 className="titulo-pagina">Gerenciar Bases Importadas</h1>
        <div className="contador-quantidade">BASES IMPORTADAS: {bases.length}</div>
      </div>

      {/* Intro info panel */}
      <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl text-white ${isDarkMode ? 'bg-blue-600' : 'bg-slate-900'}`}>
            <Database size={24} />
          </div>
          <div>
            <h3 className="font-black tracking-tight text-base dark:text-white text-slate-800">
              Consolidação de Bases
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-4xl font-medium leading-relaxed font-semibold">
              Visualize e gerencie as bases de propostas importadas. O reenvio de um arquivo de base atualiza o SLA e a prioridade de análise das propostas no sistema.
            </p>
          </div>
        </div>
      </div>

      {/* Core Table Card */}
      <div className={`rounded-3xl border overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
        {/* Search header bar */}
        <div className={`p-6 border-b flex flex-col sm:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
              Bases no Sistema
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por banco, arquivo ou usuário..."
              className={`w-full pl-10 pr-4 py-2 border rounded-xl text-xs font-bold outline-none focus:ring-2 transition-all ${
                isDarkMode 
                  ? 'bg-slate-900/60 border-slate-700 text-white focus:ring-blue-500' 
                  : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-900'
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Hidden File Input for reupload */}
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept=".csv"
          onChange={handleFileChange}
        />

        {/* Sequential List Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-black tracking-widest ${isDarkMode ? 'border-slate-800 bg-slate-900/20 text-slate-400' : 'border-slate-100 bg-slate-50/30 text-slate-500'}`}>
                <th className="py-4 px-6 text-center">Banco</th>
                <th className="py-4 px-6 text-center">Novas Propostas</th>
                <th className="py-4 px-6 text-center">Propostas Duplicadas</th>
                <th className="py-4 px-6 text-center">Data/Hora de Importação</th>
                <th className="py-4 px-6 text-center">Importado por</th>
                <th className="py-4 px-6 text-center w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredBases.map((b) => (
                <tr 
                  key={b.id} 
                  className={`hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors text-xs font-bold ${
                    isDarkMode ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  {/* 1. Nome do Banco */}
                  <td className="py-5 px-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-extrabold tracking-tight px-3 py-1 rounded-full text-[11px] bg-blue-500/10 text-blue-500">
                        {b.bankName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium max-w-[150px] truncate" title={b.fileName}>
                        {b.fileName}
                      </span>
                    </div>
                  </td>

                  {/* 2. Número de propostas novas */}
                  <td className="py-5 px-6 text-center">
                    <span className="px-2.5 py-1 rounded-lg text-emerald-500 bg-emerald-500/10 font-black font-mono">
                      {b.newCount}
                    </span>
                  </td>

                  {/* 3. Propostas duplicadas */}
                  <td className="py-5 px-6 text-center">
                    <span className={`px-2.5 py-1 rounded-lg font-black font-mono ${
                      b.dupCount > 0 
                        ? 'text-yellow-500 bg-yellow-500/10' 
                        : 'text-slate-400 bg-slate-100 dark:bg-slate-800/40 font-medium'
                    }`}>
                      {b.dupCount}
                    </span>
                  </td>

                  {/* 4. Hora da importação da base */}
                  <td className="py-5 px-6 text-center">
                    <span className="font-mono text-slate-500 text-[11px]">
                      {formatDateTime(b.importedAt)}
                    </span>
                  </td>

                  {/* 5. Usuário que importou a operação */}
                  <td className="py-5 px-6 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold">
                      {b.importedBy}
                    </span>
                  </td>

                  {/* 6. Engrenagem com opções de alterações */}
                  <td className="py-5 px-6 text-center relative">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === b.id ? null : b.id)}
                      className={`p-2 rounded-xl transition-all ${
                        activeMenuId === b.id 
                          ? 'bg-blue-600 text-white' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'
                      }`}
                      title="Clique para abrir as opções"
                    >
                      <Settings size={18} className={activeMenuId === b.id ? 'rotate-45 duration-300' : ''} />
                    </button>

                    {/* Popover Menu with Options */}
                    {activeMenuId === b.id && (
                      <div className="absolute right-6 top-14 w-52 rounded-2xl shadow-xl z-30 border text-left overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <div className="p-1">
                          
                          <button 
                            onClick={() => handleDownloadCSV(b)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                          >
                            <Download size={14} className="text-emerald-500" />
                            Baixar CSV
                          </button>

                          <button 
                            onClick={() => handleOpenReupload(b)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                          >
                            <Upload size={14} className="text-teal-500" />
                            Reenviar CSV Editado
                          </button>

                          <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                          <button 
                            onClick={() => handleRequestDelete(b)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                          >
                            <Trash2 size={14} />
                            Excluir Base
                          </button>

                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              
              {filteredBases.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Database size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-xs text-slate-400 font-bold">Nenhuma base importada foi localizada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DANGER ZONE FOR GENERAL RESETS */}
      {onDeleteAllProposals && (
        <div className={`p-6 sm:p-8 rounded-[2rem] border animate-in fade-in slide-in-from-bottom-2 duration-300 mt-8 ${
          isDarkMode ? 'bg-red-950/10 border-red-900/20' : 'bg-red-50/50 border-red-100'
        }`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-red-650 text-white flex items-center justify-center shadow-lg shadow-red-500/20">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className={`font-black uppercase tracking-wider text-sm ${isDarkMode ? 'text-red-400' : 'text-slate-800'}`}>
                  Zona de Risco: Excluir Todas as Propostas
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-2xl font-medium leading-relaxed">
                  Esta ação excluirá <span className="font-extrabold text-red-500">permanentemente todas as propostas</span>, agendamentos e bases importadas do sistema. O histórico de regras e acessos será mantido. Esta ação é irreversível.
                </p>
              </div>
            </div>
            <button
              id="btn-apagar-todas-operacoes"
              onClick={onDeleteAllProposals}
              className="w-full md:w-auto px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-150 shadow-lg shadow-red-600/10 hover:shadow-red-600/20 active:scale-95 cursor-pointer"
            >
              Excluir Todas as Propostas
            </button>
          </div>
        </div>
      )}

      {/* BACKDROP CLICKER (To close action dropdowns easily) */}
      {activeMenuId && (
        <div 
          className="fixed inset-0 z-20" 
          onClick={() => setActiveMenuId(null)}
        />
      )}

      {/* 2. CONFIRM DELETION MODAL */}
      {deletingBase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-[2rem] p-8 shadow-2xl bg-slate-900 border border-slate-800">
            
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-red-500/10 rounded-full text-red-500 mb-4 animate-pulse">
                <AlertTriangle size={32} />
              </div>
              
              <h3 className="text-sm font-black uppercase text-white tracking-wider mb-2">
                Deseja excluir esta base?
              </h3>
              
              <p className="text-xs text-slate-400 font-medium mb-6 leading-relaxed">
                Você está prestes a excluir a base de dados <span className="text-white font-extrabold">"{deletingBase.fileName}"</span> ({deletingBase.bankName}).<br />
                <span className="text-red-400 font-extrabold mt-2 block">
                  Esta ação excluirá permanentemente todas as {deletingBase.proposalIds.length} propostas associadas a esta base!
                </span>
                Esta operação não poderá ser desfeita.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeletingBase(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-800 text-xs font-extrabold uppercase text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-extrabold uppercase text-white shadow-lg shadow-red-600/20 transition-all"
                >
                  Excluir Propostas
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
