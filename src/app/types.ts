export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  sku: string;
  minStock: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  date: Date;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  customerName?: string;
}

export type ViewType = 'dashboard' | 'products' | 'sales';

export interface InventoryDataService {
  loadInitialState(): Promise<{ products: Product[]; sales: Sale[] }>;
  createProduct(product: Omit<Product, 'id'>): Promise<Product>;
  updateProduct(id: string, product: Omit<Product, 'id'>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  createSale(sale: Omit<Sale, 'id'>): Promise<Sale>;
}
