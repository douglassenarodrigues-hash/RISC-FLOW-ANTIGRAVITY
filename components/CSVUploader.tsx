import React, { useRef, useState, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  Settings2, 
  Landmark, 
  ChevronDown, 
  Filter, 
  BadgeCheck, 
  Database, 
  Loader2,
  CheckCircle2,
  XCircle,
  SearchCheck,
  ChevronRight,
  Info,
  Zap,
  Trash2
} from 'lucide-react';
import { Proposal, BankMapping } from '../types';
import { decodeArrayBuffer } from '../utils';

interface MappingDiagnostic {
  field: string;
  found: boolean;
  column?: string;
  synonyms: string[];
}

interface CSVUploaderProps {
  onDataLoaded: (data: Proposal[], fileName: string, rawContent: string, bankName: string) => void;
  bankMemory: Record<string, BankMapping>;
  onUpdateBankMemory: (memory: Record<string, BankMapping>) => void;
  currentBaseSize: number;
  isDarkMode?: boolean;
}

// Dicionário Ampliado De-Para conforme layouts oficiais (Itaú, Pan, Safra, Daycoval)
const MAPPING_SYNONYMS: Record<string, string[]> = {
  ade: ['ADE', 'ID_PROPOSTA', 'Nr Proposta', 'PROPOSTA', 'NÚMERO DA PROPOSTA', 'ID', 'CODIGO', 'Proposta', 'Nº Proposta', 'Nº PROPOSTA', 'N Proposta', 'N PROPOSTA'],
  cliente: ['Nome', 'NOME_CLIENTE', 'Nome Cliente', 'MUTUÁRIO', 'BENEFICIÁRIO', 'CLIENTE', 'Cliente'],
  cpf: ['CPF', 'CPF_CLIENTE', 'Cpf', 'IDENTIDADE', 'DOCUMENTO', 'CPF DO CLIENTE'],
  produto: ['Produto', 'TIPO DE OPERAÇÃO', 'PRODUTO', 'MODALIDADE', 'OPERACAO'],
  atividade: ['Situação', 'STATUS_ATUAL', 'Status Proposta', 'STATUS', 'SITUAÇÃO', 'FASE', 'ATIVIDADE', 'Situacao'],
  fase: ['Consistência', 'Atividade', 'FASE DE ATUAÇÃO', 'FASE ATUACAO', 'FASE', 'ESTÁGIO', 'ESTAGIO'],
  valor: ['Valor Solic.', 'VALOR_CONTRATO', 'Vlr Contrato', 'VALOR_PARCELA', 'PMT', 'PARCELA', 'Vlr Financiado', 'Valor Parcela', 'VALOR PARCELA'],
  valorFinanciado: ['Valor Solic.', 'VALOR_CONTRATO', 'Vlr Contrato', 'VLR FINANCIADO', 'VALOR AF', 'VALOR PROPOSTA', 'Valor Liberado', 'VALOR LIBERADO'],
  convenio: ['Convênio', 'EMPREGADOR', 'CONVÊNIO', 'ÓRGÃO', 'AVERBADOR', 'CONVENIO', 'ORGAO', 'ÓRGÃO', 'Órgão'],
  corretor: ['Corretor', 'CORRESPONDENTE', 'CORRETOR', 'DIGITADOR', 'PARCEIRO', 'PROMOTOR', 'Corban', 'CORBAN']
};

