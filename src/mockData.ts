import { subDays, format, startOfDay, isSameDay } from 'date-fns';

export type OrderStatus = 'Entregado' | 'En tránsito' | 'Devuelto' | 'Cancelado' | 'Pendiente' | 'Guía Generada' | 'Recolectado' | 'Incidencia';

export interface Order {
  id: string; // Firestore ID
  orderId: string; // Document External ID
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
  trackingId?: string;
  cancellationReason?: string;
  
  // High detail logistics fields
  fechaReporte?: string;
  hora?: string;
  nombreCliente?: string;
  telefono?: string;
  emailCliente?: string;
  tipoIdentificacion?: string;
  nroIdentificacion?: string;
  tipoEnvio?: string;
  departamentoDestino?: string;
  ciudadDestino?: string;
  direccion?: string;
  notas?: string;
  transportadora?: string;
  numeroFactura?: string;
  valorFacturado?: number;
  valorCompraProductos?: number;
  gananciaManual?: number;
  precioFlete?: number;
  costoDevolucionFlete?: number;
  comision?: number;
  totalPreciosProveedor?: number;
  novedad?: string;
  fueSolucionadaNovedad?: string;
  horaNovedad?: string;
  fechaNovedad?: string;
  solucion?: string;
  horaSolucion?: string;
  fechaSolucion?: string;
  observacion?: string;
  usuarioSolucionaNovedad?: string;
  horaUltimoMovimiento?: string;
  fechaUltimoMovimiento?: string;
  ultimoMovimiento?: string;
  conceptoUltimoMovimiento?: string;
  ubicacionUltimoMovimiento?: string;
  vendedor?: string;
  tipoTienda?: string;
  tienda?: string;
  idOrdenTienda?: string;
  numeroPedidoTienda?: string;
  tags?: string;
  fechaGeneracionGuia?: string;
  usuarioGeneracionGuia?: string;
  codigoPostal?: string;
  contadorIndemnizaciones?: number;
  conceptoUltimaIndemnizacion?: string;
  categorias?: string;
  
  // Facturación Electrónica (FE)
  razonSocialFacturacion?: string;
  emailFacturacion?: string;
  fePais?: string;
  feTipoPersona?: string;
  feTipoDocumento?: string;
  feDocumento?: string;
  feMunicipio?: string;
  feDireccion?: string;
  feNumeroTelefono?: string;
  feTipoRegimen?: string;
  feTipoResponsabilidad?: string;
  feImpuesto?: string;
  sourceCurrency?: CurrencyCode;
  priorityShipping?: number;
}

const PRODUCTS = [
  'Smartwatch Pro X', 'Auriculares Noise-Cancelling', 'Mini Proyector 4K', 
  'Teclado Mecánico RGB', 'Cámara de Seguridad WiFi', 'Lámpara Inteligente',
  'Humidificador Ultrasónico', 'Soporte Ergonómico Laptop'
];

const PROVIDERS = ['AliExpress Direct', 'CJ Dropshipping', 'Local Warehouse', 'Wiio'];
const COUNTRIES = ['Colombia', 'México', 'Chile', 'Perú', 'Ecuador', 'Panamá', 'España', 'Brasil', 'Guatemala'];
const STATUSES: OrderStatus[] = ['Entregado', 'En tránsito', 'Guía Generada', 'Recolectado', 'Incidencia', 'Devuelto', 'Cancelado', 'Pendiente'];
const CANCEL_REASONS = ['Cambio de opinión', 'Error en dirección', 'Precio alto', 'Tiempo de entrega', 'Duplicado'];

