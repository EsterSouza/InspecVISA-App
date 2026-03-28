import React, { useEffect, useState } from 'react';
import { db } from '../db/database';
import type { SyncLog } from '../types';
import { ArrowLeft, Trash2, Copy, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Debug: React.FC = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const navigate = useNavigate();

  const loadLogs = async () => {
    const data = await db.sync_logs.orderBy('timestamp').reverse().limit(100).toArray();
    setLogs(data);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const clearLogs = async () => {
    if (confirm('Limpar todos os logs de diagnóstico?')) {
      await db.sync_logs.clear();
      loadLogs();
    }
  };

  const copyLogs = () => {
    const text = logs.map((l: SyncLog) => 
      `[${l.timestamp.toLocaleString()}] ${l.level.toUpperCase()}: ${l.message} ${l.details ? JSON.stringify(l.details) : ''}`
    ).join('\n');
    navigator.clipboard.writeText(text);
    alert('Logs copiados!');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-slate-800">Diagnóstico de Sincronização</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={loadLogs} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
              <RefreshCw size={20} />
            </button>
            <button onClick={copyLogs} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
              <Copy size={20} />
            </button>
            <button onClick={clearLogs} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
              <Trash2 size={20} />
            </button>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Data/Hora</th>
                  <th className="px-4 py-3">Nível</th>
                  <th className="px-4 py-3">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">Nenhum log registrado.</td>
                  </tr>
                ) : (
                  logs.map((log: SyncLog) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          log.level === 'error' ? 'bg-red-100 text-red-600' :
                          log.level === 'warn' ? 'bg-amber-100 text-amber-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{log.message}</div>
                        {log.details && (
                          <pre className="mt-1 text-[10px] text-slate-400 bg-slate-50 p-2 rounded max-w-lg overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm">
          <p className="font-bold mb-1">Dica de Debug:</p>
          <p>Se você vir erros de "403" ou "Forbidden", é um problema de permissão no servidor. Se vir "timeout", a internet está instável.</p>
        </div>
      </div>
    </div>
  );
};

export default Debug;
