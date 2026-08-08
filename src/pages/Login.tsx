import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { LogIn, Mail, Lock, ArrowRight } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-950 overflow-hidden relative">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

      <div className="w-full max-w-md relative animate-in fade-in zoom-in duration-700">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 mb-4 shadow-2xl overflow-hidden">
            <img src="/pwa-192x192.png" alt="TreinaVISA" className="h-20 w-20 rounded-xl" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">InspecVISA</h1>
          <p className="text-primary-100/60 mt-1">Inspeção Sanitária Inteligente</p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <LogIn className="mr-2 h-5 w-5" />
              Entrar na conta
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="staff-login-email" className="text-sm font-medium text-primary-100/80 ml-1">E-mail corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-100/40" aria-hidden="true" />
                  <input
                    id="staff-login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 bg-white/10 border border-white/10 rounded-xl pl-10 pr-4 text-white placeholder-white/20 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 transition-all"
                    placeholder="esterposte@hotmail.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="staff-login-password" className="text-sm font-medium text-primary-100/80 ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-100/40" aria-hidden="true" />
                  <input
                    id="staff-login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 bg-white/10 border border-white/10 rounded-xl pl-10 pr-4 text-white placeholder-white/20 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm animate-shake">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-12 bg-white text-primary-900 hover:bg-primary-50 rounded-xl font-bold text-base shadow-xl group"
              >
                {loading ? 'Processando...' : (
                  <>
                    Entrar Agora
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-xs text-primary-100/50">
                Acesso restrito à equipe. Cliente? Acompanhe suas inspeções pelo{' '}
                <a href="/cliente" className="font-semibold text-primary-100/80 hover:text-white underline">
                  Portal do Cliente
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-primary-100/30 text-xs">
          © 2026 Consultora Sanitária. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
