import React from 'react';
import { motion } from 'motion/react';
import { 
  Calendar,
  Clock,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  LogOut,
  Eye,
  BarChart3,
  ListFilter,
  History
} from 'lucide-react';
import { Avaliacao } from '../types';

interface HomeViewProps {
  onNavigate: (view: 'nova' | 'historico' | 'cqs' | 'realizar' | 'configuracoes') => void;
  evaluations: Avaliacao[];
  onSelectProfile?: () => void;
  onOpenDetails?: (evaluation: Avaliacao) => void;
}

export default function HomeView({ onNavigate, evaluations, onSelectProfile, onOpenDetails }: HomeViewProps) {
  // Compute dashboard statistics
  const total = evaluations.length;
  const agendadas = evaluations.filter(e => e.status === 'AGENDADA').length;
  const emAndamento = evaluations.filter(e => e.status === 'EM ANDAMENTO').length;
  const finalizadas = evaluations.filter(e => e.status === 'FINALIZADA' || e.status === 'Concluída').length;
  
  const aprovadas = evaluations.filter(e => {
    const isCompleted = e.status === 'FINALIZADA' || e.status === 'Concluída';
    if (!isCompleted) return false;
    if (e.tipoCertificacao === 'GPON Veterano' || e.tipoCertificacao === 'GPON Capacitação' || e.tipoCertificacao === 'HFC Capacitação') {
      return e.resultado?.resultado === 'APROVADO';
    }
    return true; // Approved by default for other techs
  }).length;

  const reprovadas = evaluations.filter(e => {
    const isCompleted = e.status === 'FINALIZADA' || e.status === 'Concluída';
    if (!isCompleted) return false;
    if (e.tipoCertificacao === 'GPON Veterano' || e.tipoCertificacao === 'GPON Capacitação' || e.tipoCertificacao === 'HFC Capacitação') {
      return e.resultado?.resultado === 'REPROVADO';
    }
    return false;
  }).length;

  const countByType = {
    'GPON Veterano': evaluations.filter(e => e.tipoCertificacao === 'GPON Veterano').length,
    'GPON Capacitação': evaluations.filter(e => e.tipoCertificacao === 'GPON Capacitação').length,
    'HFC Capacitação': evaluations.filter(e => e.tipoCertificacao === 'HFC Capacitação').length,
  };

  // Get 5 most recent evaluations sorted by createdAt (descending)
  const recentEvaluations = [...evaluations]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Helper for Status Badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AGENDADA':
        return (
          <span className="text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full border border-sky-100">
            Agendada
          </span>
        );
      case 'EM ANDAMENTO':
        return (
          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100 animate-pulse">
            Em andamento
          </span>
        );
      case 'FINALIZADA':
      case 'Concluída':
        return (
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">
            Finalizada
          </span>
        );
      case 'Rascunho':
        return (
          <span className="text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full border border-slate-150">
            Rascunho
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full border border-slate-150">
            {status}
          </span>
        );
    }
  };

  // Helper to format date
  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6 max-w-6xl lg:max-w-7xl mx-auto px-1 py-1" id="home-view-container">
      
      {/* 1. Header Area with Title & Switch Profile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl font-black text-claro-dark tracking-tight leading-none">
            Certificação Prática CQ
          </h1>
          <p className="text-slate-500 text-xs font-semibold">
            Painel gerencial de acompanhamento, indicadores e conformidades de campo.
          </p>
        </div>
      </div>

      {/* 2. Resumo do dia Metrics Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-1.5 text-left">
          <h2 className="text-sm font-black text-claro-dark uppercase tracking-wider">
            Resumo do dia
          </h2>
          <span className="w-1.5 h-1.5 rounded-full bg-claro-red animate-pulse"></span>
        </div>

        {/* 5-Column Responsive Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Agendada */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs relative overflow-hidden text-left min-w-0">
            <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Agendada</span>
              <Calendar size={15} className="text-sky-500" />
            </div>
            <span className="text-2xl font-black text-slate-800 tracking-tight mt-2">{agendadas}</span>
          </div>

          {/* Andamento */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs relative overflow-hidden text-left min-w-0">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Andamento</span>
              <Clock size={15} className="text-amber-500" />
            </div>
            <span className="text-2xl font-black text-slate-800 tracking-tight mt-2">{emAndamento}</span>
          </div>

          {/* Finalizadas */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs relative overflow-hidden text-left min-w-0">
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-600"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Finalizadas</span>
              <ClipboardCheck size={15} className="text-slate-600" />
            </div>
            <span className="text-2xl font-black text-slate-800 tracking-tight mt-2">{finalizadas}</span>
          </div>

          {/* Aprovadas */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs relative overflow-hidden text-left min-w-0">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Aprovadas</span>
              <CheckCircle size={15} className="text-emerald-500" />
            </div>
            <span className="text-2xl font-black text-emerald-600 tracking-tight mt-2">{aprovadas}</span>
          </div>

          {/* Reprovadas */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between shadow-xs relative overflow-hidden text-left min-w-0">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600"></div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Reprovadas</span>
              <XCircle size={15} className="text-claro-red" />
            </div>
            <span className="text-2xl font-black text-claro-red tracking-tight mt-2">{reprovadas}</span>
          </div>
        </div>
      </motion.div>

      {/* 3. Main Dashboard Sections Grid (Distribution & Recent Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Distribuição por certificação */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-5 text-left h-full"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <BarChart3 size={16} className="text-slate-500" />
            <h3 className="font-black text-xs uppercase tracking-wider text-claro-dark">
              Distribuição por certificação
            </h3>
          </div>

          <div className="space-y-6 flex-grow flex flex-col justify-center">
            {/* GPON Veterano */}
            {(() => {
              const count = countByType['GPON Veterano'];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-700">GPON Veterano</span>
                    <span className="font-black text-claro-dark">{pct}% ({count})</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-red-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()}

            {/* GPON Capacitação */}
            {(() => {
              const count = countByType['GPON Capacitação'];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-700">GPON Capacitação</span>
                    <span className="font-black text-claro-dark">{pct}% ({count})</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()}

            {/* HFC Capacitação */}
            {(() => {
              const count = countByType['HFC Capacitação'];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-700">HFC Capacitação</span>
                    <span className="font-black text-claro-dark">{pct}% ({count})</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-slate-700 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </motion.div>

        {/* Right Side: Atividade Recente (Últimas avaliações) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-4 text-left"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ListFilter size={16} className="text-slate-500" />
              <h3 className="font-black text-xs uppercase tracking-wider text-claro-dark">
                Últimas avaliações
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-extrabold">
              Mostrando as 5 mais recentes
            </span>
          </div>

          <div className="overflow-x-auto">
            {recentEvaluations.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <History size={32} className="mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-bold">Nenhuma avaliação cadastrada.</p>
                <p className="text-[10px] text-slate-400">Use as opções do menu lateral para agendar ou realizar certificações.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="pb-3 pr-2">Técnico</th>
                    <th className="pb-3 px-2">Certificação</th>
                    <th className="pb-3 px-2 text-center">Status</th>
                    <th className="pb-3 px-2 text-center">Data</th>
                    <th className="pb-3 pl-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentEvaluations.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3.5 pr-2">
                        <div className="font-extrabold text-xs text-claro-dark group-hover:text-claro-red transition-colors">
                          {item.nomeTecnico}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                          RE: {item.matricula || 'N/A'} • {item.empresa || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="text-xs font-bold text-slate-600">
                          {item.tipoCertificacao}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className="text-xs font-semibold text-slate-500 font-mono">
                          {formatDateString(item.data)}
                        </span>
                      </td>
                      <td className="py-3.5 pl-2 text-right">
                        {onOpenDetails && (
                          <button
                            onClick={() => onOpenDetails(item)}
                            className="inline-flex items-center space-x-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-claro-dark font-black text-[10px] uppercase tracking-wide rounded-lg border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Eye size={12} className="text-slate-400" />
                            <span>Abrir</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
