import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProductsManager } from './components/ProductsManager';
import { SalesRegister } from './components/SalesRegister';
import { LayoutDashboard, Package, ShoppingCart, Store } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { cn } from './components/ui/utils';
import { createInventoryService } from './services/inventoryService';
import { Product, Sale, ViewType } from './types';

const inventoryService = createInventoryService();

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');

  useEffect(() => {
    const loadState = async () => {
      const { products: initialProducts, sales: initialSales } = await inventoryService.loadInitialState();
      setProducts(initialProducts);
      setSales(initialSales);
    };

    void loadState();
  }, []);

  const addProduct = async (product: Omit<Product, 'id'>) => {
    const createdProduct = await inventoryService.createProduct(product);
    setProducts((currentProducts) => [...currentProducts, createdProduct]);
  };

  const updateProduct = async (id: string, updatedProduct: Omit<Product, 'id'>) => {
    const savedProduct = await inventoryService.updateProduct(id, updatedProduct);
    setProducts((currentProducts) =>
      currentProducts.map((product) => (product.id === id ? savedProduct : product))
    );
  };

  const deleteProduct = async (id: string) => {
    await inventoryService.deleteProduct(id);
    setProducts((currentProducts) => currentProducts.filter((product) => product.id !== id));
  };

  const addSale = async (sale: Omit<Sale, 'id'>) => {
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

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-blue-600">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-2 shadow-md">
              <Store className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-white">PixelCurcubeu</h1>
              <p className="text-xs text-indigo-100">Sistema de Gestión</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
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
        <div className="p-4 border-t border-gray-200">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">Productos totales</p>
            <p className="text-indigo-600">{products.length}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
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
  );
}