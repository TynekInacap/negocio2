import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface AuthProps {
  client?: SupabaseClient | null;
  isLocal?: boolean;
  onSuccess: (userEmail: string) => void;
}

interface LocalUser {
  email: string;
  password: string;
}

const LOCAL_USERS_KEY = 'pixel-ink-local-users';

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

export function Auth({ client, isLocal = false, onSuccess }: AuthProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const checkEmailExists = async () => {
    if (!email.trim()) {
      toast.error('Ingresa un correo antes de verificar.');
      return;
    }

    setCheckingEmail(true);
    setEmailExists(null);

    try {
      if (!client || isLocal) {
        const users = readLocalUsers();
        const exists = users.some((user) => user.email === email.trim().toLowerCase());
        setEmailExists(exists);
        toast.success(exists ? 'El correo ya está registrado.' : 'El correo no existe en el registro local.');
      } else {
        toast.error('No se puede verificar el correo directamente desde el cliente Supabase sin un endpoint seguro.');
      }
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password) {
      toast.error('Ingresa correo y contraseña');
      return;
    }

    if (isRegister) {
      if (!confirmPassword) {
        toast.error('Confirma tu contraseña');
        return;
      }

      if (password !== confirmPassword) {
        toast.error('Las contraseñas no coinciden');
        return;
      }

      if (password.length < 8) {
        toast.error('La contraseña debe tener al menos 8 caracteres');
        return;
      }

      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        toast.error('La contraseña debe incluir mayúsculas, minúsculas y números');
        return;
      }
    }

    setLoading(true);

    try {
      if (!client || isLocal) {
        const users = readLocalUsers();
        const existingUser = users.find((user) => user.email === email.trim().toLowerCase());

        if (isRegister) {
          if (existingUser) {
            toast.error('Ya existe una cuenta con ese correo');
            return;
          }

          const nextUsers = [...users, { email: email.trim().toLowerCase(), password }];
          saveLocalUsers(nextUsers);
          onSuccess(email.trim().toLowerCase());
          toast.success('Registro completo. Bienvenido.');
        } else {
          if (!existingUser || existingUser.password !== password) {
            toast.error('Correo o contraseña incorrectos');
            return;
          }

          onSuccess(existingUser.email);
          toast.success('Inicio de sesión exitoso.');
        }

        return;
      }

      if (isRegister) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        toast.success('Registro realizado. Revisa tu correo para confirmar tu cuenta.');
        setIsRegister(false);
        return;
      } else {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data?.user) {
          onSuccess(data.user.email ?? email);
          toast.success('Inicio de sesión exitoso.');
        } else {
          toast.error('No se pudo iniciar sesión.');
        }
      }
    } catch (error) {
      toast.error((error as Error).message || 'Error en autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (useLoginHint = false) => {
    if (!client) {
      toast.error('OAuth no está disponible en modo local');
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white/95 shadow-2xl">
        <CardHeader className="gap-2 px-8 pt-10 pb-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-indigo-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-semibold">Accede a Pixel Ink</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            Usa tu correo y contraseña o regístrate rápidamente con Google.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailExists(null);
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkEmailExists}
                  disabled={loading || checkingEmail}
                >
                  {checkingEmail ? 'Verificando...' : 'Verificar correo'}
                </Button>
                {emailExists !== null ? (
                  <span className={`text-sm ${emailExists ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {emailExists ? 'Correo registrado' : 'Correo no encontrado'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {isRegister ? (
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            ) : null}
            <Button onClick={handleEmailAuth} className="w-full" disabled={loading}>
              {isRegister ? 'Registrarse' : 'Iniciar sesión'}
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3 text-sm text-slate-400">
            <span className="h-px flex-1 bg-slate-200"></span>
            <span>o continúa con</span>
            <span className="h-px flex-1 bg-slate-200"></span>
          </div>

          <div className="grid gap-3">
            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={() => handleOAuth(false)}
              disabled={loading || !client}
            >
              <LogIn className="h-4 w-4" />
              Google
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => handleOAuth(true)}
              disabled={loading || !client || !email.trim()}
            >
              Verificar correo en Google
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Si ingresas un correo, se usará como sugerencia en el inicio de sesión de Google.
          </p>
          {!client ? (
            <p className="mt-3 text-center text-xs text-slate-400">
              Inicio de sesión local activado: usa email y contraseña. Google OAuth no está disponible.
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-8 pb-10 pt-2">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{isRegister ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}</span>
            <button
              type="button"
              className="font-medium text-indigo-600 transition hover:text-indigo-700"
              onClick={() => setIsRegister(!isRegister)}
            >
              {isRegister ? 'Iniciar sesión' : 'Regístrate'}
            </button>
          </div>
          <p className="text-xs leading-5 text-slate-400">
            Si eliges Google, tu cuenta se creará automáticamente con el proveedor.
          </p>
        </CardFooter>
      </Card>
    </div>
  );

}
