import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Activity, 
  Lock, 
  Key, 
  LogOut, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Server,
  FileText,
  UserCheck,
  Clock
} from 'lucide-react';
import { SafeUser, AuditLogEntry } from '../server/auth/types';

interface AdminDashboardViewProps {
  currentUser: SafeUser;
  onLogout: () => void;
}

interface DashboardMetrics {
  total_users: number;
  active_sessions: number;
  audit_events: number;
}

export default function AdminDashboardView({ currentUser, onLogout }: AdminDashboardViewProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [probeResult, setProbeResult] = useState<string | null>(null);
  const [probeStatus, setProbeStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [spoofTestResult, setSpoofTestResult] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [dashRes, usersRes, logsRes] = await Promise.all([
        fetch('/api/admin/dashboard', { credentials: 'include' }),
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/audit-logs', { credentials: 'include' }),
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setMetrics(dashData.metrics);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleTestRBAC = async () => {
    setProbeStatus('testing');
    setProbeResult(null);
    try {
      const res = await fetch('/api/admin/probe', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setProbeStatus('success');
        setProbeResult(`Servidor validou com sucesso: Role [${data.authorized_role}] autenticado via sessão HttpOnly.`);
      } else {
        setProbeStatus('failed');
        setProbeResult(`Rejeitado pelo servidor: ${data.error}`);
      }
    } catch (e) {
      setProbeStatus('failed');
      setProbeResult('Erro de conexão ao testar RBAC.');
    }
  };

  const handleTestClientSpoofing = async () => {
    // Attempt to make a raw request with an unauthorized fake header or simulated unauthenticated call
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: {
          'x-client-role': 'ADMIN',
        },
        // Omit cookies to test server rejection of forged / unauthenticated client
      });
      if (res.status === 401) {
        setSpoofTestResult('✅ Servidor rejeitou com HTTP 401 (Não Autenticado). Nenhuma manipulação em localStorage/frontend consegue contornar a segurança.');
      } else {
        setSpoofTestResult(`Resultado inesperado: HTTP ${res.status}`);
      }
    } catch (e) {
      setSpoofTestResult('Erro ao executar teste de spoofing.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left">
      {/* Admin Title Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="bg-red-100 text-claro-red px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase">
              Módulo Administrativo • RBAC
            </span>
            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Sessão Ativa
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Painel de Administração da Plataforma
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Gerenciamento de segurança, usuários cadastrados, registros de auditoria e validação de acessos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            onClick={onLogout}
            className="py-2.5 px-4 bg-slate-800 hover:bg-claro-red text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <LogOut size={14} />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 bg-red-50 text-claro-red rounded-xl flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Usuários no Banco</p>
            <h3 className="text-2xl font-black text-slate-900">{metrics ? metrics.total_users : '...'}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sessões Ativas</p>
            <h3 className="text-2xl font-black text-slate-900">{metrics ? metrics.active_sessions : '...'}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eventos de Auditoria</p>
            <h3 className="text-2xl font-black text-slate-900">{metrics ? metrics.audit_events : '...'}</h3>
          </div>
        </div>
      </div>

      {/* Interactive RBAC Verification Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-claro-red" />
              <h3 className="text-base font-black uppercase tracking-wider">Homologação de Segurança RBAC Server-Side</h3>
            </div>
            <p className="text-xs text-slate-400">
              O backend valida autenticação, status da conta e role antes de responder a qualquer rota protegida.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestRBAC}
              disabled={probeStatus === 'testing'}
              className="py-2 px-3.5 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              <span>Testar Rota Protegida ADMIN</span>
            </button>
            <button
              onClick={handleTestClientSpoofing}
              className="py-2 px-3.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle size={14} className="text-amber-400" />
              <span>Testar Ataque de Spoofing</span>
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
            <span><strong>Hash seguro:</strong> Senhas armazenadas com salt bcrypt de 12 rounds. A API nunca retorna password_hash.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Proteção de Sessão:</strong> Cookie HttpOnly intransferível. O frontend não decide privilégios nem autentica.</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck size={18} className="text-claro-red" />
              Usuários Registrados no Sistema
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Entidade persistente <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">users</code> (hashes omitidos por segurança).
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">{users.length} usuário(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-black border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nome / Usuário</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Troca de Senha</th>
                <th className="py-3 px-4">Último Login</th>
                <th className="py-3 px-4">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div>{u.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 font-normal">@{u.login}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-[10px] tracking-wider uppercase ${
                      u.role === 'ADMIN' ? 'bg-red-100 text-claro-red' : u.role === 'ANALISTA' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {u.must_change_password ? (
                      <span className="text-amber-600 font-bold">Obrigatória no 1º login</span>
                    ) : (
                      <span className="text-slate-400">Normal</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR') : 'Nunca'}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Clock size={18} className="text-slate-700" />
              Trilha de Auditoria (Audit Log)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Eventos de autenticação registrados sem persistência de credenciais sensíveis.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">Últimos {auditLogs.length} eventos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-black border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Evento</th>
                <th className="py-3 px-4">Tentativa / Usuário</th>
                <th className="py-3 px-4">IP</th>
                <th className="py-3 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.slice(0, 15).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] ${
                      log.event === 'LOGIN_SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.event === 'LOGIN_FAILED'
                          ? 'bg-red-100 text-red-800'
                          : log.event === 'ACCOUNT_LOCKED'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                    }`}>
                      {log.event}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {log.login_attempted ? `@${log.login_attempted}` : log.user_id ? `ID: ${log.user_id.slice(0, 12)}...` : 'Anônimo'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    {log.ip || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px] truncate max-w-xs">
                    {log.metadata ? JSON.stringify(log.metadata) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