export const generateMockData = (): Order[] => {
  const orders: Order[] = [];
  const now = new Date();
  const baseCurrency: CurrencyCode = 'USD';
  const rate = CURRENCIES[baseCurrency].rate;

  for (let i = 0; i < 150; i++) {
    const date = subDays(now, Math.floor(Math.random() * 30));
    const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    // Storing in USD base
    const cost = (15 + Math.random() * 40);
    const price = cost * (1.5 + Math.random() * 1.5);
    const shippingCharged = Math.random() > 0.5 ? (5 + Math.random() * 10) : 0;
    const shippingReal = (4 + Math.random() * 2); // Real shipping around $4-6
    const adsCost = (5 + Math.random() * 15);
    const platformFee = 0.03; // 3%
    
    // Weighted status
    const rand = Math.random();
    let status: OrderStatus = 'Entregado';
    if (rand < 0.1) status = 'Devuelto';
    else if (rand < 0.2) status = 'Cancelado';
    else if (rand < 0.4) status = 'Pendiente';
    else if (rand < 0.6) status = 'En tránsito';
    else if (rand < 0.8) status = 'Guía Generada';
    else if (rand < 0.9) status = 'Recolectado';
    else status = 'Incidencia';

    orders.push({
      id: `mock-${i}`,
      orderId: `ORD-${1000 + i}`,
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
      sourceCurrency: baseCurrency,
      cancellationReason: status === 'Cancelado' ? CANCEL_REASONS[Math.floor(Math.random() * CANCEL_REASONS.length)] : undefined,
      
      // Mocked new fields with realistic values
      nombreCliente: ['Juan Perez', 'Maria Garcia', 'Carlos Lopez', 'Ana Martinez'][Math.floor(Math.random() * 4)],
      telefono: '300' + Math.floor(Math.random() * 10000000),
      ciudadDestino: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'][Math.floor(Math.random() * 4)],
      departamentoDestino: ['Cundinamarca', 'Antioquia', 'Valle', 'Atlántico'][Math.floor(Math.random() * 4)],
      transportadora: ['Servientrega', 'Envía', 'Interrapidisimo'][Math.floor(Math.random() * 3)],
      vendedor: 'Vendedor ' + (Math.floor(Math.random() * 5) + 1),
      tienda: 'Tienda Pro',
      emailCliente: 'cliente@ejemplo.com',
      valorFacturado: price,
      valorCompraProductos: cost,
      precioFlete: 4 + Math.random() * 3, // ~15,000 - 27,000 COP
      comision: price * 0.05,
      fechaReporte: format(date, 'yyyy-MM-dd'),
      hora: '14:30',
      tipoEnvio: 'Nacional',
      direccion: 'Calle ' + Math.floor(Math.random() * 100) + ' # ' + Math.floor(Math.random() * 50),
      numeroFactura: 'FE-' + (5000 + i),
      fueSolucionadaNovedad: 'No'
    });
  }

  return orders.sort((a, b) => b.date.getTime() - a.date.getTime());
};

export const CURRENCIES = {
  USD: { symbol: '$', rate: 1, name: 'USD' },
  COP: { symbol: '$', rate: 3900, name: 'COP' },
  MXN: { symbol: '$', rate: 17, name: 'MXN' },
  CLP: { symbol: '$', rate: 950, name: 'CLP' },
  PEN: { symbol: 'S/', rate: 3.43, name: 'PEN' },
  GTQ: { symbol: 'Q', rate: 7.73, name: 'GTQ' },
  EUR: { symbol: '€', rate: 0.92, name: 'EUR' },
  BRL: { symbol: 'R$', rate: 5, name: 'BRL' },
  ARS: { symbol: '$', rate: 1000, name: 'ARS' },
};

export type CurrencyCode = keyof typeof CURRENCIES;

export const calculateOrderProfit = (order: Order) => {
  const price = Math.abs(Number(order.valorFacturado || order.price || 0));
  const cost = Math.abs(Number(order.valorCompraProductos || order.cost || 0));
  const shippingReal = Math.abs(Number(order.precioFlete || order.shippingReal || 0));
  const adsCost = Math.abs(Number(order.adsCost || 0));
  const platformFee = Number(order.platformFee || 0);
  const comision = Math.abs(Number(order.comision || 0));

  const platformCost = price * platformFee;
  const finalFees = comision > 0 ? comision : platformCost;
  
  let netProfit = 0;
  let revenue = 0;

  if (order.status === 'Entregado') {
    revenue = price;
    if (order.gananciaManual !== undefined && order.gananciaManual !== 0) {
      // Use the exact profit from the document as requested
      netProfit = order.gananciaManual;
    } else {
      netProfit = revenue - cost - shippingReal - adsCost - finalFees;
    }
  } else if (order.status === 'Devuelto') {
    const returnCost = Math.abs(Number(order.costoDevolucionFlete || (shippingReal * 0.5)));
    revenue = 0;
    netProfit = -(shippingReal + returnCost + adsCost);
  } else {
    // Pendiente, En tránsito, Cancelado, etc.
    revenue = 0;
    netProfit = 0;
  }

  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const costTotal = cost + shippingReal + adsCost + finalFees;
  const roi = costTotal > 0 ? (netProfit / costTotal) * 100 : 0;

  return { revenue, netProfit, margin, roi };
};
