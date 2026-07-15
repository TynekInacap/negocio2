import { useEffect, useState } from 'react';
import { LogIn, ShieldCheck, Sparkles, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from './ui/button';
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
      return;
    }

    if (isRegister && password !== confirmPassword) {
      const message = 'Las contraseñas no coinciden';
      setFormError(message);
      toast.error(message);
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
            setFormError('Correo o contraseña incorrectos');
            toast.error('Correo o contraseña incorrectos');
          } else if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
            const cooldownMessage = 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
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

        if (data?.user) {
          onSuccess(data.user.email ?? normalizedEmail, readBusinessName(data.user.email ?? normalizedEmail) ?? undefined);
          toast.success('Inicio de sesión exitoso.');
        } else {
          const message = 'No se pudo iniciar sesión.';
          setFormError(message);
          toast.error(message);
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
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-[0_25px_80px_-20px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 p-10 text-white">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight">Gestiona tu negocio con estilo</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-indigo-50/90">
                Centraliza productos, ventas y operaciones en una sola plataforma elegante y sencilla.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm font-medium">Acceso seguro</p>
              <p className="mt-1 text-sm text-indigo-50/85">Tu información protegida con una experiencia moderna y fluida.</p>
            </div>
          </div>

          <Card className="border-0 bg-transparent shadow-none">
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
                  onClick={() => setIsRegister(!isRegister)}
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
