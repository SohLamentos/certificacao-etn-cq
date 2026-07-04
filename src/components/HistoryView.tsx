import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  SlidersHorizontal, 
  Trash2, 
  Edit3, 
  Eye, 
  ArrowLeft, 
  PlusCircle, 
  Calendar, 
  User, 
  Hash, 
  Building2, 
  Tag, 
  AlertCircle,
  Clock,
  CheckCircle2,
  Filter,
  Wifi,
  Cpu,
  Tv
} from 'lucide-react';
import { Avaliacao, CertificacaoType, AvaliacaoStatus } from '../types';

interface HistoryViewProps {
  evaluations: Avaliacao[];
  onOpen: (evaluation: Avaliacao) => void;
  onEdit: (evaluation: Avaliacao) => void;
  onDelete: (id: string) => void;
  onGoHome: () => void;
  onNew: () => void;
}

export default function HistoryView({ 
  evaluations, 
  onOpen, 
  onEdit, 
  onDelete, 
  onGoHome,
  onNew 
}: HistoryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('Todos');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('Todos');

  // Helper to format date to Brazilian Portuguese format: DD/MM/AAAA
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Filter evaluations based on search term and filter controls
  const filteredEvaluations = evaluations.filter((item) => {
    const matchesSearch = 
      item.nomeTecnico.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nomeCQ.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cidadeBase.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTech = selectedTechFilter === 'Todos' || item.tipoCertificacao === selectedTechFilter;
    const matchesStatus = selectedStatusFilter === 'Todos' || item.status === selectedStatusFilter;

    return matchesSearch && matchesTech && matchesStatus;
  });

  return (
    <div className="max-w-5xl md:max-w-6xl lg:max-w-7xl mx-auto px-4 py-3 space-y-4" id="history-view-container">
      {/* Back Button and Actions Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onGoHome}
          className="flex items-center space-x-1 text-slate-500 hover:text-claro-dark transition-colors font-semibold py-1 px-2 -ml-2 rounded-lg hover:bg-slate-100 cursor-pointer text-xs"
          id="btn-history-back"
        >
          <ArrowLeft size={16} />
          <span>Início</span>
        </button>

        <button
          onClick={onNew}
          className="flex items-center space-x-1.5 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
          id="btn-history-new"
        >
          <PlusCircle size={14} />
          <span>Nova Avaliação</span>
        </button>
      </div>

      {/* View Title */}
      <div className="border-b border-slate-200 pb-2">
        <h2 className="text-xl font-extrabold text-claro-dark tracking-tight leading-none">
          Histórico de Avaliações
        </h2>
        <p className="text-slate-500 text-xs mt-1">
          Gerencie e consulte todas as certificações práticas salvas localmente.
        </p>
      </div>

      {/* Search and Filters Controls Card */}
      <div className="bg-white rounded-2xl border border-claro-border p-3 shadow-sm space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={15} />
          </div>
          <input
            type="text"
            placeholder="Buscar por técnico, matrícula, empresa ou CQ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-claro-red text-xs transition-all"
            id="search-input"
          />
        </div>

        {/* Filter Badges */}
        <div className="space-y-2 pt-0.5">
          {/* Tech Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 min-w-[80px]">
              <Filter size={11} /> Tecnologia:
            </span>
            <div className="flex flex-wrap gap-1">
              {['Todos', 'GPON Veterano', 'GPON Capacitação', 'HFC Capacitação'].map((tech) => (
                <button
                  key={tech}
                  onClick={() => setSelectedTechFilter(tech)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    selectedTechFilter === tech
                      ? 'bg-claro-red text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 min-w-[80px]">
              <SlidersHorizontal size={11} /> Status:
            </span>
            <div className="flex flex-wrap gap-1">
              {['Todos', 'Rascunho', 'Concluída'].map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatusFilter(status)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    selectedStatusFilter === status
                      ? 'bg-claro-dark text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main List Area */}
      {filteredEvaluations.length > 0 ? (
        <div className="space-y-2" id="history-list">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
            <span>Resultados ({filteredEvaluations.length})</span>
            <span>Ações</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <AnimatePresence mode="popLayout">
              {filteredEvaluations.map((item) => {
                // Determine icon based on certification type
                const TechIcon = item.tipoCertificacao === 'HFC Capacitação' 
                  ? Tv 
                  : (item.tipoCertificacao === 'GPON Capacitação' ? Cpu : Wifi);

                const isFinalized = item.status === 'Concluída' || item.status === 'FINALIZADA';
                const hasTeorica = item.notaTeorica !== undefined;
                const isTeoricaReprovado = hasTeorica && item.notaTeorica! < 7;
                const finalResult = isTeoricaReprovado ? 'REPROVADO' : (item.resultado?.resultado || 'APROVADO');
                const formattedTeorica = hasTeorica ? String(item.notaTeorica).replace('.', ',') : null;
                const formattedPratica = isTeoricaReprovado 
                  ? 'Não realizada' 
                  : (item.resultado ? item.resultado.nota.toFixed(1).replace('.', ',') : '10,0');

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => onOpen(item)}
                    className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all text-left cursor-pointer select-none relative overflow-hidden flex items-stretch ${
                      isFinalized 
                        ? 'border-slate-150 opacity-90' 
                        : 'border-slate-200 hover:border-claro-red ring-1 ring-transparent hover:ring-claro-red/20'
                    }`}
                    style={{ minHeight: '85px', maxHeight: '110px' }}
                    id={`eval-card-${item.id}`}
                  >
                    {/* Status vertical accent border */}
                    <div className={`w-1.5 shrink-0 ${
                      isFinalized
                        ? (finalResult === 'APROVADO' ? 'bg-emerald-500' : 'bg-claro-red')
                        : 'bg-amber-500'
                    }`}></div>

                    {/* Content container */}
                    <div className="flex-grow p-3 flex items-center justify-between gap-4">
                      
                      {/* Left: Cert and tech info */}
                      <div className="flex-grow min-w-0 flex flex-col justify-between h-full">
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500">
                          <TechIcon size={13} className="text-slate-400" />
                          <span className="truncate">{item.tipoCertificacao}</span>
                        </div>
                        
                        <div className="my-0.5">
                          <h4 className="text-sm font-black text-slate-950 truncate leading-tight">
                            {item.nomeTecnico}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-bold truncate">
                            {item.matricula} • {item.empresa} • {item.cidadeBase}
                          </p>
                        </div>

                        {/* Result summary if finalized, else date */}
                        {isFinalized ? (
                          <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold mt-0.5">
                            {finalResult === 'APROVADO' ? (
                              <span className="text-emerald-600 font-black">🟢 APROVADO</span>
                            ) : (
                              <span className="text-claro-red font-black">🔴 REPROVADO</span>
                            )}
                            <span className="text-slate-300">|</span>
                            <span>T: <strong className={isTeoricaReprovado ? 'text-claro-red font-extrabold' : 'text-slate-800'}>{formattedTeorica ?? '—'}</strong></span>
                            <span>P: <strong className={isTeoricaReprovado ? 'text-slate-400' : 'text-slate-800'}>{formattedPratica}</strong></span>
                            {isTeoricaReprovado && (
                              <span className="text-[8px] text-red-600 font-black uppercase bg-red-50 border border-red-100 px-1 rounded">
                                T &lt; 7
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                            <Calendar size={10} />
                            <span>{formatDateBR(item.data)}</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Status badge & Click/Action CTA */}
                      <div className="flex flex-col justify-between items-end h-full shrink-0">
                        {/* Status badge in top right */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border leading-none ${
                          isFinalized
                            ? (finalResult === 'APROVADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-claro-red border-red-100')
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {isFinalized ? 'FINALIZADA' : item.status}
                        </span>

                        {/* Actions aligned to the right, clickable within parent */}
                        <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] bg-slate-50 border border-slate-100 p-1 px-1.5 rounded-lg shrink-0 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onOpen(item)}
                            className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Visualizar avaliação completa"
                          >
                            🔒 Ver
                          </button>
                          
                          <span className="text-slate-200 font-normal">|</span>
                          
                          <button
                            onClick={() => onEdit(item)}
                            className="text-amber-600 hover:text-amber-700 transition-colors cursor-pointer"
                            title="Editar avaliação"
                          >
                            Editar
                          </button>
                          
                          <span className="text-slate-200 font-normal">|</span>
                          
                          <button
                            onClick={() => onDelete(item.id)}
                            className="text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                            title="Excluir avaliação permanentemente"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-claro-border p-10 text-center space-y-4 shadow-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center border border-slate-100 shadow-inner">
            <AlertCircle size={28} />
          </div>
          <div className="max-w-xs space-y-1">
            <h3 className="font-extrabold text-base text-claro-dark">
              Nenhum registro encontrado
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Não há avaliações que correspondam aos filtros de busca aplicados.
            </p>
          </div>
          {evaluations.length === 0 ? (
            <button
              onClick={onNew}
              className="bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Criar Primeira Avaliação
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTechFilter('Todos');
                setSelectedStatusFilter('Todos');
              }}
              className="text-claro-red hover:underline text-xs font-bold"
            >
              Limpar Filtros de Busca
            </button>
          )}
        </div>
      )}
    </div>
  );
}
