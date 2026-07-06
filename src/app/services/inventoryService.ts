import { createSupabaseClient, hasSupabaseConfig } from '../../lib/supabase';
import { Product, Sale, InventoryDataService } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'inventory-products',
  SALES: 'inventory-sales',
};

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Azúcar 1kg',
    description: 'Azúcar blanca granulada 1kg',
    price: 1200,
    stock: 30,
    category: 'Alimentos',
    sku: 'ALI-AZU-001',
    minStock: 10,
  },
  {
    id: '2',
    name: 'Aceite vegetal 1L',
    description: 'Aceite 100% vegetal',
    price: 2500,
    stock: 20,
    category: 'Alimentos',
    sku: 'ALI-ACE-001',
    minStock: 8,
  },
  {
    id: '3',
    name: 'Arroz 1kg',
    description: 'Arroz de grano',
    price: 1800,
    stock: 25,
    category: 'Alimentos',
    sku: 'ALI-ARR-001',
    minStock: 10,
  },
  {
    id: '4',
    name: 'Leche entera 1L',
    description: 'Leche entera líquida',
    price: 1000,
    stock: 40,
    category: 'Lácteos',
    sku: 'LAC-LEC-001',
    minStock: 10,
  },
  {
    id: '5',
    name: 'Pan de molde',
    description: 'Pan de molde blanco 500g',
    price: 2000,
    stock: 15,
    category: 'Panadería',
    sku: 'PAN-MOL-001',
    minStock: 10,
  },
  {
    id: '6',
    name: 'Coca-Cola 1.5L',
    description: 'Bebida 1.5L',
    price: 1900,
    stock: 35,
    category: 'Bebidas',
    sku: 'BEB-COC-001',
    minStock: 10,
  },
  {
    id: '7',
    name: 'Papel higiénico 4 unidades',
    description: 'Papel higiénico suave',
    price: 2700,
    stock: 18,
    category: 'Aseo',
    sku: 'ASE-PAP-001',
    minStock: 10,
  },
  {
    id: '8',
    name: 'Detergente líquido 3L',
    description: 'Detergente para ropa',
    price: 4200,
    stock: 10,
    category: 'Aseo',
    sku: 'ASE-DET-001',
    minStock: 5,
  },
  {
    id: '9',
    name: 'Atún en lata 170g',
    description: 'Atún en agua 170g',
    price: 1600,
    stock: 25,
    category: 'Conservas',
    sku: 'CON-ATU-001',
    minStock: 5,
  },
  {
    id: '10',
    name: 'Fideos largos 500g',
    description: 'Fideos de trigo',
    price: 1100,
    stock: 22,
    category: 'Alimentos',
    sku: 'ALI-FID-001',
    minStock: 5,
  },
];

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  const value = window.localStorage.getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function writeLocalStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeSales(sales: Sale[]): Sale[] {
  return sales.map((sale) => ({
    ...sale,
    date: sale.date instanceof Date ? sale.date : new Date(sale.date),
  }));
}

export class LocalInventoryService implements InventoryDataService {
  async loadInitialState(): Promise<{ products: Product[]; sales: Sale[] }> {
    const products = readLocalStorage<Product[]>(STORAGE_KEYS.PRODUCTS, SAMPLE_PRODUCTS);
    const sales = readLocalStorage<Sale[]>(STORAGE_KEYS.SALES, []);

    return {
      products,
      sales: normalizeSales(sales),
    };
  }

  async createProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const createdProduct: Product = {
      ...product,
      id: Date.now().toString(),
    };

    const currentProducts = readLocalStorage<Product[]>(STORAGE_KEYS.PRODUCTS, SAMPLE_PRODUCTS);
    const nextProducts = [...currentProducts, createdProduct];
    writeLocalStorage(STORAGE_KEYS.PRODUCTS, nextProducts);

    return createdProduct;
  }

  async updateProduct(id: string, product: Omit<Product, 'id'>): Promise<Product> {
    const currentProducts = readLocalStorage<Product[]>(STORAGE_KEYS.PRODUCTS, SAMPLE_PRODUCTS);
    const nextProducts = currentProducts.map((currentProduct) =>
      currentProduct.id === id ? { ...currentProduct, ...product, id } : currentProduct
    );
    writeLocalStorage(STORAGE_KEYS.PRODUCTS, nextProducts);

    return nextProducts.find((currentProduct) => currentProduct.id === id)!;
  }

  async deleteProduct(id: string): Promise<void> {
    const currentProducts = readLocalStorage<Product[]>(STORAGE_KEYS.PRODUCTS, SAMPLE_PRODUCTS);
    const nextProducts = currentProducts.filter((product) => product.id !== id);
    writeLocalStorage(STORAGE_KEYS.PRODUCTS, nextProducts);
  }

  async createSale(sale: Omit<Sale, 'id'>): Promise<Sale> {
    const createdSale: Sale = {
      ...sale,
      id: Date.now().toString(),
    };

    const currentSales = readLocalStorage<Sale[]>(STORAGE_KEYS.SALES, []);
    const nextSales = [createdSale, ...currentSales];
    writeLocalStorage(STORAGE_KEYS.SALES, nextSales);

    return createdSale;
  }
}

export class SupabaseInventoryService implements InventoryDataService {
  private client = createSupabaseClient();

  private safeDate(date: string | Date): Date {
    return date instanceof Date ? date : new Date(date);
  }

  async loadInitialState(): Promise<{ products: Product[]; sales: Sale[] }> {
    const [{ data: products, error: productsError }, { data: salesWithItems, error: salesError }] =
      await Promise.all([
        this.client.from<Product>('products').select('*'),
        this.client
          .from('sales')
          .select('*, sale_items(*)')
          .order('date', { ascending: false }),
      ]);

    if (productsError) throw productsError;
    if (salesError) throw salesError;

    const normalizedProducts = (products ?? []).map((product) => ({
      ...product,
      minStock: (product as any).min_stock ?? product.minStock,
    })) as Product[];

    const normalizedSales = (salesWithItems ?? []).map((sale: any) => ({
      id: sale.id,
      date: this.safeDate(sale.date),
      total: sale.total,
      paymentMethod: sale.payment_method ?? sale.paymentMethod,
      customerName: sale.customer_name ?? sale.customerName,
      items: (sale.sale_items ?? []).map((item: any) => ({
        productId: item.product_id ?? item.productId,
        productName: item.product_name ?? item.productName,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
    })) as Sale[];

    return {
      products: normalizedProducts,
      sales: normalizedSales,
    };
  }

  async createProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const createdProduct: Product = {
      ...product,
      id: Date.now().toString(),
    };

    const { error } = await this.client.from('products').insert(createdProduct);
    if (error) throw error;

    return createdProduct;
  }

  async updateProduct(id: string, product: Omit<Product, 'id'>): Promise<Product> {
    const { data, error } = await this.client
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await this.client.from('products').delete().eq('id', id);
    if (error) throw error;
  }

  async createSale(sale: Omit<Sale, 'id'>): Promise<Sale> {
    const createdSale: Sale = {
      ...sale,
      id: Date.now().toString(),
    };

    const { error: salesError } = await this.client.from('sales').insert(createdSale);
    if (salesError) throw salesError;

    const saleItems = sale.items.map((item) => ({
      ...item,
      sale_id: createdSale.id,
    }));

    const { error: itemsError } = await this.client.from('sale_items').insert(saleItems);
    if (itemsError) throw itemsError;

    return createdSale;
  }
}

export function createInventoryService(): InventoryDataService {
  if (hasSupabaseConfig()) {
    return new SupabaseInventoryService();
  }

  return new LocalInventoryService();
}
