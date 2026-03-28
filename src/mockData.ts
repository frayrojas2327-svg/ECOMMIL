import { subDays, format, startOfDay, isSameDay } from 'date-fns';

export type OrderStatus = 'Confirmado' | 'En tránsito' | 'Devuelto' | 'Cancelado' | 'Pendiente';

export interface Order {
  id: string;
  uid: string;
  date: Date;
  product: string;
  cost: number;
  price: number;
  shippingCharged: number;
  shippingReal: number;
  adsCost: number;
  platformFee: number; // percentage
  status: OrderStatus;
  provider: string;
  country: string;
  cancellationReason?: string;
}

const PRODUCTS = [
  'Smartwatch Pro X', 'Auriculares Noise-Cancelling', 'Mini Proyector 4K', 
  'Teclado Mecánico RGB', 'Cámara de Seguridad WiFi', 'Lámpara Inteligente',
  'Humidificador Ultrasónico', 'Soporte Ergonómico Laptop'
];

const PROVIDERS = ['AliExpress Direct', 'CJ Dropshipping', 'Local Warehouse', 'Wiio'];
const COUNTRIES = ['Colombia', 'México', 'Chile', 'Perú', 'Ecuador', 'Panamá', 'España', 'Brasil', 'Guatemala'];
const STATUSES: OrderStatus[] = ['Confirmado', 'En tránsito', 'Devuelto', 'Cancelado', 'Pendiente'];
const CANCEL_REASONS = ['Cambio de opinión', 'Error en dirección', 'Precio alto', 'Tiempo de entrega', 'Duplicado'];

export const generateMockData = (): Order[] => {
  const orders: Order[] = [];
  const now = new Date();

  for (let i = 0; i < 150; i++) {
    const date = subDays(now, Math.floor(Math.random() * 30));
    const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    const cost = 15 + Math.random() * 40;
    const price = cost * (1.5 + Math.random() * 1.5);
    const shippingCharged = Math.random() > 0.5 ? 5 + Math.random() * 10 : 0;
    const shippingReal = 8 + Math.random() * 12;
    const adsCost = 5 + Math.random() * 15;
    const platformFee = 0.03; // 3%
    
    // Weighted status
    const rand = Math.random();
    let status: OrderStatus = 'Confirmado';
    if (rand < 0.1) status = 'Devuelto';
    else if (rand < 0.2) status = 'Cancelado';
    else if (rand < 0.4) status = 'Pendiente';
    else if (rand < 0.7) status = 'En tránsito';

    orders.push({
      id: `ORD-${1000 + i}`,
      uid: '',
      date,
      product,
      cost,
      price,
      shippingCharged,
      shippingReal,
      adsCost,
      platformFee,
      status,
      provider: PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)],
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
      cancellationReason: status === 'Cancelado' ? CANCEL_REASONS[Math.floor(Math.random() * CANCEL_REASONS.length)] : undefined
    });
  }

  return orders.sort((a, b) => b.date.getTime() - a.date.getTime());
};

export const CURRENCIES = {
  USD: { symbol: '$', rate: 1, name: 'USD' },
  COP: { symbol: '$', rate: 3900, name: 'COP' },
  MXN: { symbol: '$', rate: 17, name: 'MXN' },
  CLP: { symbol: '$', rate: 950, name: 'CLP' },
  PEN: { symbol: 'S/', rate: 3.7, name: 'PEN' },
  GTQ: { symbol: 'Q', rate: 7.8, name: 'GTQ' },
  EUR: { symbol: '€', rate: 0.92, name: 'EUR' },
  BRL: { symbol: 'R$', rate: 5, name: 'BRL' },
  ARS: { symbol: '$', rate: 1000, name: 'ARS' },
};

export type CurrencyCode = keyof typeof CURRENCIES;

export const calculateOrderProfit = (order: Order) => {
  const price = Number(order.price || 0);
  const shippingCharged = Number(order.shippingCharged || 0);
  const cost = Number(order.cost || 0);
  const shippingReal = Number(order.shippingReal || 0);
  const adsCost = Number(order.adsCost || 0);
  const platformFee = Number(order.platformFee || 0);

  const revenue = price + shippingCharged;
  const platformCost = price * platformFee;
  
  let netProfit = 0;
  if (order.status === 'Cancelado') {
    netProfit = 0;
  } else if (order.status === 'Devuelto') {
    netProfit = -(shippingReal * 1.5 + adsCost);
  } else {
    netProfit = revenue - cost - shippingReal - adsCost - platformCost;
  }

  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const roi = (cost + shippingReal + adsCost) > 0 
    ? (netProfit / (cost + shippingReal + adsCost)) * 100 
    : 0;

  return { revenue, netProfit, margin, roi };
};
