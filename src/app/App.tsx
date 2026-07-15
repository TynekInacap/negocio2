import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProductsManager } from './components/ProductsManager';
import { SalesRegister } from './components/SalesRegister';
import { Auth } from './components/Auth';
import { LayoutDashboard, LogOut, Package, ShoppingCart, Store } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { Switch } from './components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './components/ui/alert-dialog';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from './components/ui/sheet';
import { toast } from 'sonner';
import { cn } from './components/ui/utils';
import { createInventoryService, LocalInventoryService } from './services/inventoryService';
import { hasSupabaseConfig, createSupabaseClient } from '../lib/supabase';
import { Product, Sale, ViewType } from './types';

const inventoryService = createInventoryService();
const fallbackInventoryService = new LocalInventoryService();
const isSupabaseConfigured = hasSupabaseConfig();
const supabaseClient = isSupabaseConfigured ? createSupabaseClient() : null;

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [user, setUser] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const LOCAL_SESSION_KEY = 'stokly-local-session';
  const LOCAL_SETTINGS_KEY = 'stokly-settings';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingBusinessName, setEditingBusinessName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [useFallbackService, setUseFallbackService] = useState(false);

  const isValidUuid = (value: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  };

  function readLocalSession(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(LOCAL_SESSION_KEY);
  }

  function readBusinessName(email?: string): string | null {
    if (typeof window === 'undefined') return null;
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return null;
    return window.localStorage.getItem(`stokly-business-name:${normalizedEmail}`) ?? null;
  }

  function saveBusinessName(email: string, businessName: string) {
    if (typeof window === 'undefined') return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    window.localStorage.setItem(`stokly-business-name:${normalizedEmail}`, businessName.trim());
  }

  function readSettings() {
    if (typeof window === 'undefined') return {
      currency: 'USD',
      notificationEmail: '',
      notificationsEnabled: true,
    };

    const stored = window.localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (!stored) return {
      currency: 'USD',
      notificationEmail: '',
      notificationsEnabled: true,
    };

    try {
      return JSON.parse(stored) as { currency: string; notificationEmail: string; notificationsEnabled: boolean };
    } catch {
      return {
        currency: 'USD',
        notificationEmail: '',
        notificationsEnabled: true,
      };
    }
  }

  function saveSettings(settings: { currency: string; notificationEmail: string; notificationsEnabled: boolean }) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  }

  const handleOpenSettings = () => {
    setEditingBusinessName(businessName ?? '');
    const settings = readSettings();
    setCurrency(settings.currency);
    setNotificationEmail(settings.notificationEmail);
    setNotificationsEnabled(settings.notificationsEnabled);
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    if (!user) return;
    const updatedName = editingBusinessName.trim() || 'Mi negocio';
    saveBusinessName(user, updatedName);
    saveSettings({ currency, notificationEmail, notificationsEnabled });
    setBusinessName(updatedName);
    setSettingsOpen(false);
    toast.success('Configuración guardada');
  };

  const handleSignOut = async () => {
    try {
      if (supabaseClient && isSupabaseConfigured) {
        await supabaseClient.auth.signOut();
      }
    } catch (error) {
      console.error('signOut failed:', error);
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOCAL_SESSION_KEY);
    }

    setUser(null);
    setBusinessName(null);
    setSettingsOpen(false);
    toast('Sesión cerrada');
  };

  useEffect(() => {
    console.log('Supabase config present:', hasSupabaseConfig());
    console.log('Inventory service:', inventoryService.constructor.name);
    const loadState = async () => {
      console.log('Starting loadInitialState using', inventoryService.constructor.name);
      try {
        const { products: initialProducts, sales: initialSales } = await inventoryService.loadInitialState();
        console.log('loadInitialState success:', initialProducts.length, 'products,', initialSales.length, 'sales');
        setProducts(initialProducts);
        setSales(initialSales);
      } catch (error) {
        console.error('Supabase load failed, falling back to local state:', error);
        setLoadError('No se pudo cargar la base de datos remota. Usando datos locales.');
        setUseFallbackService(true);
        const { products: initialProducts, sales: initialSales } = await fallbackInventoryService.loadInitialState();
        setProducts(initialProducts);
        setSales(initialSales);
      }
    };

    void loadState();
  }, []);

  useEffect(() => {
    const restoreAuth = async () => {
      try {
        if (supabaseClient && isSupabaseConfigured) {
          const { data, error } = await supabaseClient.auth.getSession();
          if (!error && data.session?.user?.email) {
            const email = data.session.user.email;
            setUser(email);
            setBusinessName(readBusinessName(email) ?? null);
          }
        } else {
          const email = readLocalSession();
          if (email) {
            setUser(email);
            setBusinessName(readBusinessName(email) ?? null);
          }
        }
      } catch (error) {
        console.error('restoreAuth failed', error);
      } finally {
        setAuthLoading(false);
      }
    };

    void restoreAuth();
  }, []);

  const handleSignInSuccess = (userEmail: string, nextBusinessName?: string) => {
    setUser(userEmail);
    if (nextBusinessName) {
      setBusinessName(nextBusinessName);
    }
  };

  const addProduct = async (product: Omit<Product, 'id'>) => {
    const service = useFallbackService ? fallbackInventoryService : inventoryService;
    try {
      const createdProduct = await service.createProduct(product);
      setProducts((currentProducts) => [...currentProducts, createdProduct]);
      toast.success('Producto creado');
    } catch (error) {
      console.error('createProduct failed:', error);
      toast.error('No se pudo crear en remoto. Intentando guardar localmente.');
      try {
        const createdProduct = await fallbackInventoryService.createProduct(product);
        setUseFallbackService(true);
        setProducts((currentProducts) => [...currentProducts, createdProduct]);
        toast.success('Producto guardado localmente');
      } catch (err) {
        console.error('fallback createProduct failed:', err);
        toast.error('No se pudo guardar el producto');
      }
    }
  };

  const updateProduct = async (id: string, updatedProduct: Omit<Product, 'id'>) => {
    const service = useFallbackService ? fallbackInventoryService : inventoryService;
    try {
      const savedProduct = await service.updateProduct(id, updatedProduct);
      setProducts((currentProducts) =>
        currentProducts.map((product) => (product.id === id ? savedProduct : product))
      );
      toast.success('Producto actualizado');
    } catch (error) {
      console.error('updateProduct failed:', error);
      toast.error('No se pudo actualizar en remoto. Intentando guardado local.');
      try {
        const savedProduct = await fallbackInventoryService.updateProduct(id, updatedProduct);
        setUseFallbackService(true);
        setProducts((currentProducts) =>
          currentProducts.map((product) => (product.id === id ? savedProduct : product))
        );
        toast.success('Producto actualizado localmente');
      } catch (err) {
        console.error('fallback updateProduct failed:', err);
        toast.error('No se pudo actualizar el producto');
      }
    }
  };

  const deleteProduct = async (id: string) => {
    const service = useFallbackService ? fallbackInventoryService : inventoryService;
    try {
      await service.deleteProduct(id);
      setProducts((currentProducts) => currentProducts.filter((product) => product.id !== id));
      toast.success('Producto eliminado');
    } catch (error) {
      console.error('deleteProduct failed:', error);
      toast.error('No se pudo eliminar en remoto. Intentando eliminar localmente.');
      try {
        await fallbackInventoryService.deleteProduct(id);
        setUseFallbackService(true);
        setProducts((currentProducts) => currentProducts.filter((product) => product.id !== id));
        toast.success('Producto eliminado localmente');
      } catch (err) {
        console.error('fallback deleteProduct failed:', err);
        toast.error('No se pudo eliminar el producto');
      }
    }
  };

  const addSale = async (sale: Omit<Sale, 'id'>) => {
    const service = useFallbackService ? fallbackInventoryService : inventoryService;
    try {
      const createdSale = await service.createSale(sale);

      if (isSupabaseConfigured && !isValidUuid(createdSale.id)) {
        throw new Error(`Invalid sale id returned from remote: ${createdSale.id}`);
      }

      const updatedProducts = products.map((product) => {
        const matchingItem = sale.items.find((item) => item.productId === product.id);
        if (!matchingItem) return product;

        return {
          ...product,
          stock: product.stock - matchingItem.quantity,
        };
      });

      setProducts(updatedProducts);
      setSales((currentSales) => [createdSale, ...currentSales]);
      toast.success('Venta registrada');
    } catch (error) {
      console.error('createSale failed:', error);
      toast.error('No se pudo registrar la venta en remoto. Intentando localmente.');
      try {
        const createdSale = await fallbackInventoryService.createSale(sale);
        setUseFallbackService(true);

        const updatedProducts = products.map((product) => {
          const matchingItem = sale.items.find((item) => item.productId === product.id);
          if (!matchingItem) return product;

          return {
            ...product,
            stock: product.stock - matchingItem.quantity,
          };
        });

        setProducts(updatedProducts);
        setSales((currentSales) => [createdSale, ...currentSales]);
        toast.success('Venta registrada localmente');
      } catch (err) {
        console.error('fallback createSale failed:', err);
        toast.error('No se pudo registrar la venta');
      }
    }
  };

  const navItems = [
    {
      id: 'dashboard' as ViewType,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'products' as ViewType,
      label: 'Productos',
      icon: Package,
    },
    {
      id: 'sales' as ViewType,
      label: 'Ventas',
      icon: ShoppingCart,
    },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {!user ? (
        <Auth
          client={supabaseClient}
          onSuccess={(userEmail, nextBusinessName) => handleSignInSuccess(userEmail, nextBusinessName)}
          isLocal={!isSupabaseConfigured}
        />
      ) : (
        <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full border-b border-gray-200 bg-white shadow-xl lg:w-64 lg:border-r lg:border-b-0 lg:flex lg:flex-col animate-soft-pop">
            {/* Header */}
            <div className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600 p-4 sm:p-6 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.35)]">
              <div className="pointer-events-none absolute inset-0 opacity-30">
                <div className="absolute right-6 top-6 h-28 w-28 rounded-full bg-white/15 blur-3xl" />
                <div className="absolute -bottom-10 left-4 h-32 w-32 rounded-full bg-sky-300/20 blur-3xl" />
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2 shadow-md">
                  <Store className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-white">{businessName || 'Stokly'}</h1>
                  <p className="text-xs text-indigo-100">Sistema de Gestión</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Button
                  className="w-full bg-white/15 text-white transition duration-300 hover:-translate-y-0.5 hover:bg-white/25 hover:shadow-lg"
                  variant="secondary"
                  onClick={handleOpenSettings}
                >
                  Configuración
                </Button>
                <div className="lg:hidden">
                  <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="w-full inline-flex items-center justify-center rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-red-600"
                        variant="destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar sesión
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Si cierras sesión, deberás volver a ingresar con tu cuenta para acceder.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSignOut}>Cerrar sesión</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-2 lg:p-4 lg:space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg border-l-4 px-4 py-3 text-sm transition-all duration-200 sm:text-base",
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md border-l-indigo-500"
                        : "border-l-transparent text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 transition duration-300", isActive ? "text-white" : "text-slate-500 group-hover:text-indigo-600")} />
                    <span className={cn(isActive && "font-medium")}>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="hidden border-t border-gray-200 p-4 lg:block animate-fade-up">
              <div className="flex flex-col gap-3 rounded-[1.5rem] bg-white/90 p-3 shadow-sm ring-1 ring-slate-200/70 backdrop-blur-md">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Productos totales</p>
                  <p className="text-2xl font-semibold text-slate-900">{products.length}</p>
                </div>
                <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full inline-flex items-center justify-center rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-red-600"
                      variant="destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Cerrar sesión
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Si cierras sesión, deberás volver a ingresar con tu cuenta para acceder.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSignOut}>Cerrar sesión</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-4 sm:p-6 lg:p-8">
              {loadError ? (
                <div className="rounded-[1.75rem] border border-red-200 bg-red-50 p-4 mb-6 text-sm text-red-700 shadow-sm animate-fade-up">
                  {loadError}
                </div>
              ) : null}
              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetContent side="right" className="max-w-lg animate-soft-pop rounded-[2rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/5">
                  <SheetHeader className="border-b border-slate-200/80 px-6 py-5">
                    <SheetTitle className="text-2xl font-semibold text-slate-900">Configuración</SheetTitle>
                    <p className="mt-2 text-sm text-slate-500">Ajusta tu tienda y recibe alertas personalizadas.</p>
                  </SheetHeader>
                  <div className="p-6 space-y-6">
                    <div className="grid gap-4">
                      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                        <p className="text-sm font-semibold text-slate-900">Nombre del negocio</p>
                        <p className="text-sm text-slate-500 mt-1">Este nombre aparecerá en el encabezado de la aplicación.</p>
                        <div className="mt-4">
                          <input
                            className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            type="text"
                            value={editingBusinessName}
                            onChange={(event) => setEditingBusinessName(event.target.value)}
                            placeholder="Nombre de tu negocio"
                          />
                        </div>
                      </div>

                      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                        <p className="text-sm font-semibold text-slate-900">Moneda de operación</p>
                        <p className="text-sm text-slate-500 mt-1">Selecciona la moneda que usarás para tus precios.</p>
                        <div className="mt-4">
                          <select
                            className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            value={currency}
                            onChange={(event) => setCurrency(event.target.value)}
                          >
                            <option value="USD">USD - Dólar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="PEN">PEN - Sol</option>
                            <option value="CLP">CLP - Peso chileno</option>
                          </select>
                        </div>
                      </div>

                      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Notificaciones inteligentes</p>
                            <p className="text-sm text-slate-500 mt-1">Recibe alertas cuando los productos lleguen al nivel mínimo de stock.</p>
                          </div>
                          <Switch checked={notificationsEnabled} onCheckedChange={(checked) => setNotificationsEnabled(Boolean(checked))} />
                        </div>
                        <div className="mt-4">
                          <label className="mb-2 block text-sm font-medium text-slate-700">Correo de notificación</label>
                          <input
                            className="w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            type="email"
                            value={notificationEmail}
                            onChange={(event) => setNotificationEmail(event.target.value)}
                            placeholder="ejemplo@correo.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <SheetFooter className="flex flex-col gap-3 p-6">
                    <Button className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-200/40 hover:shadow-indigo-300/50" onClick={handleSaveSettings}>
                      Guardar configuración
                    </Button>
                    <Button className="w-full bg-red-500 text-white hover:bg-red-600" onClick={handleSignOut}>
                      Cerrar sesión
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => setSettingsOpen(false)}>
                      Cerrar
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              {activeView === 'dashboard' && (
                <div className="rounded-[2rem] bg-white/95 p-6 shadow-[0_35px_90px_-30px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/70 animate-soft-pop">
                  <Dashboard products={products} sales={sales} />
                </div>
              )}
              {activeView === 'products' && (
                <div className="rounded-[2rem] bg-white/95 p-6 shadow-[0_35px_90px_-30px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/70 animate-soft-pop">
                  <ProductsManager
                    products={products}
                    onAdd={addProduct}
                    onUpdate={updateProduct}
                    onDelete={deleteProduct}
                  />
                </div>
              )}
              {activeView === 'sales' && (
                <div className="rounded-[2rem] bg-white/95 p-6 shadow-[0_35px_90px_-30px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/70 animate-soft-pop">
                  <SalesRegister
                    products={products}
                    sales={sales}
                    onAddSale={addSale}
                  />
                </div>
              )}
            </div>
          </main>

        </div>
      )}
      <Toaster />
    </div>
  );
}
