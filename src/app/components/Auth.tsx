import { useEffect, useState } from 'react';
import { LogIn, ShieldCheck, Sparkles, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface AuthProps {
  client?: SupabaseClient | null;
  isLocal?: boolean;
  onSuccess: (userEmail: string, businessName?: string) => void;
}

interface LocalUser {
  email: string;
  password: string;
}

const LOCAL_USERS_KEY = 'pixel-ink-local-users';
const LOCAL_SESSION_KEY = 'stokly-local-session';

function readLocalUsers(): LocalUser[] {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(LOCAL_USERS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as LocalUser[];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: LocalUser[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function persistLocalSession(email: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_SESSION_KEY, email.trim().toLowerCase());
}

function readBusinessName(email?: string): string | null {
  if (typeof window === 'undefined') return null;
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return null;
  const stored = window.localStorage.getItem(`stokly-business-name:${normalizedEmail}`);
  return stored || null;
}

function saveBusinessName(email: string, businessName: string) {
  if (typeof window === 'undefined') return;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;
  window.localStorage.setItem(`stokly-business-name:${normalizedEmail}`, businessName.trim());
}

export function Auth({ client, isLocal = false, onSuccess }: AuthProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBusinessNameSetup, setShowBusinessNameSetup] = useState(false);
  const [businessNameInput, setBusinessNameInput] = useState('');
  const [formError, setFormError] = useState('');
  const [authCooldown, setAuthCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [visualState, setVisualState] = useState<'idle' | 'success' | 'error'>('idle');

  const playSound = (type: 'success' | 'error' | 'click') => {
    if (typeof window === 'undefined') return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.type = type === 'success' ? 'triangle' : type === 'error' ? 'sawtooth' : 'sine';
    const frequency = type === 'success' ? 660 : type === 'error' ? 220 : 440;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

    window.setTimeout(() => {
      context.close();
    }, 300);
  };

  const animateFeedback = (state: 'success' | 'error') => {
    setVisualState(state);
    window.setTimeout(() => setVisualState('idle'), 800);
  };

  const cardClassName = cn(
    'border-0 bg-transparent shadow-none transform transition duration-500 ease-out',
    visualState === 'success'
      ? 'animate-success-glow border-lime-300/70 shadow-lime-200/30 ring-2 ring-lime-200/70'
      : visualState === 'error'
      ? 'animate-shake border-red-300/80 shadow-red-200/30 ring-1 ring-red-300/40'
      : 'shadow-none',
  );

  const handleModeToggle = () => {
    playSound('click');
    setIsRegister((current) => !current);
    setFormError('');
  };

  const handleBusinessNameComplete = (skip = false) => {
    const normalizedEmail = email.trim().toLowerCase();
    const finalName = skip ? 'Mi negocio' : businessNameInput.trim() || 'Mi negocio';

    saveBusinessName(normalizedEmail, finalName);
    setShowBusinessNameSetup(false);
    setBusinessNameInput('');
    onSuccess(normalizedEmail, finalName);
  };

  const handleEmailAuth = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('handleEmailAuth', {
      isRegister,
      email: normalizedEmail,
      passwordPresent: Boolean(password),
      confirmPasswordPresent: Boolean(confirmPassword),
      clientPresent: Boolean(client),
      isLocal,
    });

    setFormError('');

    if (!normalizedEmail || !password) {
      const message = 'Ingresa correo y contraseña';
      setFormError(message);
      toast.error(message);
      playSound('error');
      animateFeedback('error');
      return;
    }

    if (isRegister && password !== confirmPassword) {
      const message = 'Las contraseñas no coinciden';
      setFormError(message);
      toast.error(message);
      playSound('error');
      animateFeedback('error');
      return;
    }

    console.log('register attempt', { email: normalizedEmail, password, confirmPassword, isRegister, clientPresent: Boolean(client) });

    if (authCooldown) {
      const message = 'Demasiados intentos. Espera un momento antes de volver a intentarlo.';
      setFormError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      if (!client || isLocal) {
        const normalizedEmail = email.trim().toLowerCase();
        const users = readLocalUsers();
        const existingUser = users.find((user) => user.email === normalizedEmail);

        if (isRegister) {
          if (existingUser) {
            const message = 'Ya existe una cuenta con ese correo';
            setFormError(message);
            toast.error(message);
            playSound('error');
            animateFeedback('error');
            return;
          }

          const nextUsers = [...users, { email: normalizedEmail, password }];
          saveLocalUsers(nextUsers);
          persistLocalSession(normalizedEmail);
          setShowBusinessNameSetup(true);
          toast.success('Registro completo. Personaliza el nombre de tu negocio.');
          return;
        } else {
          if (!existingUser || existingUser.password !== password) {
            const message = 'Correo o contraseña incorrectos';
            setFormError(message);
            toast.error(message);
            playSound('error');
            animateFeedback('error');
            return;
          }

          persistLocalSession(existingUser.email);
          onSuccess(existingUser.email, readBusinessName(existingUser.email) ?? undefined);
          toast.success('Inicio de sesión exitoso.');
        }

        return;
      }

      if (isRegister) {
        const { data, error } = await client.auth.signUp({
          email: normalizedEmail,
          password,
        });

        console.log('signUp result', { data, error });

        if (error) {
          console.error('signUp error', error);
          const message = String((error as any)?.message || 'Error al registrar');
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
            const cooldownMessage = 'Límite de registro alcanzado. Intenta nuevamente en unos minutos.';
            setFormError(cooldownMessage);
            toast.error(cooldownMessage);
            setAuthCooldown(true);
            setCooldownSeconds(30);
          } else {
            setFormError(message);
            toast.error(message);
          }
          return;
        }

        setShowBusinessNameSetup(true);
        toast.success('Registro realizado. Personaliza el nombre de tu negocio.');
        playSound('success');
        animateFeedback('success');
        return;
      } else {
        const { data, error } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        console.log('signIn result', { data, error });

        if (error) {
          console.error('signIn error', error);
          const message = String((error as any)?.message || 'Error al iniciar sesión');
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes('invalid login credentials') || lowerMessage.includes('invalid login')) {
            const errorMessage = 'Correo o contraseña incorrectos';
            setFormError(errorMessage);
            toast.error(errorMessage);
            playSound('error');
            animateFeedback('error');
          } else if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
            const cooldownMessage = 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
            setFormError(cooldownMessage);
            toast.error(cooldownMessage);
            setAuthCooldown(true);
            setCooldownSeconds(30);
            playSound('error');
            animateFeedback('error');
          } else {
            setFormError(message);
            toast.error(message);
            playSound('error');
            animateFeedback('error');
          }
          return;
        }

        if (data?.user) {
          onSuccess(data.user.email ?? normalizedEmail, readBusinessName(data.user.email ?? normalizedEmail) ?? undefined);
          const message = 'Inicio de sesión exitoso.';
          setFormError('');
          toast.success(message);
          playSound('success');
          animateFeedback('success');
        } else {
          const message = 'No se pudo iniciar sesión.';
          setFormError(message);
          toast.error(message);
          playSound('error');
          animateFeedback('error');
        }
      }
    } catch (error) {
      const errorMessage = String((error as any)?.message || '').toLowerCase();
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        toast.error('Límite de registro alcanzado. Intenta nuevamente en unos minutos.');
        setAuthCooldown(true);
        setCooldownSeconds(30);
      } else {
        const message = String((error as any)?.message || 'Error en autenticación');
        setFormError(message);
        toast.error(message);
        playSound('error');
        animateFeedback('error');
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!authCooldown || cooldownSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => {
        if (current <= 1) {
          setAuthCooldown(false);
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [authCooldown, cooldownSeconds]);

  const handleOAuth = async (useLoginHint = false) => {
    if (!client) {
      toast.error('OAuth no está disponible en modo local');
      return;
    }

    if (authCooldown) {
      toast.error('Demasiados intentos. Espera un momento antes de volver a intentarlo.');
      return;
    }

    setLoading(true);

    try {
      const queryParams = useLoginHint && email.trim()
        ? { login_hint: email.trim().toLowerCase() }
        : undefined;

      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams,
        },
      });

      if (error) throw error;
      toast.success('Redirigiendo a Google');
    } catch (error) {
      toast.error((error as Error).message || 'Error con Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.18),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_45%,_#f8fafc_100%)] p-4">
      <div className="w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_25px_80px_-20px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="grid lg:grid-cols-[1.7fr_0.95fr] gap-6">
          <div className="hidden lg:flex flex-col justify-between rounded-[2rem] border border-white/10 bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 p-10 text-white shadow-[0_25px_80px_-20px_rgba(15,23,42,0.35)] overflow-hidden">
            <div className="space-y-8">
              <div className="mb-6 inline-flex items-center justify-center rounded-3xl border border-white/15 bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.32em] text-white/90 shadow-lg shadow-black/10">
                STOKLY PRO
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight leading-tight">
                  <span className="block animate-gradient-text">Gestiona tu pyme</span>
                  <span className="block mt-2 text-white/80">desde un panel claro y profesional.</span>
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-indigo-50/85 animate-fade-up">
                  Centraliza inventario, ventas y clientes en una experiencia diseñada para empresas pequeñas y medianas que buscan orden y confianza.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur transition hover:-translate-y-1 hover:bg-white/20">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-200/80">Ventas</p>
                  <p className="mt-3 text-lg font-semibold text-white">+38%</p>
                  <p className="mt-2 text-sm text-indigo-100/85">Aumento en el control de ventas.</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur transition hover:-translate-y-1 hover:bg-white/20">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-200/80">Inventario</p>
                  <p className="mt-3 text-lg font-semibold text-white">24/7</p>
                  <p className="mt-2 text-sm text-indigo-100/85">Acceso al stock siempre disponible.</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur transition hover:-translate-y-1 hover:bg-white/20">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-200/80">Decisiones</p>
                  <p className="mt-3 text-lg font-semibold text-white">En segundos</p>
                  <p className="mt-2 text-sm text-indigo-100/85">Insights claros para cada día.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-xl shadow-black/10 backdrop-blur-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-100/80">Tu acceso está aquí</p>
              <p className="mt-3 text-sm leading-6 text-indigo-100/85">La sección de inicio de sesión se encuentra en la parte superior derecha para que no sea lo primero que veas.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  onClick={() => {
                    setIsRegister(false);
                    setFormError('');
                  }}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  onClick={() => {
                    setIsRegister(true);
                    setFormError('');
                  }}
                >
                  Regístrate
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.32em] text-slate-500">ACCESO</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Inicia sesión o regístrate</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isRegister ? 'bg-slate-200 text-slate-900' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    onClick={() => setIsRegister(false)}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isRegister ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-900'}`}
                    onClick={() => setIsRegister(true)}
                  >
                    Registro
                  </button>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">Accede a tu panel rápido o crea una cuenta nueva para comenzar a gestionar tu pyme con control y seguridad.</p>
            </div>

            <Card className={cardClassName}>
            <CardHeader className="gap-3 px-8 pt-10 pb-4 text-center sm:px-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
                  {isRegister ? 'Crea tu cuenta en Stokly' : 'Bienvenido a Stokly'}
                </CardTitle>
                <CardDescription className="mt-2 text-sm leading-6 text-slate-500">
                  {isRegister
                    ? 'Regístrate para empezar a gestionar tu inventario y ventas.'
                    : 'Inicia sesión para continuar con tu panel de control.'}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-6 sm:px-10">
              {showBusinessNameSetup ? (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Personaliza el nombre de tu negocio</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Este nombre aparecerá en la interfaz para identificar tu empresa.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <Input
                      type="text"
                      placeholder="Ej. Café Aurora"
                      value={businessNameInput}
                      onChange={(event) => setBusinessNameInput(event.target.value)}
                      className="h-11 rounded-xl border-slate-200 shadow-sm focus-visible:ring-indigo-500"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        onClick={() => handleBusinessNameComplete(false)}
                        className="h-11 flex-1 rounded-xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                      >
                        Guardar nombre
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleBusinessNameComplete(true)}
                        className="h-11 flex-1 rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        Omitir por ahora
                      </Button>
                    </div>
                    {formError ? (
                      <p className="mt-3 text-sm text-red-600">{formError}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="h-11 rounded-xl border-slate-200 pl-10 shadow-sm focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña</Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-11 rounded-xl border-slate-200 pl-10 shadow-sm focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>
                  {isRegister ? (
                    <div className="grid gap-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">Confirmar contraseña</Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="Repite tu contraseña"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          className="h-11 rounded-xl border-slate-200 pl-10 shadow-sm focus-visible:ring-indigo-500"
                        />
                      </div>
                    </div>
                  ) : null}
                  <Button onClick={handleEmailAuth} className="h-11 w-full rounded-xl bg-indigo-600 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700" disabled={loading}>
                    {isRegister ? 'Registrarse' : 'Iniciar sesión'}
                  </Button>
                  {formError ? (
                    <p className="mt-2 text-sm text-red-600">{formError}</p>
                  ) : null}
                </div>
              )}

              <div className="my-6 flex items-center gap-3 text-sm text-slate-400">
                <span className="h-px flex-1 bg-slate-200"></span>
                <span>o continúa con</span>
                <span className="h-px flex-1 bg-slate-200"></span>
              </div>

              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-11 w-full justify-center rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => handleOAuth(false)}
                  disabled={loading || !client}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Continuar con Google
                </Button>
              </div>
              {!client ? (
                <p className="mt-3 text-center text-xs text-slate-400">
                  Inicio de sesión local activado: usa email y contraseña. Google OAuth no está disponible.
                </p>
              ) : null}
            </CardContent>

            <CardFooter className="flex flex-col gap-3 px-8 pb-10 pt-2 sm:px-10">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <span>{isRegister ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}</span>
                <button
                  type="button"
                  className="font-semibold text-indigo-600 transition hover:text-indigo-700"
                  onClick={handleModeToggle}
                >
                  {isRegister ? 'Iniciar sesión' : 'Regístrate'}
                </button>
              </div>
              <p className="text-center text-xs leading-5 text-slate-400">
                Si eliges Google, tu cuenta se creará automáticamente con el proveedor.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );

}
