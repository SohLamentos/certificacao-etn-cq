import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ChevronRight, 
  UserPlus, 
  FileCheck,
  ShieldCheck,
  Smartphone,
  Check,
  LayoutDashboard,
  CalendarPlus,
  ClipboardCheck,
  History,
  Users,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';

import Header from './components/Header';
import HomeView from './components/HomeView';
import FormView from './components/FormView';
import HistoryView from './components/HistoryView';
import DetailModal from './components/DetailModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import CQAvaliacoesDoDia from './components/CQAvaliacoesDoDia';
import CQManagerView from './components/CQManagerView';
import CQIdentificationGate from './components/CQIdentificationGate';
import AnalistaIdentificationGate from './components/AnalistaIdentificationGate';
import SettingsView from './components/SettingsView';
import { Avaliacao, CertificacaoType, AvaliacaoStatus, ChecklistValue, CQ } from './types';
import { getDynamicChecklistItems, calcularResultadoDinamico } from './data/dynamicChecklist';

const LOCAL_STORAGE_KEY = 'claro_cq_certificacoes';

// Mock initial data to populate the app beautifully on first run
const SEED_DATA: Avaliacao[] = [
  {
    id: 'seed-1',
    nomeTecnico: 'Marcos Vinícius Silva',
    matricula: 'TR551234',
    empresa: 'Claro S/A (Próprio)',
    cidadeBase: 'Rio de Janeiro - Base Centro',
    nomeCQ: 'Pedro Henrique CQ',
    data: '2026-06-25',
    tipoCertificacao: 'GPON Veterano',
    status: 'Concluída',
    checklistResponses: {
      1: 'Fez',
      2: 'Fez',
      3: 'Fez', // Crítico
      4: 'Fez',
      5: 'Fez', // Crítico
      6: 'Fez',
      7: 'Fez',
      8: 'Fez', // Crítico
      9: 'Fez', // Crítico
      10: 'Fez',
      11: 'Fez',
      12: 'NaoFez' // Não fez (não crítico)
    },
    resultado: {
      totalAvaliado: 12,
      acertos: 11,
      nota: 9.2,
      resultado: 'APROVADO',
      itensNaoRealizados: [12],
      itensCriticosNaoRealizados: []
    },
    createdAt: '2026-06-25T10:30:00.000Z',
    updatedAt: '2026-06-25T11:15:00.000Z'
  },
  {
    id: 'seed-2',
    nomeTecnico: 'Ana Clara Oliveira',
    matricula: 'TR884321',
    empresa: 'Icomon Tecnologia',
    cidadeBase: 'São Paulo - Base Leste',
    nomeCQ: 'Mariana Costa CQ',
    data: '2026-07-01',
    tipoCertificacao: 'GPON Capacitação',
    status: 'Rascunho',
    checklistResponses: {},
    createdAt: '2026-07-01T14:22:00.000Z',
    updatedAt: '2026-07-01T14:22:00.000Z'
  },
  {
    id: 'seed-3',
    nomeTecnico: 'Gabriel Henrique Santos',
    matricula: 'TR992211',
    empresa: 'Serede S/A',
    cidadeBase: 'Belo Horizonte - Base Norte',
    nomeCQ: 'Julio Cesar CQ',
    data: '2026-07-03',
    tipoCertificacao: 'HFC Capacitação',
    status: 'Concluída',
    checklistResponses: {},
    createdAt: '2026-07-03T09:00:00.000Z',
    updatedAt: '2026-07-03T09:12:00.000Z'
  }
];

interface ToastState {
  message: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  const [currentProfile, setCurrentProfile] = useState<'analista' | 'cq' | null>(() => {
    const saved = localStorage.getItem('claro_cq_profile');
    return (saved as 'analista' | 'cq' | null) || null;
  });

