import { useState } from 'react';
import { Product, Sale, SaleItem } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Plus, Trash2, ShoppingCart, X, Receipt, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface SalesRegisterProps {
  products: Product[];
  sales: Sale[];
  onAddSale: (sale: Omit<Sale, 'id'>) => void;
}

export function SalesRegister({ products, sales, onAddSale }: SalesRegisterProps) {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo');

  const addToCart = () => {
    if (!selectedProductId || !quantity || parseInt(quantity) <= 0) {
      toast.error('Selecciona un producto y una cantidad válida');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const qty = parseInt(quantity);
    if (qty > product.stock) {
      toast.error('No hay suficiente stock disponible');
      return;
    }

    const existingItem = cart.find(item => item.productId === selectedProductId);
    if (existingItem) {
      const newQuantity = existingItem.quantity + qty;
      if (newQuantity > product.stock) {
        toast.error('No hay suficiente stock disponible');
        return;
      }
      setCart(cart.map(item =>
        item.productId === selectedProductId
          ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
          : item
      ));
    } else {
      const newItem: SaleItem = {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        price: product.price,
        subtotal: qty * product.price,
      };
      setCart([...cart, newItem]);
    }

    setSelectedProductId('');
    setQuantity('1');
    toast.success('Producto agregado al carrito');
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (newQuantity > product.stock) {
      toast.error('No hay suficiente stock disponible');
      return;
    }

    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.price }
        : item
    ));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      toast.error('Agrega productos al carrito');
      return;
    }

    const sale: Omit<Sale, 'id'> = {
      date: new Date(),
      items: cart,
      total: calculateTotal(),
      paymentMethod,
      customerName: customerName || undefined,
    };

    onAddSale(sale);
    setCart([]);
    setCustomerName('');
    setPaymentMethod('Efectivo');
    toast.success('Venta registrada exitosamente');
  };

  const clearCart = () => {
    setCart([]);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'Efectivo':
        return Banknote;
      case 'Tarjeta':
        return CreditCard;
      case 'Transferencia':
        return Smartphone;
      default:
        return CreditCard;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900">Registro de Ventas</h2>
        <p className="text-gray-500">Gestiona tus transacciones</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Nueva Venta */}
        <Card className="xl:col-span-2 border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              Nueva Venta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2 space-y-2">
                <Label>Producto</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="border-gray-200 focus:border-green-500 focus:ring-green-500">
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => p.stock > 0).map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - ${product.price.toLocaleString()} ({product.stock} disponibles)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1"
                    className="border-gray-200 focus:border-green-500 focus:ring-green-500"
                  />
                  <Button onClick={addToCart} className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md">
                    <Plus className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {cart.length === 0 ? (
                <div className="p-12 text-center bg-gradient-to-br from-gray-50 to-green-50">
                  <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <ShoppingCart className="h-10 w-10 text-green-600" />
                  </div>
                  <p className="text-gray-900 mb-1">El carrito está vacío</p>
                  <p className="text-sm text-gray-500">Agrega productos para comenzar la venta</p>
                </div>
              ) : (
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableHead>Producto</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.productId} className="hover:bg-gray-50">
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-green-600">${item.price.toLocaleString()}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 0)}
                            className="w-20 border-gray-200"
                          />
                        </TableCell>
                        <TableCell className="text-green-600">${item.subtotal.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.productId)}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumen de Venta */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-600" />
              Resumen de Venta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nombre del Cliente (opcional)</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
                className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="border-gray-200 focus:border-indigo-500 focus:ring-indigo-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4" />
                      Efectivo
                    </div>
                  </SelectItem>
                  <SelectItem value="Tarjeta">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Tarjeta
                    </div>
                  </SelectItem>
                  <SelectItem value="Transferencia">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Transferencia
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 space-y-3 bg-gradient-to-br from-gray-50 to-indigo-50 -mx-6 px-6 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Productos</span>
                <span className="text-gray-900">{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Unidades</span>
                <span className="text-gray-900">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200">
                <span className="text-gray-900">Total</span>
                <span className="bg-gradient-to-br from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  ${calculateTotal().toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md"
                onClick={handleCompleteSale}
                disabled={cart.length === 0}
              >
                <Receipt className="h-4 w-4 mr-2" />
                Completar Venta
              </Button>
              {cart.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  onClick={clearCart}
                >
                  <X className="h-4 w-4" />
                  Vaciar Carrito
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de Ventas */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-purple-600" />
            Historial de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-purple-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-10 w-10 text-purple-600" />
              </div>
              <p className="text-gray-900 mb-1">No hay ventas registradas</p>
              <p className="text-sm text-gray-500">Las ventas aparecerán aquí</p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => {
                    const PaymentIcon = getPaymentIcon(sale.paymentMethod);
                    return (
                      <TableRow key={sale.id} className="hover:bg-gray-50">
                        <TableCell>
                          <p className="text-sm text-gray-900">
                            {new Date(sale.date).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(sale.date).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </TableCell>
                        <TableCell>{sale.customerName || 'Cliente'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {sale.items.map((item, idx) => (
                              <div key={idx} className="text-sm text-gray-600">
                                {item.productName} × {item.quantity}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-white gap-1.5">
                            <PaymentIcon className="h-3 w-3" />
                            {sale.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600">${sale.total.toLocaleString()}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
