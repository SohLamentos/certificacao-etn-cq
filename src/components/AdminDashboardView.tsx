import React, { useState } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Server,
  UserCheck,
  Clock,
  KeyRound,
  LogOut
} from 'lucide-react';
import { SafeUser } from '../server/auth/types';
import { apiClient } from '../api/client';

interface AdminDashboardViewProps {
  currentUser: SafeUser;
  onLogout: () => void;
}

export default function AdminDashboardView({ currentUser, onLogout }: AdminDashboardViewProps) {
  const [probeResult, setProbeResult] = useState<string | null>(null);
  const [probeStatus, setProbeStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [spoofTestResult, setSpoofTestResult] = useState<string | null>(null);

  const handleTestRBAC = async () => {
    setProbeStatus('testing');
    setProbeResult(null);
    try {
      const res = await apiClient.adminProbe();
      if (res.ok && res.data) {
        setProbeStatus('success');
        setProbeResult(
          `Cloudflare Worker validou com sucesso: Role [${res.data.roles?.join(', ')}] autenticada via Bearer Token ETN. Probe: ${res.data.probe} (${new Date(res.data.timestamp).toLocaleString('pt-BR')}).`
        );
      } else {
        setProbeStatus('failed');
        setProbeResult(`Rejeitado pelo servidor (${res.status}): ${res.message || res.error}`);
      }
    } catch {
      setProbeStatus('failed');
      setProbeResult('Erro inesperado de comunicação durante o teste de RBAC.');
    }
  };

  const handleTestClientSpoofing = async () => {
    setSpoofTestResult('Executando teste contra o Cloudflare Worker sem token Bearer...');
    try {
      // Dispara diretamente sem Authorization header para provar a barreira fail-closed
      const baseUrl = apiClient.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/admin/probe`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        setSpoofTestResult(
          `[PROTEÇÃO ATIVA] O Cloudflare Worker rejeitou a chamada com HTTP ${res.status} (${data.error || 'UNAUTHORIZED'}). Mensagem: "${data.message || 'Token ausente'}". Nenhuma permissão client-side pode burlar o servidor.`
        );
      } else {
        setSpoofTestResult(`[ATENÇÃO] Resposta inesperada: Status ${res.status}`);
      }
    } catch {
      setSpoofTestResult('[FALHA DE REDE] Erro ao testar probe sem token.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left">
      {/* Top Welcome Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-claro-red text-[11px] font-black uppercase tracking-wider">
            <ShieldCheck size={14} />
            <span>Módulo de Administração Central CQ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Painel de Controle e Governança
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Sessão validada via autoridade central ETN Materiais e autorização local Cloudflare D1.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestRBAC}
            disabled={probeStatus === 'testing'}
            className="py-2.5 px-4 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:bg-slate-300"
          >
            <RefreshCw size={14} className={probeStatus === 'testing' ? 'animate-spin' : ''} />
            <span>Verificar Acesso (Probe)</span>
          </button>
          <button
            onClick={onLogout}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200 cursor-pointer flex items-center gap-1.5"
          >
            <LogOut size={14} />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </div>

      {/* Admin Identity Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <UserCheck size={18} className="text-claro-red" />
          <span>Identidade do Administrador Autenticado</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Nome</span>
            <span className="text-sm font-bold text-slate-800">{currentUser.name}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Login Central</span>
            <span className="text-sm font-mono font-bold text-slate-800">@{currentUser.login}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">ETN User ID</span>
            <span className="text-xs font-mono font-bold text-slate-700 truncate block" title={currentUser.etn_user_id}>
              {currentUser.etn_user_id}
            </span>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Papel Local CQ</span>
            <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full bg-red-100 text-claro-red font-black text-xs">
              {currentUser.role}
            </span>
          </div>
        </div>
      </div>

      {/* Security Demonstration & RBAC Verification Panel */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-5 border border-slate-800 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-claro-red" />
              <h2 className="text-base font-black tracking-tight text-white">
                Teste de Defesa em Profundidade (RBAC Guard)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Validação criptográfica de privilégios executada diretamente no Cloudflare Worker via <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">GET /api/admin/probe</code>.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleTestRBAC}
              disabled={probeStatus === 'testing'}
              className="py-2 px-3.5 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:bg-slate-700"
            >
              <KeyRound size={14} />
              <span>Validar Probe ADMIN</span>
            </button>
            <button
              onClick={handleTestClientSpoofing}
              className="py-2 px-3.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle size={14} className="text-amber-400" />
              <span>Testar Acesso Sem Token (Fail-Closed)</span>
            </button>
          </div>
        </div>

        {probeResult && (
          <div className={`p-3.5 rounded-xl text-xs font-mono ${
            probeStatus === 'success' ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200' : 'bg-red-950/80 border border-red-800 text-red-200'
          }`}>
            {probeResult}
          </div>
        )}

        {spoofTestResult && (
          <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-slate-300">
            {spoofTestResult}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400 pt-1">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Bearer Token Central:</strong> Assinatura de sessão gerenciada estritamente pela autoridade ETN Materiais.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Zero Bypass:</strong> A autorização é checada a cada requisição no Cloudflare Worker contra a tabela <code className="text-slate-300 font-mono">cq_app_access</code> do D1.</span>
          </div>
        </div>
      </div>

      {/* Informative Notice Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center space-y-2">
        <Clock size={28} className="text-slate-400 mx-auto" />
        <h3 className="text-sm font-black text-slate-800">Módulos Administrativos Adicionais</h3>
        <p className="text-xs text-slate-500 max-w-xl mx-auto">
          Os endpoints complementares de listagem de usuários e trilhas de auditoria remota serão integrados em etapas de homologação subsequentes, respeitando a governança do Cloudflare Worker.
        </p>
      </div>
    </div>
  );
}