  const [selectedCQ, setSelectedCQ] = useState<CQ | null>(() => {
    const saved = localStorage.getItem('claro_cq_selecionado');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const handleSelectCQ = (cq: CQ | null) => {
    setSelectedCQ(cq);
    if (cq) {
      localStorage.setItem('claro_cq_selecionado', JSON.stringify(cq));
    } else {
      localStorage.removeItem('claro_cq_selecionado');
    }
  };

  const [currentView, setCurrentView] = useState<string>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPerformingCert, setIsPerformingCert] = useState(false);

  const [selectedAnalista, setSelectedAnalista] = useState<CQ | null>(() => {
    const saved = localStorage.getItem('claro_analista_selecionado');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const handleSelectAnalista = (analista: CQ | null) => {
    setSelectedAnalista(analista);
    if (analista) {
      localStorage.setItem('claro_analista_selecionado', JSON.stringify(analista));
    } else {
      localStorage.removeItem('claro_analista_selecionado');
    }
  };

  const handleSelectProfile = (profile: 'analista' | 'cq' | null) => {
    setCurrentProfile(profile);
    if (profile) {
      localStorage.setItem('claro_cq_profile', profile);
    } else {
      localStorage.removeItem('claro_cq_profile');
    }
    setCurrentView('home');
    setEditingEvaluation(null);
    setIsMobileMenuOpen(false);
    setIsPerformingCert(false);
  };
  const [evaluations, setEvaluations] = useState<Avaliacao[]>([]);
  
  // Modals / Overlays
  const [editingEvaluation, setEditingEvaluation] = useState<Avaliacao | null>(null);
  const [viewingEvaluation, setViewingEvaluation] = useState<Avaliacao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Toast notifications
  const [toast, setToast] = useState<ToastState | null>(null);

  // Load evaluations from localStorage or seed them on first mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setEvaluations(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse saved evaluations', err);
        setEvaluations(SEED_DATA);
      }
    } else {
      // First run, populate with seed data and save
      setEvaluations(SEED_DATA);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_DATA));
    }
  }, []);

  // Show a floating toast message helper
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // Automatically clear toast after 3.5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Navigate back to home and reset active edits
  const handleGoHome = () => {
    setCurrentView('home');
    setEditingEvaluation(null);
  };

  // Trigger form view for creating a new evaluation
  const handleStartNew = () => {
    setEditingEvaluation(null);
    setCurrentView('nova');
  };

  // Trigger form view for editing an existing evaluation
  const handleEditTrigger = (evaluation: Avaliacao) => {
    setEditingEvaluation(evaluation);
    setCurrentView('nova');
  };

  // Trigger viewing details modal
  const handleOpenTrigger = (evaluation: Avaliacao) => {
    setViewingEvaluation(evaluation);
  };

  // Save changes (creates new or updates existing)
  const handleSaveEvaluation = (
    formData: {
      nomeTecnico: string;
      matricula: string;
      empresa: string;
      cidadeBase: string;
      nomeCQ: string;
      data: string;
      tipoCertificacao: CertificacaoType;
      observacao?: string;
      notaTeorica?: number;
    },
    status: AvaliacaoStatus,
    checklistResponses: Record<number, ChecklistValue>
  ) => {
    let updatedList: Avaliacao[];
    const now = new Date().toISOString();

    // Compute results if status is finalized dynamically
    let resultado;
    const isFinalized = status === 'FINALIZADA' || status === 'Concluída';
    if (isFinalized) {
      const activeItems = getDynamicChecklistItems().filter(
        item => item.certificacao === formData.tipoCertificacao && item.ativo
      );
      resultado = calcularResultadoDinamico(activeItems, checklistResponses, formData.notaTeorica);
    }

    if (editingEvaluation) {
      // Updating an existing record
      updatedList = evaluations.map((item) => {
        if (item.id === editingEvaluation.id) {
          return {
            ...item,
            ...formData,
            status,
            checklistResponses,
            resultado,
            updatedAt: now
          };
        }
        return item;
      });
      showToast(`Avaliação de ${formData.nomeTecnico} atualizada com sucesso!`, 'success');
    } else {
      // Creating a brand new record
      const newRecord: Avaliacao = {
        id: 'eval-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        ...formData,
        status,
        checklistResponses,
        resultado,
        createdAt: now,
        updatedAt: now
      };
      updatedList = [newRecord, ...evaluations];
      showToast(`Avaliação de ${formData.nomeTecnico} salva como ${status === 'AGENDADA' ? 'AGENDADA' : status}!`, 'success');
    }

    setEvaluations(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    setEditingEvaluation(null);
    
    // Automatically redirect back based on profile
    if (isPerformingCert) {
      setCurrentView('realizar');
      setIsPerformingCert(false);
    } else if (currentProfile === 'cq') {
      setCurrentView('home');
    } else {
      setCurrentView('historico');
    }
  };

  // Delete evaluation handler
  const handleConfirmDelete = () => {
    if (!deletingId) return;

    const target = evaluations.find(e => e.id === deletingId);
    const updatedList = evaluations.filter((item) => item.id !== deletingId);
    
    setEvaluations(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    
    if (target) {
      showToast(`Avaliação de ${target.nomeTecnico} foi excluída.`, 'info');
    }
    
    setDeletingId(null);
  };

  // Find the technician name & certification for the delete confirmation modal
  const deletingItem = evaluations.find((item) => item.id === deletingId);

  // If no profile is selected, render the selection gate
  if (currentProfile === null) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-claro-dark antialiased">
        <Header onGoHome={handleGoHome} currentView={currentView} profile={null} />
        
        <main className="flex-grow flex items-center justify-center px-4 py-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-claro-red"></div>
            
            <div className="p-8 sm:p-10 space-y-8">
              {/* Header inside card */}
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-red-50 text-claro-red rounded-full flex items-center justify-center border border-red-100 shadow-sm mb-4">
                  <ShieldCheck size={36} />
                </div>
                <h2 className="text-3xl font-black text-claro-dark tracking-tight">
                  Certificação Prática CQ
                </h2>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  Por favor, escolha o seu perfil de acesso
                </p>
              </div>

              {/* Profile Choices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Analista Option */}
                <button
                  onClick={() => handleSelectProfile('analista')}
                  className="group p-6 bg-slate-50 hover:bg-red-50/40 border-2 border-slate-200 hover:border-claro-red rounded-2xl text-left transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between space-y-6 relative h-64 text-left"
                >
                  <div className="space-y-3 text-left">
                    <div className="bg-white group-hover:bg-red-100 text-slate-700 group-hover:text-claro-red p-3 rounded-xl w-fit border border-slate-200 group-hover:border-red-200 shadow-sm transition-colors">
                      <ShieldCheck size={28} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 group-hover:text-claro-red uppercase tracking-wide leading-tight">
                      Perfil Analista
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Agende avaliações práticas, preencha dados dos técnicos e acompanhe o histórico geral de conformidade.
                    </p>
                  </div>
                  <div className="w-full py-2 px-4 bg-slate-800 group-hover:bg-claro-red text-white text-xs font-black uppercase text-center rounded-xl transition-colors shadow-sm tracking-wider">
                    Entrar como Analista
                  </div>
                </button>

                {/* CQ Option */}
                <button
                  onClick={() => handleSelectProfile('cq')}
                  className="group p-6 bg-slate-50 hover:bg-red-50/40 border-2 border-slate-200 hover:border-claro-red rounded-2xl text-left transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between space-y-6 relative h-64 text-left"
                >
                  <div className="space-y-3 text-left">
                    <div className="bg-white group-hover:bg-red-100 text-slate-700 group-hover:text-claro-red p-3 rounded-xl w-fit border border-slate-200 group-hover:border-red-200 shadow-sm transition-colors">
                      <FileCheck size={28} />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 group-hover:text-claro-red uppercase tracking-wide leading-tight">
                      Perfil CQ
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      Consulte a escala de "Avaliações do Dia", abra e aplique checklists de campo, salve em andamento e envie resultados.
                    </p>
                  </div>
                  <div className="w-full py-2 px-4 bg-slate-800 group-hover:bg-claro-red text-white text-xs font-black uppercase text-center rounded-xl transition-colors shadow-sm tracking-wider">
                    Entrar como CQ
                  </div>
                </button>
              </div>

              {/* Decorative disclaimer */}
              <p className="text-[10px] text-center font-semibold text-slate-400 uppercase tracking-widest">
                Controle de Qualidade Claro • Conectando com Segurança
              </p>
            </div>
          </motion.div>
        </main>
        
        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-medium">
          <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© 2026 Claro S/A - Setor de Controle de Qualidade (CQ).</p>
            <div className="flex items-center space-x-4">
              <span className="hover:text-slate-600 transition-colors cursor-help">Versão 1.0.0</span>
              <span className="text-slate-200">|</span>
              <span className="flex items-center gap-1 text-slate-500 font-bold">
                <Smartphone size={13} className="text-slate-400" />
                Otimizado para Campo
              </span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (currentProfile === 'cq' && selectedCQ === null) {
    return (
      <CQIdentificationGate 
        onSelectCQ={(cq) => handleSelectCQ(cq)}
        onBack={() => handleSelectProfile(null)}
      />
    );
  }

  const sidebarItems = [
    { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'nova', label: 'Agendar Avaliação', icon: CalendarPlus },
    { id: 'realizar', label: 'Realizar Certificação', icon: ClipboardCheck },
    { id: 'historico', label: 'Histórico Geral', icon: History },
    { id: 'cqs', label: 'Gerenciar Avaliadores', icon: Users },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const renderSidebarContent = (isMobile: boolean = false) => {
    const isCQ = currentProfile === 'cq';
    const items = isCQ 
      ? [{ id: 'home', label: 'Avaliações do Dia', icon: LayoutDashboard }]
      : sidebarItems;

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Brand/Logo Section in Sidebar */}
        <div className="p-4 border-b border-slate-150 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2.5 select-none">
            <div className="bg-claro-red text-white p-1 rounded-full shadow-inner flex items-center justify-center">
              <ShieldCheck size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight leading-none text-claro-dark">
                Claro <span className="font-light text-slate-500">CQ</span>
              </h2>
              <p className="text-[8px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">
                {isCQ ? 'Painel CQ' : 'Painel Analista'}
              </p>
            </div>
          </div>
          {isMobile && (
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 md:hidden cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-grow py-4 space-y-1 px-2 text-left bg-white">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'nova') {
                    handleStartNew();
                  } else {
                    setCurrentView(item.id);
                  }
                  if (isMobile) setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-red-50 text-claro-red border-l-4 border-claro-red font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-claro-red' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer/Switch Profile Section */}
        <div className="p-3 border-t border-slate-100 space-y-2 bg-white">
          {!isCQ && selectedAnalista && (
            <div className="p-2 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-2 text-left">
              <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-700 truncate">{selectedAnalista.nome}</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase truncate">{selectedAnalista.cidadeBase}</p>
              </div>
            </div>
          )}
          {isCQ && selectedCQ && (
            <div className="p-2 bg-red-50/50 border border-red-100 rounded-xl flex items-center gap-2 text-left">
              <div className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-700 truncate">{selectedCQ.nome}</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase truncate">{selectedCQ.cidadeBase}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => handleSelectProfile(null)}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span>Trocar Perfil</span>
          </button>
        </div>
      </div>
    );
  };

  const hasSidebar = currentProfile === 'analista' || (currentProfile === 'cq' && selectedCQ !== null);

  return (
    <div className={`min-h-screen bg-slate-50 text-claro-dark antialiased ${hasSidebar ? 'flex flex-col md:flex-row' : 'flex flex-col'}`}>
      
      {/* Desktop Sidebar */}
      {hasSidebar && (
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-30 shadow-xs">
          {renderSidebarContent(false)}
        </aside>
      )}

      {/* Mobile Drawer Sidebar */}
      {hasSidebar && (
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black z-40 md:hidden"
              />
              {/* Sidebar Drawer */}
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-64 bg-white z-50 shadow-xl border-r border-slate-200 flex flex-col md:hidden"
              >
                {renderSidebarContent(true)}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Main Content Area */}
      <div className={`flex-grow flex flex-col min-w-0 ${hasSidebar ? 'md:pl-64' : ''}`}>
        
        {/* Brand Header */}
        <Header 
          onGoHome={handleGoHome} 
          currentView={currentView} 
          profile={currentProfile} 
          onToggleSidebar={() => setIsMobileMenuOpen(true)}
        />

        {/* Main Section */}
        <main className="flex-grow pb-12 p-4 md:p-6">
          <AnimatePresence mode="wait">
            {currentView === 'home' && currentProfile === 'cq' && selectedCQ && (
              <motion.div
                key="cq-dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <CQAvaliacoesDoDia
                  evaluations={evaluations}
                  selectedCQ={selectedCQ}
                  onSelectEvaluation={(evalObj) => {
                    setEditingEvaluation(evalObj);
                    setCurrentView('nova');
                  }}
                  onOpenDetails={(evalObj) => {
                    setViewingEvaluation(evalObj);
                  }}
                  onSwitchCQ={() => handleSelectCQ(null)}
                  onSwitchProfile={() => {
                    handleSelectCQ(null);
                    handleSelectProfile(null);
                  }}
                  onUpdateEvaluation={(updatedEval) => {
                    const updatedList = evaluations.map((item) => item.id === updatedEval.id ? updatedEval : item);
                    setEvaluations(updatedList);
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
                    if (updatedEval.status === 'FINALIZADA') {
                      showToast(`Avaliação de ${updatedEval.nomeTecnico} reprovada por nota teórica inferior a 7.`, 'error');
                    } else {
                      showToast(`Nota teórica de ${updatedEval.nomeTecnico} salva com sucesso!`, 'success');
                    }
                  }}
                />
              </motion.div>
            )}

            {currentView === 'home' && currentProfile === 'analista' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <HomeView 
                  onNavigate={(view) => {
                    if (view === 'nova') handleStartNew();
                    else setCurrentView(view);
                  }} 
                  evaluations={evaluations}
                  onSelectProfile={() => handleSelectProfile(null)}
                  onOpenDetails={(evalObj) => setViewingEvaluation(evalObj)}
                />
              </motion.div>
            )}

            {currentView === 'realizar' && currentProfile === 'analista' && (
              selectedAnalista === null ? (
                <motion.div
                  key="analista-gate"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AnalistaIdentificationGate
                    onSelectAnalista={(analista) => handleSelectAnalista(analista)}
                    onBack={() => setCurrentView('home')}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="analista-certificar"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                >
                  <CQAvaliacoesDoDia
                    evaluations={evaluations}
                    selectedCQ={selectedAnalista}
                    onSelectEvaluation={(evalObj) => {
                      setEditingEvaluation(evalObj);
                      setIsPerformingCert(true);
                      setCurrentView('nova');
                    }}
                    onOpenDetails={(evalObj) => {
                      setViewingEvaluation(evalObj);
                    }}
                    onSwitchCQ={() => handleSelectAnalista(null)}
                    onSwitchProfile={() => {
                      handleSelectAnalista(null);
                      handleSelectProfile(null);
                    }}
                    onUpdateEvaluation={(updatedEval) => {
                      const updatedList = evaluations.map((item) => item.id === updatedEval.id ? updatedEval : item);
                      setEvaluations(updatedList);
                      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
                      if (updatedEval.status === 'FINALIZADA') {
                        showToast(`Avaliação de ${updatedEval.nomeTecnico} reprovada por nota teórica inferior a 7.`, 'error');
                      } else {
                        showToast(`Nota teórica de ${updatedEval.nomeTecnico} salva com sucesso!`, 'success');
                      }
                    }}
                  />
                </motion.div>
              )
            )}

            {currentView === 'configuracoes' && currentProfile === 'analista' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <SettingsView
                  onBack={handleGoHome}
                  onSwitchProfile={() => handleSelectProfile(null)}
                />
              </motion.div>
            )}

            {currentView === 'nova' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <FormView
                  onSave={handleSaveEvaluation}
                  onCancel={() => {
                    if (isPerformingCert) {
                      setCurrentView('realizar');
                      setIsPerformingCert(false);
                    } else if (currentProfile === 'cq') {
                      setCurrentView('home');
                    } else if (editingEvaluation) {
                      setCurrentView('historico');
                    } else {
                      setCurrentView('home');
                    }
                    setEditingEvaluation(null);
                  }}
                  initialData={editingEvaluation}
                  profile={isPerformingCert ? 'cq' : (currentProfile || undefined)}
                />
              </motion.div>
            )}

            {currentView === 'historico' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <HistoryView
                  evaluations={evaluations}
                  onOpen={handleOpenTrigger}
                  onEdit={(evalObj) => {
                    // Set flag based on whether evaluation is linked to an active Analista
                    const savedCQs = localStorage.getItem('claro_cq_cadastrados');
                    let isAnalistaEvaluator = false;
                    if (savedCQs) {
                      try {
                        const parsed = JSON.parse(savedCQs);
                        const evaluator = parsed.find((c: any) => c.nome === evalObj.nomeCQ);
                        isAnalistaEvaluator = evaluator ? evaluator.perfil === 'Analista' : false;
                      } catch (e) {}
                    }
                    setIsPerformingCert(isAnalistaEvaluator);
                    handleEditTrigger(evalObj);
                  }}
                  onDelete={(id) => setDeletingId(id)}
                  onGoHome={handleGoHome}
                  onNew={handleStartNew}
                />
              </motion.div>
            )}

            {currentView === 'cqs' && (
              <motion.div
                key="cqs"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <CQManagerView onBack={handleGoHome} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

      {/* Footer Branding Area */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-medium">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Claro S/A - Setor de Controle de Qualidade (CQ).</p>
          <div className="flex items-center space-x-4">
            <span className="hover:text-slate-600 transition-colors cursor-help" title="Plataforma de Avaliação Prática">Versão 1.0.0</span>
            <span className="text-slate-200">|</span>
            <span className="flex items-center gap-1 text-slate-500 font-bold">
              <Smartphone size={13} className="text-slate-400" />
              Otimizado para Campo
            </span>
          </div>
        </div>
      </footer>
      </div>

      {/* Detail Overlay Modal */}
      <AnimatePresence>
        {viewingEvaluation && (
          <DetailModal
            evaluation={viewingEvaluation}
            onClose={() => setViewingEvaluation(null)}
            onEdit={() => handleEditTrigger(viewingEvaluation)}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Overlay Modal */}
      <AnimatePresence>
        {deletingId && deletingItem && (
          <DeleteConfirmModal
            technicianName={deletingItem.nomeTecnico}
            certificationType={deletingItem.tipoCertificacao}
            onConfirm={handleConfirmDelete}
            onCancel={() => setDeletingId(null)}
          />
        )}
      </AnimatePresence>

      {/* Custom Toast Notifications (floating slide-in card) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-96 z-50 pointer-events-none"
            id="toast-notification"
          >
            <div className={`p-4 rounded-2xl shadow-xl border flex items-start space-x-3 pointer-events-auto ${
              toast.type === 'success' 
                ? 'bg-emerald-600 border-emerald-500 text-white' 
                : toast.type === 'error'
                  ? 'bg-claro-red border-red-500 text-white'
                  : 'bg-claro-dark border-neutral-700 text-white'
            }`}>
              <div className="bg-white/20 p-1.5 rounded-xl flex-shrink-0 mt-0.5">
                {toast.type === 'success' ? (
                  <Check size={16} className="stroke-[3]" />
                ) : (
                  <AlertCircle size={16} className="stroke-[3]" />
                )}
              </div>
              <div className="flex-grow space-y-0.5">
                <span className="block text-xs uppercase tracking-widest font-black text-white/70">
                  Notificação CQ
                </span>
                <p className="text-sm font-semibold text-white leading-tight">
                  {toast.message}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
