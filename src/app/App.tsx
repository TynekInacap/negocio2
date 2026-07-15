import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProductsManager } from './components/ProductsManager';
import { SalesRegister } from './components/SalesRegister';
import { Auth } from './components/Auth';
import { LayoutDashboard, Package, ShoppingCart, Store } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingBusinessName, setEditingBusinessName] = useState('');

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

  const handleOpenSettings = () => {
    setEditingBusinessName(businessName ?? '');
    setSettingsOpen(true);
  };

  const handleSaveBusinessName = () => {
    if (!user) return;
    const updatedName = editingBusinessName.trim() || 'Mi negocio';
    saveBusinessName(user, updatedName);
    setBusinessName(updatedName);
    setSettingsOpen(false);
    toast.success('Nombre del negocio actualizado');
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
    try {
      const createdProduct = await inventoryService.createProduct(product);
      setProducts((currentProducts) => [...currentProducts, createdProduct]);
      toast.success('Producto creado');
    } catch (error) {
      console.error('createProduct failed:', error);
      toast.error('No se pudo crear en remoto. Intentando guardar localmente.');
      try {
        const createdProduct = await fallbackInventoryService.createProduct(product);
        setProducts((currentProducts) => [...currentProducts, createdProduct]);
        toast.success('Producto guardado localmente');
      } catch (err) {
        console.error('fallback createProduct failed:', err);
        toast.error('No se pudo guardar el producto');
      }
    }
  };

  const updateProduct = async (id: string, updatedProduct: Omit<Product, 'id'>) => {
    try {
      const savedProduct = await inventoryService.updateProduct(id, updatedProduct);
      setProducts((currentProducts) =>
        currentProducts.map((product) => (product.id === id ? savedProduct : product))
      );
      toast.success('Producto actualizado');
    } catch (error) {
      console.error('updateProduct failed:', error);
      toast.error('No se pudo actualizar en remoto. Intentando guardado local.');
      try {
        const savedProduct = await fallbackInventoryService.updateProduct(id, updatedProduct);
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
    try {
      await inventoryService.deleteProduct(id);
      setProducts((currentProducts) => currentProducts.filter((product) => product.id !== id));
      toast.success('Producto eliminado');
    } catch (error) {
      console.error('deleteProduct failed:', error);
      toast.error('No se pudo eliminar en remoto. Intentando eliminar localmente.');
      try {
        await fallbackInventoryService.deleteProduct(id);
        setProducts((currentProducts) => currentProducts.filter((product) => product.id !== id));
        toast.success('Producto eliminado localmente');
      } catch (err) {
        console.error('fallback deleteProduct failed:', err);
        toast.error('No se pudo eliminar el producto');
      }
    }
  };

  const addSale = async (sale: Omit<Sale, 'id'>) => {
    try {
      const createdSale = await inventoryService.createSale(sale);

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
          <aside className="w-full border-b border-gray-200 bg-white shadow-lg lg:w-64 lg:border-r lg:border-b-0 lg:flex lg:flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2 shadow-md">
                  <Store className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-white">{businessName || 'Stokly'}</h1>
                  <p className="text-xs text-indigo-100">Sistema de Gestión</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  className="w-full bg-white/15 text-white hover:bg-white/25"
                  variant="secondary"
                  onClick={handleOpenSettings}
                >
                  Configuración del negocio
                </Button>
                <Button
                  className="w-full bg-white/15 text-white hover:bg-white/25"
                  variant="secondary"
                  onClick={handleSignOut}
                >
                  Cerrar sesión
                </Button>
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
                      "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm transition-all duration-200 sm:text-base",
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", isActive && "text-white")} />
                    <span className={cn(isActive && "font-medium")}>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="hidden border-t border-gray-200 p-4 lg:block">
              <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 p-3">
                <p className="text-xs text-gray-600">Productos totales</p>
                <p className="text-indigo-600">{products.length}</p>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="p-4 sm:p-6 lg:p-8">
              {loadError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6 text-sm text-red-700">
                  {loadError}
                </div>
              ) : null}
              {settingsOpen ? (
                <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Configuración del negocio</h2>
                      <p className="text-sm text-slate-500">Edita el nombre de tu negocio y guarda los cambios.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Nombre del negocio</label>
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                          type="text"
                          value={editingBusinessName}
                          onChange={(event) => setEditingBusinessName(event.target.value)}
                          placeholder="Nombre de tu negocio"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button onClick={handleSaveBusinessName}>Guardar nombre</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {activeView === 'dashboard' && (
                <Dashboard products={products} sales={sales} />
              )}
              {activeView === 'products' && (
                <ProductsManager
                  products={products}
                  onAdd={addProduct}
                  onUpdate={updateProduct}
                  onDelete={deleteProduct}
                />
              )}
              {activeView === 'sales' && (
                <SalesRegister
                  products={products}
                  sales={sales}
                  onAddSale={addSale}
                />
              )}
            </div>
          </main>

          <Toaster />
        </div>
      )}
    </div>
  );
}
