import { Product, Sale } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Package, ShoppingCart, DollarSign, AlertTriangle, TrendingUp, Boxes, Calendar } from 'lucide-react';
import { Badge } from './ui/badge';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
}

export function Dashboard({ products, sales }: DashboardProps) {
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);

  // Calculate today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySales = sales.filter(sale => {
    const saleDate = new Date(sale.date);
    saleDate.setHours(0, 0, 0, 0);
    return saleDate.getTime() === today.getTime();
  });
  const todaySalesCount = todaySales.length;
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);

  // Get top selling products
  const productSales = new Map<string, number>();
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const current = productSales.get(item.productId) || 0;
      productSales.set(item.productId, current + item.quantity);
    });
  });

  const topProducts = products
    .map(p => ({
      ...p,
      soldQuantity: productSales.get(p.id) || 0,
    }))
    .sort((a, b) => b.soldQuantity - a.soldQuantity)
    .slice(0, 5);

  const statCards = [
    {
      title: 'Total Productos',
      value: totalProducts,
      subtitle: 'productos registrados',
      icon: Package,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
    },
    {
      title: 'Stock Total',
      value: totalStock,
      subtitle: 'unidades en inventario',
      icon: Boxes,
      gradient: 'from-indigo-500 to-blue-500',
      bgGradient: 'from-indigo-50 to-blue-50',
    },
    {
      title: 'Ventas del Día',
      value: todaySalesCount,
      subtitle: `$${todayRevenue.toLocaleString()} generados`,
      icon: Calendar,
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-50 to-pink-50',
    },
    {
      title: 'Total Ventas',
      value: totalSales,
      subtitle: 'ventas realizadas',
      icon: ShoppingCart,
      gradient: 'from-violet-500 to-purple-500',
      bgGradient: 'from-violet-50 to-purple-50',
    },
    {
      title: 'Ingresos Totales',
      value: `$${totalRevenue.toLocaleString()}`,
      subtitle: 'ingresos generados',
      icon: DollarSign,
      gradient: 'from-emerald-500 to-green-500',
      bgGradient: 'from-emerald-50 to-green-50',
    },
    {
      title: 'Stock Bajo',
      value: lowStockProducts.length,
      subtitle: 'productos requieren atención',
      icon: AlertTriangle,
      gradient: 'from-orange-500 to-red-500',
      bgGradient: 'from-orange-50 to-red-50',
    },
  ];

  // Recent sales for reports
  const recentSales = sales.slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900">Dashboard</h2>
        <p className="text-gray-500">Resumen general del sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className={`bg-gradient-to-br ${stat.bgGradient} p-1`}>
                <div className="bg-white rounded-lg p-6">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
                    <CardTitle className="text-sm text-gray-600">{stat.title}</CardTitle>
                    <div className={`bg-gradient-to-br ${stat.gradient} rounded-lg p-2.5 shadow-md`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 mt-3">
                    <div className={`bg-gradient-to-br ${stat.gradient} bg-clip-text text-transparent`}>
                      {stat.value}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.subtitle}
                    </p>
                  </CardContent>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Low Stock Products */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Productos con Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <Package className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-gray-600">Todo el stock está en buen nivel</p>
                <p className="text-sm text-gray-500 mt-1">No hay productos con stock bajo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-50 to-orange-50 hover:from-gray-100 hover:to-orange-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={product.stock === 0 ? "destructive" : "secondary"} className="shadow-sm">
                        {product.stock} unidades
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Productos Más Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {topProducts.filter(p => p.soldQuantity > 0).length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-gray-600">Aún no hay ventas</p>
                <p className="text-sm text-gray-500 mt-1">Comienza a registrar ventas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts
                  .filter(p => p.soldQuantity > 0)
                  .map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-50 to-green-50 hover:from-gray-100 hover:to-green-100 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white text-sm shadow-md">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-white shadow-sm">
                          {product.soldQuantity} vendidos
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales Reports */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Reportes de Ventas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {recentSales.length === 0 ? (
              <div className="text-center py-8">
                <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600">No hay ventas registradas</p>
                <p className="text-sm text-gray-500 mt-1">Las ventas aparecerán aquí</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {recentSales.map((sale) => {
                  const saleDate = new Date(sale.date);
                  const formattedDate = saleDate.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const formattedTime = saleDate.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={sale.id} className="p-3 rounded-lg bg-gradient-to-r from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100 transition-colors border border-gray-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500">{formattedDate} - {formattedTime}</p>
                          {sale.customerName && (
                            <p className="text-sm text-gray-700 mt-1">{sale.customerName}</p>
                          )}
                        </div>
                        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm">
                          ${sale.total.toLocaleString()}
                        </Badge>
                      </div>
                      <div className="space-y-1 mt-2">
                        {sale.items.map((item, idx) => (
                          <p key={idx} className="text-xs text-gray-600">
                            • {item.productName} x{item.quantity}
                          </p>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Método: <span className="text-gray-700">{sale.paymentMethod}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}