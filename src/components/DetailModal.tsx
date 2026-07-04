import React from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  User, 
  Hash, 
  Building2, 
  MapPin, 
  UserCheck, 
  Calendar, 
  CheckCircle, 
  FileText, 
  Printer, 
  Clock, 
  ShieldCheck,
  Wifi,
  Cpu,
  Tv,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { Avaliacao } from '../types';
import { GPON_VETERANO_ITEMS, HFC_24_ITEMS, HFC_24_GROUPS, GPON_CAPACITACAO_ITEMS, GPON_CAPACITACAO_GROUPS } from '../data/checklist';

interface DetailModalProps {
  evaluation: Avaliacao;
  onClose: () => void;
  onEdit: () => void;
}

export default function DetailModal({ evaluation, onClose, onEdit }: DetailModalProps) {
  // Helper to format date to Brazilian Portuguese format: DD/MM/AAAA
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Determine icon based on certification type
  const TechIcon = evaluation.tipoCertificacao === 'HFC Capacitação' 
    ? Tv 
    : (evaluation.tipoCertificacao === 'GPON Capacitação' ? Cpu : Wifi);

  const isGponVeterano = evaluation.tipoCertificacao === 'GPON Veterano';
  const isGponCapacitacao = evaluation.tipoCertificacao === 'GPON Capacitação';
  const isHfc24 = evaluation.tipoCertificacao === 'HFC Capacitação';
  const isActiveTech = isGponVeterano || isGponCapacitacao || isHfc24;
  const activeItems = isGponVeterano 
    ? GPON_VETERANO_ITEMS 
    : (isGponCapacitacao ? GPON_CAPACITACAO_ITEMS : (isHfc24 ? HFC_24_ITEMS : []));
  
  const isGroupedChecklist = isHfc24 || isGponCapacitacao;
  const activeGroups = isGponCapacitacao ? GPON_CAPACITACAO_GROUPS : (isHfc24 ? HFC_24_GROUPS : []);
  const hasResults = evaluation.resultado !== undefined;

  // Render status badge for header
  const getHeaderBadgeClass = () => {
    if (evaluation.status === 'Rascunho') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (isActiveTech && evaluation.resultado) {
      return evaluation.resultado.resultado === 'APROVADO'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  const getHeaderBadgeText = () => {
    if (evaluation.status === 'Rascunho') return 'Rascunho';
    if (isActiveTech && evaluation.resultado) {
      return evaluation.resultado.resultado === 'APROVADO' ? 'APROVADO' : 'REPROVADO';
    }
    return 'Concluída';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl border border-claro-border w-full max-w-2xl overflow-hidden shadow-2xl relative my-8"
        id="detail-modal"
      >
        {/* Modal Colored Header Banner */}
        <div className={`p-5 text-white flex items-center justify-between ${
          evaluation.status === 'Rascunho' 
            ? 'bg-amber-500' 
            : (isActiveTech && evaluation.resultado?.resultado === 'REPROVADO' ? 'bg-claro-red' : 'bg-emerald-600')
        }`}>
          <div className="flex items-center space-x-3">
            <div className="bg-white/15 p-2 rounded-xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg tracking-tight">Ficha de Avaliação Prática</h3>
              <p className="text-xs text-white/80 font-medium">
                Status: {evaluation.status} | Código: {evaluation.id.substring(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="bg-black/15 hover:bg-black/25 active:bg-black/35 text-white p-2 rounded-full transition-all cursor-pointer"
            title="Fechar"
            id="btn-detail-close-top"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Header Specs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Technician info */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Dados do Técnico de Campo
              </span>
              
              <div className="space-y-2">
                <div className="flex items-start space-x-2.5">
                  <User size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="block text-xs text-slate-500 leading-none">Nome completo</span>
                    <strong className="text-sm text-claro-dark font-extrabold">{evaluation.nomeTecnico}</strong>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <Hash size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="block text-xs text-slate-500 leading-none">Matrícula</span>
                    <strong className="text-sm text-slate-800 font-extrabold uppercase">{evaluation.matricula}</strong>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <Building2 size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="block text-xs text-slate-500 leading-none">Empresa parceira</span>
                    <strong className="text-sm text-slate-800 font-bold">{evaluation.empresa}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* QA Inspector info */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Controle de Qualidade (CQ)
              </span>

              <div className="space-y-2">
                <div className="flex items-start space-x-2.5">
                  <UserCheck size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="block text-xs text-slate-500 leading-none">Avaliador Responsável</span>
                    <strong className="text-sm text-slate-800 font-bold">{evaluation.nomeCQ}</strong>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <MapPin size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="block text-xs text-slate-500 leading-none">Cidade / Base</span>
                    <strong className="text-sm text-slate-800 font-bold">{evaluation.cidadeBase}</strong>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <Calendar size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="block text-xs text-slate-500 leading-none">Data do checklist</span>
                    <strong className="text-sm text-slate-800 font-bold">{formatDateBR(evaluation.data)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technology type panel */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-claro-dark text-white p-2.5 rounded-xl">
                <TechIcon size={20} />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Tecnologia Avaliada</span>
                <strong className="text-base text-claro-dark font-extrabold">{evaluation.tipoCertificacao}</strong>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${getHeaderBadgeClass()}`}>
              {evaluation.status === 'Rascunho' ? (
                <Clock size={11} className="stroke-[3]" />
              ) : (
                <CheckCircle2 size={11} className="stroke-[3]" />
              )}
              {getHeaderBadgeText()}
            </span>
          </div>

          {/* Universal Grades Summary Section */}
          {evaluation.notaTeorica !== undefined && (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 space-y-3 animate-fade-in">
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                Resumo do Rendimento
              </span>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <span className="block text-[9px] text-slate-400 uppercase font-black">Nota Teórica</span>
                  <strong className="text-base font-black text-slate-800">
                    {String(evaluation.notaTeorica).replace('.', ',')}
                  </strong>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <span className="block text-[9px] text-slate-400 uppercase font-black">Nota Prática</span>
                  <strong className="text-base font-black text-slate-800">
                    {evaluation.resultado ? evaluation.resultado.nota.toFixed(1).replace('.', ',') : '10,0'}
                  </strong>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <span className="block text-[9px] text-slate-400 uppercase font-black">Resultado Final</span>
                  <strong className={`text-[10px] font-black uppercase leading-tight block mt-1 py-1 rounded ${
                    (evaluation.resultado?.resultado || 'APROVADO') === 'APROVADO' && evaluation.notaTeorica >= 7
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-red-600 bg-red-50'
                  }`}>
                    {(evaluation.resultado?.resultado || 'APROVADO') === 'APROVADO' && evaluation.notaTeorica >= 7
                      ? 'APROVADO'
                      : 'REPROVADO'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Checklist Evaluation Results (GPON or HFC specific layout) */}
          {isActiveTech ? (
            <div className="space-y-4 pt-1">
              
              {/* If completed, show performance scores */}
              {hasResults && evaluation.resultado && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Resumo do Aproveitamento Prático
                  </h4>
                  
                  {/* Score box */}
                  <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
                    evaluation.resultado.resultado === 'APROVADO'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <div className="flex items-center space-x-3 w-full md:w-auto">
                      <div className={`p-2 rounded-xl text-white flex-shrink-0 ${
                        evaluation.resultado.resultado === 'APROVADO' ? 'bg-emerald-500' : 'bg-claro-red'
                      }`}>
                        {evaluation.resultado.resultado === 'APROVADO' ? (
                          <CheckCircle2 size={24} className="stroke-[2.5]" />
                        ) : (
                          <AlertCircle size={24} className="stroke-[2.5]" />
                        )}
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold tracking-wider opacity-75">
                          Diagnóstico da Avaliação
                        </span>
                        <strong className="text-lg font-black uppercase tracking-tight">
                          {evaluation.resultado.resultado === 'APROVADO' ? 'Certificado (Aprovado)' : 'Não Certificado (Reprovado)'}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-current border-opacity-10">
                      <div className="text-left md:text-right">
                        <span className="block text-[10px] font-bold uppercase opacity-75">Nota</span>
                        <strong className="text-2xl font-black">{evaluation.resultado.nota.toFixed(1).replace('.', ',')}</strong>
                      </div>
                      <div className="text-left md:text-right">
                        <span className="block text-[10px] font-bold uppercase opacity-75">Conformidades</span>
                        <strong className="text-2xl font-black">{evaluation.resultado.acertos} <span className="text-xs opacity-75 font-normal">/ {evaluation.resultado.totalAvaliado}</span></strong>
                      </div>
                    </div>
                  </div>

                  {/* Motivos de Reprovação block if any */}
                  {evaluation.resultado.resultado === 'REPROVADO' && evaluation.resultado.motivoReprovacao && (
                    <div className="bg-red-50 border-l-4 border-l-claro-red p-4 rounded-xl flex items-start space-x-2.5">
                      <AlertTriangle size={18} className="text-claro-red mt-0.5 flex-shrink-0" />
                      <div>
                        <strong className="text-xs text-claro-red uppercase tracking-wider block">Motivo do Reprovado:</strong>
                        <p className="text-xs text-slate-700 font-bold leading-normal mt-0.5">
                          {evaluation.resultado.motivoReprovacao}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Checklist Items list */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Respostas do Checklist ({activeItems.length} itens)
                </h4>

                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                  {isGroupedChecklist ? (
                    activeGroups.map((g) => {
                      const groupItems = activeItems.filter(item => item.id >= g.startId && item.id <= g.endId);
                      const groupAnsweredCount = groupItems.filter(item => evaluation.checklistResponses?.[item.id] !== undefined).length;

                      return (
                        <div key={g.id} className="divide-y divide-slate-100">
                          {/* Group Divider Header */}
                          <div className="bg-slate-50/70 px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between border-b border-slate-100">
                            <span>{g.nome}</span>
                            <span className="bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full text-[9px]">
                              {groupAnsweredCount} de {g.total} itens
                            </span>
                          </div>

                          {groupItems.map((item) => {
                            const response = evaluation.checklistResponses?.[item.id];
                            const isCritical = item.critico;

                            // Response formatting helpers
                            let badgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
                            let badgeText = 'Sem Resposta';
                            if (response === 'Fez') {
                              badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 font-extrabold';
                              badgeText = 'Fez';
                            } else if (response === 'NaoFez') {
                              badgeClass = 'bg-red-50 text-red-700 border-red-100 font-extrabold';
                              badgeText = 'Não fez';
                            } else if (response === 'NA') {
                              badgeClass = 'bg-slate-50 text-slate-600 border-slate-100';
                              badgeText = 'N/A';
                            }

                            return (
                              <div key={item.id} className={`p-3.5 flex items-start gap-4 justify-between transition-colors border-l-4 ${
                                isCritical 
                                  ? 'border-l-claro-red bg-red-50/5 hover:bg-red-50/10' 
                                  : 'border-l-transparent hover:bg-slate-50/50'
                              }`}>
                                <div className="space-y-1 max-w-[75%]">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      #{item.id}
                                    </span>
                                    {isCritical && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-claro-red bg-red-50 border border-red-100 px-1.5 py-0.5 rounded uppercase">
                                        <AlertTriangle size={8} className="fill-claro-red text-white" />
                                        ITEM CRÍTICO
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-800 font-bold leading-normal">
                                    {item.pergunta}
                                  </p>
                                </div>

                                <span className={`px-2.5 py-1 rounded-lg text-xs border self-start ${badgeClass}`}>
                                  {badgeText}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  ) : (
                    activeItems.map((item) => {
                      const response = evaluation.checklistResponses?.[item.id];
                      const isCritical = item.critico;

                      // Response formatting helpers
                      let badgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
                      let badgeText = 'Sem Resposta';
                      if (response === 'Fez') {
                        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 font-extrabold';
                        badgeText = 'Fez';
                      } else if (response === 'NaoFez') {
                        badgeClass = 'bg-red-50 text-red-700 border-red-100 font-extrabold';
                        badgeText = 'Não fez';
                      } else if (response === 'NA') {
                        badgeClass = 'bg-slate-50 text-slate-600 border-slate-100';
                        badgeText = 'N/A';
                      }

                      return (
                        <div key={item.id} className={`p-3.5 flex items-start gap-4 justify-between transition-colors border-l-4 ${
                          isCritical 
                            ? 'border-l-claro-red bg-red-50/5 hover:bg-red-50/10' 
                            : 'border-l-transparent hover:bg-slate-50/50'
                        }`}>
                          <div className="space-y-1 max-w-[75%]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                #{item.id}
                              </span>
                              {isCritical && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-claro-red bg-red-50 border border-red-100 px-1.5 py-0.5 rounded uppercase">
                                  <AlertTriangle size={8} className="fill-claro-red text-white" />
                                  ITEM CRÍTICO
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-800 font-bold leading-normal">
                              {item.pergunta}
                            </p>
                          </div>

                          <span className={`px-2.5 py-1 rounded-lg text-xs border self-start ${badgeClass}`}>
                            {badgeText}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          ) : (
            /* Other technologies (GPON Capacitação) default empty state */
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Itens Verificados na Certificação Prática
              </h4>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3 bg-slate-50/50">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto border border-slate-200">
                  <TechIcon size={18} />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <p className="text-sm font-extrabold text-slate-700">
                    Estrutura de Checklist Disponível
                  </p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    "Os itens desta certificação serão configurados posteriormente."
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-5 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer order-2 sm:order-1"
          >
            <Printer size={15} />
            <span>Imprimir Ficha</span>
          </button>

          <button
            onClick={() => {
              onEdit();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-claro-dark hover:bg-neutral-800 active:bg-neutral-900 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer order-1 sm:order-2"
          >
            <FileText size={15} />
            <span>Editar Registro</span>
          </button>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-black rounded-xl text-xs transition-colors shadow-sm cursor-pointer order-3"
            id="btn-detail-close-bottom"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
