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
  X,
  Loader2
} from 'lucide-react';

import Header from './components/Header';
import HomeView from './components/HomeView';
import FormView from './components/FormView';
import HistoryView from './components/HistoryView';
import DetailModal from './components/DetailModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import CQAvaliacoesDoDia from './components/CQAvaliacoesDoDia';
import CQManagerView from './components/CQManagerView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import AdminDashboardView from './components/AdminDashboardView';
import ChangePasswordModal from './components/ChangePasswordModal';
import { Avaliacao, CertificacaoType, AvaliacaoStatus, ChecklistValue, CQ } from './types';
import { SafeUser } from './server/auth/types';
import { getDynamicChecklistItems, calcularResultadoDinamico } from './data/dynamicChecklist';

const LOCAL_STORAGE_KEY = 'claro_cq_certificacoes';

// Demo seed data for development
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
      3: 'Fez',
      4: 'Fez',
      5: 'Fez',
      6: 'Fez',
      7: 'Fez',
      8: 'Fez',
      9: 'Fez',
      10: 'Fez',
      11: 'Fez',
      12: 'NaoFez'
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
  }
];

interface ToastState {
  message: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  // Real authenticated user state (restored via /api/auth/me)
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Operational states
  const [currentView, setCurrentView] = useState<string>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPerformingCert, setIsPerformingCert] = useState(false);
  const [evaluations, setEvaluations] = useState<Avaliacao[]>([]);
  
  // Modals / Overlays
  const [editingEvaluation, setEditingEvaluation] = useState<Avaliacao | null>(null);
  const [viewingEvaluation, setViewingEvaluation] = useState<Avaliacao | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Toast notifications
  const [toast, setToast] = useState<ToastState | null>(null);

  // Check authenticated session with backend on initial load (/api/auth/me)
  useEffect(() => {
    async function restoreSession() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Session restoration failed:', err);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    restoreSession();
  }, []);

  // Load evaluations from localStorage
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
      setEvaluations(SEED_DATA);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_DATA));
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLoginSuccess = (user: SafeUser) => {
    setCurrentUser(user);
    if (user.role === 'ADMIN') {
      setCurrentView('admin');
    } else {
      setCurrentView('home');
    }
    showToast(`Bem-vindo, ${user.name}!`, 'success');
  };

  const handlePasswordChangeSuccess = (updatedUser: SafeUser) => {
    setCurrentUser(updatedUser);
    showToast('Senha alterada com sucesso! Acesso liberado.', 'success');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setCurrentUser(null);
      setCurrentView('home');
      showToast('Sessão encerrada com sucesso.', 'info');
    }
  };

  const handleGoHome = () => {
    if (currentUser?.role === 'ADMIN') {
      setCurrentView('admin');
    } else {
      setCurrentView('home');
    }
    setEditingEvaluation(null);
  };

  const handleStartNew = () => {
    setEditingEvaluation(null);
    setCurrentView('nova');
  };

  const handleEditTrigger = (evaluation: Avaliacao) => {
    setEditingEvaluation(evaluation);
    setCurrentView('nova');
  };

  const handleOpenTrigger = (evaluation: Avaliacao) => {
    setViewingEvaluation(evaluation);
  };

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

    let resultado;
    const isFinalized = status === 'FINALIZADA' || status === 'Concluída';
    if (isFinalized) {
      const activeItems = getDynamicChecklistItems().filter(
        item => item.certificacao === formData.tipoCertificacao && item.ativo
      );
      resultado = calcularResultadoDinamico(activeItems, checklistResponses, formData.notaTeorica);
    }

    if (editingEvaluation) {
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
      showToast(`Avaliação de ${formData.nomeTecnico} salva!`, 'success');
    }

    setEvaluations(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    setEditingEvaluation(null);
    setCurrentView('historico');
  };

  const handleConfirmDelete = () => {
    if (!deletingId) return;
    const target = evaluations.find(e => e.id === deletingId);
    const updatedList = evaluations.filter((item) => item.id !== deletingId);
    setEvaluations(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
    if (target) {
      showToast(`Avaliação de ${target.nomeTecnico} excluída.`, 'info');
    }
    setDeletingId(null);
  };

  const deletingItem = evaluations.find((item) => item.id === deletingId);

  // 1. Loading State during session check
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-claro-dark">
        <div className="w-16 h-16 bg-red-50 text-claro-red rounded-full flex items-center justify-center border border-red-100 shadow-sm mb-4">
          <ShieldCheck size={36} />
        </div>
        <div className="flex items-center space-x-2 text-slate-500 font-bold text-sm">
          <Loader2 size={18} className="animate-spin text-claro-red" />
          <span>Verificando credenciais de acesso...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Real Login Screen
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. ADMIN User Interface
  if (currentUser.role === 'ADMIN') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-100 text-claro-dark antialiased">
        {currentUser.must_change_password && (
          <ChangePasswordModal
            user={currentUser}
            onSuccess={handlePasswordChangeSuccess}
            onLogout={handleLogout}
          />
        )}
        <Header 
          onGoHome={handleGoHome} 
          currentView="admin" 
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        <main className="flex-grow p-4 sm:p-6 lg:p-8">
          <AdminDashboardView 
            currentUser={currentUser} 
            onLogout={handleLogout} 
          />
        </main>
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-medium">
          <p>© 2026 Claro S/A - Setor de Controle de Qualidade (CQ). Módulo de Administração.</p>
        </footer>
      </div>
    );
  }

  // 4. Fallback for other roles (to be completed in subsequent phases)
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-claro-dark antialiased">
      <Header 
        onGoHome={handleGoHome} 
        currentView={currentView} 
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="flex-grow p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md text-center space-y-4">
          <ShieldCheck size={48} className="text-claro-red mx-auto" />
          <h2 className="text-xl font-black">Acesso Operacional</h2>
          <p className="text-xs text-slate-500">
            Usuário {currentUser.name} autenticado com perfil {currentUser.role}.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-claro-red text-white text-xs font-bold rounded-xl"
          >
            Sair
          </button>
        </div>
      </main>
    </div>
  );
}
