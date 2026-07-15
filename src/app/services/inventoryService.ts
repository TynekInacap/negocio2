import { createSupabaseClient, hasSupabaseConfig } from '../../lib/supabase';
import { Product, Sale, InventoryDataService } from '../types';

const STORAGE_KEYS = {
  PRODUCTS: 'inventory-products',
  SALES: 'inventory-sales',
};

const SAMPLE_PRODUCTS: Product[] = [];

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

function toDbProduct(product: Omit<Product, 'id'> & { id?: string }) {
  return {
    ...product,
  } as const;
}

function toDbSale(sale: Omit<Sale, 'id'> & { id: string }) {
  const { items, paymentMethod, customerName, date, ...rest } = sale;
  return {
    ...rest,
    date: date instanceof Date ? date.toISOString() : date,
    payment_method: paymentMethod,
    customer_name: customerName,
  } as const;
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
        this.client.from('products').select('*'),
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

    const { error } = await this.client.from('products').insert(toDbProduct(createdProduct));
    if (error) throw error;

    return createdProduct;
  }

  async updateProduct(id: string, product: Omit<Product, 'id'>): Promise<Product> {
    const { data, error } = await this.client
      .from('products')
      .update(toDbProduct(product))
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

    const { error: salesError } = await this.client.from('sales').insert(toDbSale(createdSale));
    if (salesError) throw salesError;

    const saleItems = sale.items.map((item) => ({
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
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
