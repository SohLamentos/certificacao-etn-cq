import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  User, 
  Hash, 
  Building2, 
  MapPin, 
  Wifi, 
  Cpu, 
  Tv, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  Search, 
  Lock, 
  Eye,
  RefreshCw,
  LogOut,
  Sliders,
  Sparkles
} from 'lucide-react';
import { Avaliacao, CertificacaoType, AvaliacaoStatus, CQ } from '../types';
import { getDynamicChecklistItems, calcularResultadoDinamico, getDynamicCertificacoes, getIconComponent } from '../data/dynamicChecklist';

interface CQAvaliacoesDoDiaProps {
  evaluations: Avaliacao[];
  onSelectEvaluation: (evaluation: Avaliacao) => void;
  onOpenDetails: (evaluation: Avaliacao) => void;
  onSwitchProfile: () => void;
  selectedCQ: CQ;
  onSwitchCQ: () => void;
  onUpdateEvaluation: (evaluation: Avaliacao) => void;
}

export default function CQAvaliacoesDoDia({ 
  evaluations, 
  onSelectEvaluation, 
  onOpenDetails,
  onSwitchProfile,
  selectedCQ,
  onSwitchCQ,
  onUpdateEvaluation
}: CQAvaliacoesDoDiaProps) {
  // Date state: defaults to today's local date (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState('');
  const [cqs, setCqs] = useState<CQ[]>([]);

  // Local draft states for theoretical grade inputs
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const saved = localStorage.getItem('claro_cq_cadastrados');
    if (saved) {
      try {
        setCqs(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const handleNoteChange = (id: string, value: string) => {
    setDraftNotes(prev => ({ ...prev, [id]: value }));
    if (noteErrors[id]) {
      setNoteErrors(prev => ({ ...prev, [id]: '' }));
    }
  };

  const handleSaveNote = (item: Avaliacao, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const noteVal = draftNotes[item.id] !== undefined 
      ? draftNotes[item.id] 
      : (item.notaTeorica !== undefined ? String(item.notaTeorica).replace('.', ',') : '');

    const normalized = noteVal.trim().replace(',', '.');
    if (normalized === '') {
      setNoteErrors(prev => ({ ...prev, [item.id]: 'Informe a nota' }));
      return;
    }
    const parsed = parseFloat(normalized);
    if (isNaN(parsed) || parsed < 0 || parsed > 10) {
      setNoteErrors(prev => ({ ...prev, [item.id]: 'Nota de 0 a 10' }));
      return;
    }

    // Ready to save!
    // If parsed < 7, the evaluation must be finalized automatically
    let updatedEval: Avaliacao;
    if (parsed < 7) {
      // Finalize evaluation dynamically
      const certItems = getDynamicChecklistItems().filter(i => i.certificacao === item.tipoCertificacao && i.ativo);
      const resultado = calcularResultadoDinamico(certItems, {}, parsed);
      
      updatedEval = {
        ...item,
        notaTeorica: parsed,
        status: 'FINALIZADA',
        resultado,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Keep available for practice
      updatedEval = {
        ...item,
        notaTeorica: parsed,
        // If it was FINALIZADA because of previous < 7, change status back to AGENDADA so they can do practical
        status: item.status === 'FINALIZADA' ? 'AGENDADA' : item.status,
        resultado: undefined, // Clear failure result since they are now >= 7 and need practical
        updatedAt: new Date().toISOString()
      };
    }

    // Call parent callback to persist
    onUpdateEvaluation(updatedEval);
  };

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  }, []);

  // Filter evaluations for the selected date and selected CQ with profile validation
  const filtered = evaluations.filter(e => {
    const isDateMatch = e.data === selectedDate;
    const isCQMatch = e.nomeCQ === selectedCQ.nome;
    if (!isDateMatch || !isCQMatch) return false;

    // Perfil must match
    const evaluatorCQ = cqs.find(c => c.nome === e.nomeCQ);
    const evaluatorProfile = evaluatorCQ ? (evaluatorCQ.perfil || 'CQ') : 'CQ';
    const targetProfile = selectedCQ.perfil || 'CQ';
    return evaluatorProfile === targetProfile;
  });

  // Status mapping to Brazilian Portuguese labels and colors
  const getStatusDisplay = (status: AvaliacaoStatus) => {
    switch (status) {
      case 'AGENDADA':
        return {
          label: 'Agendada',
          color: 'bg-blue-50 text-blue-700 border-blue-100',
          dot: 'bg-blue-500'
        };
      case 'EM ANDAMENTO':
      case 'Rascunho':
        return {
          label: 'Andamento',
          color: 'bg-amber-50 text-amber-700 border-amber-100',
          dot: 'bg-amber-500'
        };
      case 'FINALIZADA':
      case 'Concluída':
        return {
          label: 'Finalizada',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          dot: 'bg-emerald-500'
        };
      default:
        return {
          label: status,
          color: 'bg-slate-50 text-slate-700 border-slate-100',
          dot: 'bg-slate-500'
        };
    }
  };

  const getTechIcon = (type: CertificacaoType) => {
    const certs = getDynamicCertificacoes();
    const cert = certs.find(c => c.nome === type);
    if (cert) {
      return getIconComponent(cert.icone);
    }
    return Sliders;
  };

  // Quick helper to seed/schedule an evaluation for today to make testing a breeze!
  const handleCreateMockToday = () => {
    if (!selectedDate) return;
    
    // Dispatch a custom event or we can let the parent handle it.
    // For ease, we can simulate creating a dummy scheduled item for today.
    const mockNames = ['Júlio Cezar', 'Anderson Santos', 'Marcos Oliveira', 'Felipe Costa'];
    const activeCerts = getDynamicCertificacoes().filter(c => c.ativa).map(c => c.nome);
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const randomCert = activeCerts.length > 0 ? activeCerts[Math.floor(Math.random() * activeCerts.length)] : 'GPON Veterano';
    
    const newEval: Avaliacao = {
      id: 'eval-mock-' + Date.now(),
      nomeTecnico: randomName,
      matricula: 'TR' + Math.floor(100000 + Math.random() * 900000),
      empresa: 'Icomon Tecnologia',
      cidadeBase: selectedCQ.cidadeBase,
      nomeCQ: selectedCQ.nome,
      data: selectedDate,
      tipoCertificacao: randomCert,
      status: 'AGENDADA',
      checklistResponses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Trigger local storage save directly & trigger reload
    const saved = localStorage.getItem('claro_cq_certificacoes');
    let list: Avaliacao[] = [];
    if (saved) {
      try { list = JSON.parse(saved); } catch (e) {}
    }
    list = [newEval, ...list];
    localStorage.setItem('claro_cq_certificacoes', JSON.stringify(list));
    
    // Refresh page / state by reloading since we are in localStorage
    window.location.reload();
  };

  return (
    <div className="max-w-5xl md:max-w-6xl lg:max-w-7xl mx-auto px-4 py-3 space-y-4" id="cq-avaliacoes-dia-container">
      
      {/* Header section with selected CQ details & action buttons - Compact horizontal */}
      <div className="bg-white rounded-2xl border border-claro-border p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 text-claro-red p-2 rounded-xl flex-shrink-0">
            <User size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                selectedCQ.perfil === 'Analista' ? 'bg-blue-600' : 'bg-red-600'
              }`}>
                Perfil: {selectedCQ.perfil || 'CQ'}
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-100">
                Conectado
              </span>
            </div>
            <h2 className="text-base font-black text-slate-800 tracking-tight leading-none mt-1">
              {selectedCQ.nome}
            </h2>
            <div className="flex items-center space-x-1 text-slate-400 text-xs font-bold mt-0.5">
              <MapPin size={11} />
              <span>{selectedCQ.cidadeBase}</span>
            </div>
          </div>
        </div>

        <div className="w-full sm:w-auto text-right">
          <button
            onClick={onSwitchCQ}
            className="w-full sm:w-auto text-center text-xs text-slate-600 hover:text-claro-red font-bold py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-slate-200"
            id="btn-cq-switch-cq"
          >
            {selectedCQ.perfil === 'Analista' ? 'Trocar Analista' : 'Trocar CQ'}
          </button>
        </div>
      </div>

      {/* Date Selector Card - compact single-line layout */}
      <div className="bg-white rounded-2xl border border-claro-border p-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex-shrink-0">
          Selecione a Data de Avaliação
        </label>
        <div className="relative w-full sm:w-48">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Calendar size={14} />
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-claro-red"
            id="cq-date-picker"
          />
        </div>
      </div>

      {/* Evaluations List for selected Date */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Programadas para o dia ({filtered.length})
          </h3>

          <button
            onClick={handleCreateMockToday}
            className="flex items-center space-x-1 text-[10px] bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded-md transition-colors cursor-pointer"
            title="Simular um agendamento rápido para a data selecionada para testar"
          >
            <Sparkles size={11} className="text-amber-500" />
            <span>Simular Agendamento</span>
          </button>
        </div>

        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((item) => {
                const statusDetails = getStatusDisplay(item.status);
                const TechIcon = getTechIcon(item.tipoCertificacao);
                const isFinalized = item.status === 'FINALIZADA' || item.status === 'Concluída';
                const hasTeorica = item.notaTeorica !== undefined;
                const isTeoricaReprovado = hasTeorica && item.notaTeorica! < 7;
                const finalResult = isTeoricaReprovado ? 'REPROVADO' : (item.resultado?.resultado || 'APROVADO');
                const formattedTeorica = hasTeorica ? String(item.notaTeorica).replace('.', ',') : null;
                const formattedPratica = isTeoricaReprovado 
                  ? 'Não realizada' 
                  : (item.resultado ? item.resultado.nota.toFixed(1).replace('.', ',') : '10,0');

                const formatDateBR = (dateStr: string) => {
                  if (!dateStr) return '';
                  const parts = dateStr.split('-');
                  if (parts.length !== 3) return dateStr;
                  return `${parts[2]}/${parts[1]}/${parts[0]}`;
                };

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => {
                      if (isFinalized) {
                        onOpenDetails(item);
                      } else if (hasTeorica && !isTeoricaReprovado) {
                        onSelectEvaluation(item);
                      }
                    }}
                    className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all text-left cursor-pointer select-none relative overflow-hidden flex items-stretch ${
                      isFinalized 
                        ? 'border-slate-150 opacity-90' 
                        : 'border-slate-200 hover:border-claro-red ring-1 ring-transparent hover:ring-claro-red/20'
                    }`}
                    style={{ minHeight: '85px' }}
                    id={`eval-card-${item.id}`}
                  >
                    {/* Status vertical accent border */}
                    <div className={`w-1.5 shrink-0 ${
                      isFinalized
                        ? (finalResult === 'APROVADO' ? 'bg-emerald-500' : 'bg-claro-red')
                        : item.status === 'EM ANDAMENTO' || item.status === 'Rascunho'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                    }`}></div>

                    {/* Content container */}
                    <div className="flex-grow p-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Left Column: Cert, tech details, and status badge */}
                      <div className="flex-grow min-w-0 flex flex-col justify-center space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500">
                          <TechIcon size={13} className="text-slate-400" />
                          <span className="truncate">{item.tipoCertificacao}</span>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-black text-slate-950 truncate leading-tight">
                            {item.nomeTecnico}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-bold truncate">
                            {item.matricula} • {item.empresa} • {item.cidadeBase}
                          </p>
                        </div>

                        {/* Status + Grade Results Row */}
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border leading-none ${
                            isFinalized
                              ? (finalResult === 'APROVADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-claro-red border-red-100')
                              : statusDetails.color
                          }`}>
                            {isFinalized ? 'FINALIZADA' : statusDetails.label}
                          </span>

                          {isFinalized ? (
                            <div className="flex items-center gap-1 text-[10px] text-slate-600 font-bold">
                              <span>T: <strong className={isTeoricaReprovado ? 'text-claro-red font-extrabold' : 'text-slate-800'}>{formattedTeorica ?? '—'}</strong></span>
                              <span className="text-slate-300">|</span>
                              <span>P: <strong className={isTeoricaReprovado ? 'text-slate-400' : 'text-slate-800'}>{formattedPratica}</strong></span>
                              {isTeoricaReprovado && (
                                <span className="text-[8px] text-red-600 font-black uppercase bg-red-50 border border-red-100 px-1 rounded ml-1">
                                  T &lt; 7
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                              <Calendar size={10} />
                              <span>{formatDateBR(item.data)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle Column: Inline Theoretical Grade Input (only when not finalized) */}
                      {!isFinalized && (
                        <div 
                          className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-100 rounded-lg p-1.5 self-start md:self-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5 leading-none flex items-center gap-1 flex-wrap">
                              <span>Nota Teórica</span>
                              {hasTeorica && (
                                <span className="text-emerald-600 font-extrabold text-[8px] uppercase">✓ Salva ({String(item.notaTeorica).replace('.', ',')})</span>
                              )}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="0,0"
                                value={draftNotes[item.id] !== undefined ? draftNotes[item.id] : (item.notaTeorica !== undefined ? String(item.notaTeorica).replace('.', ',') : '')}
                                onChange={(e) => handleNoteChange(item.id, e.target.value)}
                                className="w-12 h-7 bg-white rounded border border-slate-200 text-center text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500/20 focus:border-claro-red"
                              />
                              <button
                                onClick={(e) => handleSaveNote(item, e)}
                                className="px-2.5 h-7 bg-claro-dark hover:bg-slate-800 active:bg-slate-900 text-white font-extrabold text-[10px] rounded transition-all cursor-pointer flex items-center justify-center space-x-1"
                                title="Salvar nota teórica"
                              >
                                <span>Salvar</span>
                              </button>
                            </div>
                            {noteErrors[item.id] && (
                              <span className="text-[9px] text-red-600 font-bold mt-0.5 leading-none animate-fade-in">
                                {noteErrors[item.id]}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Right Column: Dynamic Action Buttons */}
                      <div 
                        className="flex flex-col items-end justify-center shrink-0 min-w-[125px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isFinalized ? (
                          <button
                            onClick={() => onOpenDetails(item)}
                            className="w-full px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Eye size={12} />
                            <span>Ver Resultado</span>
                          </button>
                        ) : hasTeorica && !isTeoricaReprovado ? (
                          <button
                            onClick={() => onSelectEvaluation(item)}
                            className="w-full px-3 py-1.5 bg-claro-red hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                          >
                            <span>Abrir Checklist</span>
                            <ChevronRight size={12} />
                          </button>
                        ) : (
                          <div className="w-full flex flex-col items-end">
                            <button
                              disabled
                              className="w-full px-3 py-1.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-lg cursor-not-allowed flex items-center justify-center gap-1"
                            >
                              <span>Prática Bloqueada</span>
                            </button>
                            <span className="text-[9px] text-amber-600 font-bold mt-1 text-right max-w-[140px] leading-tight block">
                              Informe a nota teórica para liberar a prática
                            </span>
                          </div>
                        )}
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl border border-claro-border p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-sm min-h-[200px]"
            >
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <Calendar size={20} />
              </div>
              <div className="max-w-xs space-y-1">
                <h4 className="font-extrabold text-xs text-claro-dark uppercase tracking-wider">
                  Nenhuma avaliação para hoje
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Selecione outra data ou solicite ao analista o agendamento de testes de campo para este dia.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