export const CSVUploader: React.FC<CSVUploaderProps> = ({ onDataLoaded, bankMemory, onUpdateBankMemory, currentBaseSize, isDarkMode }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [bankName, setBankName] = useState('-- Selecione --');
  const [separator, setSeparator] = useState<';' | ','>(';');
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [csvLines, setCsvLines] = useState<string[]>([]);
  const [rawFileContent, setRawFileContent] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');
  const [isMappingMode, setIsMappingMode] = useState(false);
  const [diagnostic, setDiagnostic] = useState<MappingDiagnostic[]>([]);
  const [processingProgress, setProcessingProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  
  const [mapping, setMapping] = useState<BankMapping>({
    bankName: '',
    ade: '',
    cliente: '',
    valor: '',
    valorFinanciado: '',
    convenio: '',
    corretor: '',
    cpf: '',
    produto: '',
    atividade: '',
    fase: '',
    filterValue: '',
    sep: ';'
  });

  useEffect(() => {
    if (bankMemory[bankName]) {
      setMapping(bankMemory[bankName]);
      setSeparator(bankMemory[bankName].sep);
    }
  }, [bankName, bankMemory]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanHeader = (h: string) => h.trim().toUpperCase().replace(/\?/g, 'E');

  const classifyCovenant = (text: string): string => {
    const txt = String(text || '').toUpperCase();
    if (/INSS|DATAPREV|APOSENT/.test(txt)) return 'INSS';
    if (/SIAPE|FEDERAL|SERVIDOR|ORGAO CENTRAL/.test(txt)) return 'FEDERAL (SIAPE)';
    if (/GOV|ESTADO|PREFEITURA|PREF|MUNICIP|GDF/.test(txt)) return 'GOVERNOS/PREFEITURAS';
    if (/MARINHA|AERONAUTICA|EXERCITO|MILITAR|PM|POLICIA/.test(txt)) return 'FORÇAS MILITARES';
    if (/PRIVADO|CLT/.test(txt)) return 'PRIVADO (CLT)';
    return 'OUTROS';
  };

  const autoDetectMapping = (headers: string[]): { map: BankMapping, diag: MappingDiagnostic[] } => {
    const newMap: Partial<BankMapping> = { ...mapping };
    const diag: MappingDiagnostic[] = [];
    const cleanedHeaders = headers.map(cleanHeader);

    Object.entries(MAPPING_SYNONYMS).forEach(([field, synonyms]) => {
      let foundCol = '';
      for (const s of synonyms) {
        const idx = cleanedHeaders.indexOf(s.toUpperCase());
        if (idx !== -1) {
          foundCol = headers[idx];
          break;
        }
      }
      
      if (foundCol) {
        (newMap as any)[field] = foundCol;
        diag.push({ field, found: true, column: foundCol, synonyms });
      } else {
        diag.push({ field, found: false, synonyms });
      }
    });

    return { map: newMap as BankMapping, diag };
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Formato inválido. Selecione um arquivo CSV.');
      return;
    }

    setCurrentFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const text = decodeArrayBuffer(buffer);
        setRawFileContent(text);
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) throw new Error("Arquivo sem conteúdo suficiente.");

        const firstLine = lines[0];
        const sep = firstLine.includes(';') ? ';' : ',';
        setSeparator(sep);

        const headers = firstLine.split(sep).map(h => h.trim());
        setDetectedHeaders(headers);
        setCsvLines(lines);

        const { map: autoMap, diag } = autoDetectMapping(headers);
        setMapping(autoMap);
        setDiagnostic(diag);
        setShowDiagnostic(true);

        const missingRequired = diag.filter(d => !d.found && ['ade', 'cliente', 'valor', 'valorFinanciado', 'cpf'].includes(d.field));
        
        if (missingRequired.length > 0) {
          setError(`Layout Desconhecido: Os campos [${missingRequired.map(m => m.field.toUpperCase()).join(', ')}] não foram localizados.`);
          setIsMappingMode(true);
        } else {
          setError(null);
        }
      } catch (err: any) {
        setError('Erro na leitura do arquivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const startProcessData = async () => {
    if (csvLines.length < 2) return;
    
    setError(null);
    const headers = detectedHeaders;
    const activeMapping = { ...mapping, sep: separator };
    
    const dataRows = csvLines.slice(1).filter(line => line.trim().length > 0);
    const total = dataRows.length;
    const getColIndex = (name: string) => headers.indexOf(name);
    const atividadeIdx = getColIndex(activeMapping.atividade);
    const faseIdx = getColIndex(activeMapping.fase);

    setProcessingProgress(0);
    const processed: Proposal[] = [];

    for (let i = 0; i < total; i++) {
        const row = dataRows[i];
        const cols = row.split(activeMapping.sep);
        
        if (i % 250 === 0 || i === total - 1) {
            setProcessingProgress(Math.round(((i + 1) / total) * 100));
            setStatusMessage(`Importando: Processando ${i + 1} de ${total} propostas...`);
            await new Promise(r => setTimeout(r, 1));
        }

        const originalStatusRaw = atividadeIdx !== -1 ? (cols[atividadeIdx]?.trim() || '') : '';
        const faseAtuacaoRaw = faseIdx !== -1 ? (cols[faseIdx]?.trim() || '') : '';

        if (atividadeIdx !== -1 && activeMapping.filterValue) {
          if (originalStatusRaw.toUpperCase() !== activeMapping.filterValue.toUpperCase()) continue;
        }

        const getValue = (key: keyof BankMapping) => {
          const idx = getColIndex((activeMapping as any)[key]);
          return (idx !== -1 && cols[idx]) ? cols[idx].trim() : 'N/I';
        };

        const ade = getValue('ade');
        if (!ade || ade === 'N/I') continue;

        const cleanVal = (val: string) => {
          if (!val || val === 'N/I') return '0';
          return val.toString()
            .replace(/R\$/g, '')
            .replace(/\s/g, '')
            .replace(/\./g, '') 
            .replace(',', '.') 
            .trim();
        };

        const vParcela = cleanVal(getValue('valor'));
        const vFinanciado = cleanVal(getValue('valorFinanciado'));
        const rawCpf = getValue('cpf').replace(/\D/g, ''); 
        const rawConvenio = getValue('convenio');

        processed.push({
          id: `prop-${ade}-${i}-${Date.now()}`,
          ade: ade,
          documentacao: 'Pendente',
          banco: bankName.toUpperCase(),
          convenio: rawConvenio,
          categoriaConvenio: classifyCovenant(rawConvenio),
          produto: getValue('produto'),
          corretor: getValue('corretor'),
          valor: parseFloat(vParcela) || 0,
          valorFinanciado: parseFloat(vFinanciado) || 0,
          cpf: rawCpf,
          nomeCliente: getValue('cliente'),
          sla: '03:00:00',
          obs: '',
          status: 'PENDING',
          originalStatus: originalStatusRaw,
          faseAtuacao: faseAtuacaoRaw,
          dataSistema: new Date().toISOString().split('T')[0]
        } as Proposal);
    }

    setProcessingProgress(100);
    setStatusMessage(`Sucesso: ${processed.length} propostas importadas.`);
    setSuccess(processed.length);
    setTimeout(() => {
      onDataLoaded(processed, currentFileName, rawFileContent, bankName);
      setSuccess(null);
      setProcessingProgress(null);
      setCsvLines([]);
      setDiagnostic([]);
      setShowDiagnostic(false);
    }, 1500);
  };

  const handleManualMappingSave = () => {
    const newMap = { ...mapping, bankName, sep: separator };
    onUpdateBankMemory({ ...bankMemory, [bankName]: newMap });
    setIsMappingMode(false);
    setError(null);
  };

  const foundCount = diagnostic.filter(d => d.found).length;
  const availableBancos = Object.keys(bankMemory).sort();

  return (
    <div className={`w-full space-y-6 ${isDarkMode ? 'text-white' : ''}`}>
      <div className="header-riskflow">
        <h1 className="titulo-pagina">Importar Arquivo (CSV)</h1>
        <div className="contador-quantidade">TOTAL: {currentBaseSize} PROPOSTAS NO SISTEMA</div>
      </div>

      {!isMappingMode ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-4 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`p-2.5 rounded-xl text-white shadow-lg ${isDarkMode ? 'bg-blue-600' : 'bg-slate-900'}`}><Landmark size={20} /></div>
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Layout do Banco</label>
                <select 
                  className={`w-full text-sm font-bold outline-none bg-transparent ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                >
                  <option value="-- Selecione --">-- Selecione --</option>
                  {availableBancos.map(b => <option key={b} value={b}>{b}</option>)}
                  <option value="NEW">+ NOVO LAYOUT</option>
                </select>
              </div>
            </div>
            <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-4 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><Settings2 size={20} /></div>
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Separador de Colunas</label>
                <select 
                  className={`w-full text-sm font-bold outline-none bg-transparent ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value as any)}
                >
                  <option value=";">Ponto e Vírgula ( ; )</option>
                  <option value=",">Vírgula ( , )</option>
                </select>
              </div>
            </div>
            <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-4 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800 text-slate-405' : 'bg-slate-100 text-slate-650'}`}><Database size={20} /></div>
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total no Sistema</label>
                  <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-850'}`}>{currentBaseSize} propostas</span>
                </div>
                {currentBaseSize > 0 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("🚨 ATENÇÃO: Deseja apagar TODAS as operações importadas do sistema? Esta ação não pode ser desfeita.")) {
                        onDataLoaded([], "CLEAR_ALL");
                      }
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Limpar Base Completa"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); }}
            onClick={() => !success && !processingProgress && fileInputRef.current?.click()}
            className={`border-4 border-dashed rounded-[2.5rem] p-16 text-center transition-all relative overflow-hidden cursor-pointer ${
              success ? 'border-emerald-500/50 bg-emerald-50/20' : 
              processingProgress !== null ? 'border-blue-400 bg-slate-50' :
              isDragging ? 'border-slate-500 bg-slate-100 scale-[0.99]' : 
              isDarkMode ? 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 shadow-xl shadow-black/20' : 'border-slate-200 hover:border-slate-300 bg-white shadow-xl shadow-slate-200/50'
            }`}
          >
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner transition-all ${success ? 'bg-slate-900 text-white' : processingProgress !== null ? 'bg-blue-600 text-white animate-spin' : isDarkMode ? 'bg-slate-800 text-blue-500' : 'bg-slate-50 text-slate-600'}`}>
              {success ? <BadgeCheck size={48} /> : processingProgress !== null ? <Loader2 size={40} className="animate-spin" /> : <Upload size={40} />}
            </div>
            
            {processingProgress !== null ? (
              <div className="max-w-md mx-auto space-y-6 animate-in zoom-in-95">
                <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{statusMessage}</h3>
                <div className={`w-full h-3 rounded-full overflow-hidden border p-0.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-200'}`}>
                   <div 
                     className="bg-blue-600 h-full rounded-full transition-all duration-300" 
                     style={{ width: `${processingProgress}%` }}
                    />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{processingProgress}% Processado</p>
              </div>
            ) : success ? (
              <div className="animate-in fade-in slide-in-from-top-4">
                <h3 className={`text-3xl font-black mb-1 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-905'}`}>Arquivo Carregado</h3>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{success} registros importados com sucesso</p>
              </div>
            ) : (
              <>
                <h3 className={`text-2xl font-black mb-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    {csvLines.length > 0 ? 'Arquivo Pronto para Importar' : `Arraste o arquivo do ${bankName !== '-- Selecione --' ? bankName : 'Banco'}`}
                </h3>
                <p className="text-slate-500 max-w-sm mx-auto mb-10 text-sm font-medium">
                    {csvLines.length > 0 ? `Encontradas ${csvLines.length - 1} propostas. Clique abaixo para importar.` : 'Selecione o arquivo CSV do banco para importar as propostas automaticamente.'}
                </p>
                {csvLines.length > 0 ? (
                    <div className="flex flex-col items-center gap-4 animate-in zoom-in-95">
                         <button 
                            onClick={(e) => { e.stopPropagation(); startProcessData(); }}
                            className={`px-16 py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all flex items-center gap-3 ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                         >
                            <Zap size={20} /> 📥 Importar Propostas
                         </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); setCsvLines([]); setDiagnostic([]); setError(null); }}
                            className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:text-red-600"
                         >
                            Trocar Arquivo
                         </button>
                    </div>
                ) : (
                    <button className={`px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl transition-all flex items-center gap-3 mx-auto ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20' : 'bg-slate-900 text-white shadow-slate-300 hover:bg-slate-800'}`}>
                      <FileSpreadsheet size={20} /> Escolher Arquivo CSV
                    </button>
                )}
              </>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          </div>

          <div className={`border rounded-3xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                <button 
                    onClick={() => setShowDiagnostic(!showDiagnostic)}
                    className={`w-full flex items-center justify-between p-6 transition-colors border-b ${isDarkMode ? 'bg-slate-800/50 hover:bg-slate-800 border-slate-800' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}
                >
                    <div className="flex items-center gap-3">
                        <SearchCheck size={20} className="text-blue-600" />
                        <h4 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-909'}`}>🔍 Diagnóstico do Arquivo</h4>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${foundCount === diagnostic.length ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                            {foundCount} de {diagnostic.length} colunas mapeadas
                        </span>
                        <ChevronDown size={20} className={`text-slate-400 transition-transform ${showDiagnostic ? '' : '-rotate-90'}`} />
                    </div>
                </button>
                
                {showDiagnostic && (
                    <div className={`p-8 space-y-6 animate-in slide-in-from-top-2 duration-300 ${isDarkMode ? 'bg-slate-900/40' : 'bg-white'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {diagnostic.map(d => (
                                <div key={d.field} className={`p-4 rounded-2xl border flex items-center justify-between ${d.found ? (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50/30 border-emerald-100') : (isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50/30 border-red-100')}`}>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{d.field}</p>
                                        </div>
                                        <p className={`text-xs font-bold truncate ${d.found ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {d.found ? d.column : 'NÃO IDENTIFICADO (N/I)'}
                                        </p>
                                    </div>
                                    <div className="shrink-0 ml-3">
                                        {d.found ? <CheckCircle2 size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-red-500" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {!diagnostic.every(d => d.found) && (
                            <div className={`flex items-center justify-between p-4 border rounded-2xl ${isDarkMode ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-100'}`}>
                                <div className="flex items-center gap-3">
                                    <AlertCircle size={20} className="text-orange-600" />
                                    <p className={`text-xs font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-800'}`}>O arquivo possui colunas diferentes. Deseja configurar as colunas manualmente?</p>
                                </div>
                                <button 
                                    onClick={() => setIsMappingMode(true)}
                                    className="flex items-center gap-2 text-xs font-black uppercase text-orange-600 hover:text-orange-700"
                                >
                                    Ajuste de Colunas <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      ) : (
        <div className={`rounded-[2.5rem] p-12 border shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-5">
              <div className={`p-5 rounded-2xl text-white shadow-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-900'}`}><Settings2 size={32} /></div>
              <div>
                <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-909'}`}>Configuração Manual de Colunas</h3>
                <p className="text-slate-500 font-medium">Indique a qual dado do sistema cada coluna do seu arquivo corresponde:</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8 mb-12">
            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NOME DO BANCO/LAYOUT</label>
                <input 
                  type="text" 
                  className={`w-full p-4 border rounded-2xl text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-4 focus:ring-slate-100'}`} 
                  value={bankName === 'NEW' ? '' : bankName} 
                  onChange={(e) => setBankName(e.target.value.toUpperCase())} 
                  placeholder="Ex: ITAÚ OFICIAL" 
                />
            </div>
            <MappingField label="ADE / PROPOSTA" options={detectedHeaders} value={mapping.ade} onChange={(val) => setMapping({...mapping, ade: val})} required isDarkMode={isDarkMode} />
            <MappingField label="NOME DO CLIENTE" options={detectedHeaders} value={mapping.cliente} onChange={(val) => setMapping({...mapping, cliente: val})} required isDarkMode={isDarkMode} />
            <MappingField label="CPF" options={detectedHeaders} value={mapping.cpf} onChange={(val) => setMapping({...mapping, cpf: val})} required isDarkMode={isDarkMode} />
            <MappingField label="VALOR PARCELA" options={detectedHeaders} value={mapping.valor} onChange={(val) => setMapping({...mapping, valor: val})} required isDarkMode={isDarkMode} />
            <MappingField label="VALOR FINANCIADO" options={detectedHeaders} value={mapping.valorFinanciado} onChange={(val) => setMapping({...mapping, valorFinanciado: val})} required isDarkMode={isDarkMode} />
            <MappingField label="CONVÊNIO / ÓRGÃO" options={detectedHeaders} value={mapping.convenio} onChange={(val) => setMapping({...mapping, convenio: val})} isDarkMode={isDarkMode} />
            <MappingField label="DIGITADOR / CORRETOR" options={detectedHeaders} value={mapping.corretor} onChange={(val) => setMapping({...mapping, corretor: val})} isDarkMode={isDarkMode} />
            <MappingField label="STATUS DO PORTAL" options={detectedHeaders} value={mapping.atividade} onChange={(val) => setMapping({...mapping, atividade: val})} isDarkMode={isDarkMode} />
            <MappingField label="FASE DE ATUAÇÃO" options={detectedHeaders} value={mapping.fase} onChange={(val) => setMapping({...mapping, fase: val})} isDarkMode={isDarkMode} />
          </div>
          <div className="mt-12 flex items-center justify-between">
             <button onClick={() => setIsMappingMode(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
             <button onClick={handleManualMappingSave} className={`px-20 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
               Salvar e Importar
             </button>
          </div>
        </div>
      )}
      {error && (
        <div className="p-5 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center gap-4 animate-in slide-in-from-left-4">
          <div className="bg-red-100 p-2.5 rounded-xl"><AlertCircle size={24} /></div>
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-tight mb-0.5">Erro de Processamento</p>
            <span className="text-sm font-bold">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const MappingField: React.FC<{ label: string; options: string[]; value: string; onChange: (val: string) => void, required?: boolean; isDarkMode?: boolean }> = ({ label, options, value, onChange, required, isDarkMode }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <select 
        className={`w-full p-4 border rounded-2xl text-sm font-bold outline-none transition-all appearance-none cursor-pointer ${
          value 
            ? (isDarkMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50/20 text-slate-800') 
            : (isDarkMode ? 'border-slate-800 bg-slate-800/50 text-white focus:border-blue-500' : 'border-slate-200 bg-slate-50 text-slate-700 focus:ring-4 focus:ring-slate-100')
        }`} 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Vincular coluna...</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  </div>
);