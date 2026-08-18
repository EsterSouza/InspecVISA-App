import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Input } from '../components/ui/Input';
import { LogIn, Mail, Lock, ArrowRight } from 'lucide-react';

/**
 * A tela de entrada é a única superfície escura do app (o tema escuro só chega no FE-12).
 * O campo continua sendo o primitivo — foco, alvo de toque e fiação vêm de lá; só a
 * pele muda, para não ficar um retângulo branco no meio do navy.
 */
const LOGIN_FIELD =
  'h-12 rounded-xl border-white/10 bg-surface/10 pl-10 pr-4 text-white placeholder:text-white/20 ' +
  'enabled:hover:border-white/30 focus-visible:border-primary-400 focus-visible:ring-primary-400';

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-900 via-primary-800 to-navy overflow-hidden relative">
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

      <div className="w-full max-w-md relative animate-in fade-in zoom-in duration-700">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center rounded-2xl bg-surface/10 backdrop-blur-xl border border-white/20 mb-4 shadow-2xl overflow-hidden">
            <img src="/pwa-192x192.png" alt="TreinaVISA" className="h-20 w-20 rounded-xl" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">InspecVISA</h1>
          <p className="text-primary-100/60 mt-1">Inspeção Sanitária Inteligente</p>
        </div>

        <Card className="border-white/10 bg-surface/5 backdrop-blur-2xl shadow-2xl">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <LogIn className="mr-2 h-5 w-5" />
              Entrar na conta
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-login-email" className="ml-1 text-primary-100/80">E-mail corporativo</Label>
                <Input
                  id="staff-login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="text-primary-100/40" />}
                  className={LOGIN_FIELD}
                  placeholder="esterposte@hotmail.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-login-password" className="ml-1 text-primary-100/80">Senha</Label>
                <Input
                  id="staff-login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="text-primary-100/40" />}
                  className={LOGIN_FIELD}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div role="alert" className="p-3 rounded-lg bg-danger/20 border border-danger/30 text-danger-soft text-sm animate-shake">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-12 bg-surface text-primary-900 hover:bg-primary-50 rounded-xl font-bold text-base shadow-xl group"
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
