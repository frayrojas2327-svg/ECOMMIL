import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Download, ChevronDown, CheckCircle2, Truck, RotateCcw, XCircle, Clock, Trash2, Square, CheckSquare, AlertTriangle, Upload, FileSpreadsheet, Package, Plus, X, Globe, Zap, MapPin, FileX } from 'lucide-react';
import { Order, calculateOrderProfit, OrderStatus } from '../mockData';
import { format, parseISO, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface OrderManagementProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  formatCurrency: (amount: number) => string;
  onDeleteOrders?: (ids: string[]) => void;
  onAddOrders?: (newOrders: Omit<Order, 'id' | 'uid'>[]) => void;
  currentCurrency?: string;
  exchangeRate?: number;
  isConversionActive?: boolean;
  viewMode?: 'SHOPIFY' | 'DROPI' | 'TIKTOK';
}

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const styles = {
    'Entregado': 'text-[#00df9a] border-[#00df9a]/40 bg-[#00df9a]/5',
    'En tránsito': 'text-blue-400 border-blue-400/40 bg-blue-400/5',
    'Devuelto': 'text-[#ff9100] border-[#ff9100]/40 bg-[#ff9100]/5',
    'Cancelado': 'text-[#ff4b4b] border-[#ff4b4b]/40 bg-[#ff4b4b]/5',
    'Pendiente': 'text-amber-400 border-amber-400/40 bg-amber-400/5',
    'Guía Generada': 'text-slate-300 border-slate-500/40 bg-slate-500/5',
    'Recolectado': 'text-slate-300 border-slate-600/40 bg-slate-600/5',
    'Incidencia': 'text-red-400 border-red-900/40 bg-red-900/5',
  };

  const icons = {
    'Entregado': <CheckCircle2 size={12} />,
    'En tránsito': <Truck size={12} />,
    'Devuelto': <RotateCcw size={12} />,
    'Cancelado': <XCircle size={12} />,
    'Pendiente': <Clock size={12} />,
    'Guía Generada': <FileSpreadsheet size={12} />,
    'Recolectado': <Package size={12} />,
    'Incidencia': <AlertTriangle size={12} />,
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border flex items-center gap-1.5 w-fit whitespace-nowrap transition-all tracking-wider ${styles[status] || styles['Pendiente']}`}>
      {icons[status] || <Clock size={12} />}
      {status.toUpperCase()}
    </span>
  );
};

const PlatformBadge = ({ platform }: { platform: string }) => {
  const isDropi = platform.toLowerCase().includes('dropi');
  const isShopify = platform.toLowerCase().includes('shopify');

  if (isDropi) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] uppercase font-bold tracking-tight">
        Dropi
      </span>
    );
  }

  if (isShopify) {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] uppercase font-bold tracking-tight">
        Shopify
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] uppercase font-bold tracking-tight">
      {platform}
    </span>
  );
};

const DetailRow = ({ label, value }: { label: string, value: any }) => (
  <div className="flex flex-col gap-1 border-b border-white/[0.03] pb-2 last:border-0">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">{label}</span>
    <span className="text-[13px] text-white font-bold tracking-tight">{value || '---'}</span>
  </div>
);

const parseFlexibleDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  
  // If it's already a ISO string that parseISO can handle
  if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
    const d = parseISO(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  
  // Handle DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split(' ')[0].split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // Last resort attempt
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const OrderManagement: React.FC<OrderManagementProps> = ({ 
  orders, 
  setOrders,
  formatCurrency, 
  onDeleteOrders, 
  onAddOrders,
  currentCurrency = 'USD',
  exchangeRate = 1,
  isConversionActive = false,
  viewMode = 'DROPI'
}) => {
  const isReconciliationMode = viewMode === 'TIKTOK';
  const [activeSource, setActiveSource] = useState<'all' | 'shopify' | 'dropi' | 'tiktok' | 'reconciliation'>('all');
  const [shopifyOrders, setShopifyOrders] = useState<Order[]>([]);
  const [dropiOrders, setDropiOrders] = useState<Order[]>([]);

  const localFormatCurrency = (amount: number) => {
    const isUSD = !isConversionActive;
    const targetCurrency = isUSD ? 'USD' : currentCurrency;
    
    let converted = amount;
    if (!isUSD) {
      converted = amount * exchangeRate;
    }
    
    // Safety rounding to avoid float precision artifacts
    const rounded = Math.round(converted * 100) / 100;
    
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrency,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rounded);
  };

  const reconcile = () => {
    if (shopifyOrders.length === 0 || dropiOrders.length === 0) return;

    // Normalizar teléfono (solo números)
    const normalizePhone = (num: any) => {
      if (!num) return '';
      return String(num).replace(/\D/g, '');
    };

    // 1. Get all unique phones from Shopify
    const shopifyPhones = new Set();
    shopifyOrders.forEach(s => {
      const p = normalizePhone(s.telefono);
      if (p) shopifyPhones.add(p);
    });

    // 2. Prepare Shopify orders (they all stay)
    const reconciledShopify = shopifyOrders.map(s => {
      const sPhone = normalizePhone(s.telefono);
      const inDropi = dropiOrders.find(d => normalizePhone(d.telefono) === sPhone);
      
      if (inDropi) {
        return { 
          ...s, 
          // Merge data from Dropi into Shopify order where helpful
          trackingId: inDropi.trackingId || s.trackingId,
          status: inDropi.status,
          notas: 'CONCILIADO OK | Shopify + Dropi',
          precioFlete: inDropi.precioFlete,
          gananciaManual: inDropi.gananciaManual,
          // Add other Dropi fields if needed
          ciudadDestino: inDropi.ciudadDestino || s.ciudadDestino,
          departamentoDestino: inDropi.departamentoDestino || s.departamentoDestino
        };
      } else {
        return { 
          ...s, 
          notas: 'ERROR | No encontrado en Dropi',
          status: 'Incidencia' as OrderStatus
        };
      }
    });

    // 3. Get Dropi orders that are NOT in Shopify (TikTok / Organic)
    const tiktokOrders = dropiOrders.filter(d => {
      const dPhone = normalizePhone(d.telefono);
      return !shopifyPhones.has(dPhone);
    }).map(o => ({ 
      ...o, 
      notas: 'TIKTOK | Venta Orgánica',
      provider: 'Dropi' as const 
    }));

    // 4. Update the global orders list with the combined result
    setOrders([...reconciledShopify, ...tiktokOrders]);
    setActiveSource('all'); // Show global view
    setNotification({ 
      message: `ANÁLISIS COMPLETADO: ${reconciledShopify.length} pedidos Shopify procesados y ${tiktokOrders.length} ventas TikTok detectadas.`, 
      type: 'success' 
    });
    setTimeout(() => setNotification(null), 5000);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [deptFilter, setDeptFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Shopify' | 'Dropi' | 'TikTok'>('All');
  const [reqDate, setReqDate] = useState('');
  const [delDate, setDelDate] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState<{ type: 'selected' | 'all' } | null>(null);
  const [isImporting, setIsImporting] = useState<false | 'Dropi' | 'Shopify'>(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Order | null>(null);

  const [newOrderForm, setNewOrderForm] = useState<Omit<Order, 'id' | 'uid'>>({
    date: new Date(),
    orderId: '',
    product: '',
    cost: 0,
    price: 0,
    shippingCharged: 0,
    shippingReal: 0,
    adsCost: 0,
    platformFee: 0.05,
    status: 'Pendiente',
    provider: 'Dropi',
    country: 'Colombia',
    trackingId: ''
  });

  const handleAddManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddOrders) return;
    
    // Normalize values to USD (Internal Base)
    const normalizedOrder = {
      ...newOrderForm,
      id: `temp-${Math.random().toString(36).substring(2, 11)}`,
      price: isConversionActive ? newOrderForm.price / (exchangeRate || 1) : newOrderForm.price,
      cost: isConversionActive ? newOrderForm.cost / (exchangeRate || 1) : newOrderForm.cost,
      shippingCharged: isConversionActive ? newOrderForm.shippingCharged / (exchangeRate || 1) : newOrderForm.shippingCharged,
      shippingReal: (newOrderForm.shippingReal || 0) / (isConversionActive ? (exchangeRate || 1) : 1),
      adsCost: isConversionActive ? newOrderForm.adsCost / (exchangeRate || 1) : newOrderForm.adsCost,
      orderId: newOrderForm.orderId || `MAN-${Date.now().toString().slice(-6)}`
    };

    onAddOrders([normalizedOrder]);
    setNotification({ message: 'Pedido agregado manualmente con éxito.', type: 'success' });
    setTimeout(() => setNotification(null), 4000);
    setShowAddModal(false);
    setNewOrderForm({
      date: new Date(),
      orderId: '',
      product: '',
      cost: 0,
      price: 0,
      shippingCharged: 0,
      shippingReal: 0,
      adsCost: 0,
      platformFee: 0.05,
      status: 'Pendiente',
      provider: 'Dropi',
      country: 'Colombia',
      trackingId: ''
    });
  };

  const dropiInputRef = useRef<HTMLInputElement>(null);
  const shopifyInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File, platform: 'Dropi' | 'Shopify') => {
    if (!onAddOrders) return;

    setIsImporting(platform);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const parseMoney = (val: any) => {
          if (val === undefined || val === null || val === '') return 0;
          if (typeof val === 'number') return val;
          let str = String(val).trim();
          if (!str) return 0;
          
          // Remove currency symbols and non-numeric characters except separators
          str = str.replace(/GTQ|TQ|6TQ|Q|COP|\$|\s/gi, '');
          
          // Heuristic for LATAM/Dropi: "179.000,00" or "179.000"
          const lastComma = str.lastIndexOf(',');
          const lastDot = str.lastIndexOf('.');
          
          if (lastComma !== -1 && lastDot !== -1) {
            if (lastComma > lastDot) {
              // Format: 1.234,56
              str = str.replace(/\./g, '').replace(',', '.');
            } else {
              // Format: 1,234.56
              str = str.replace(/,/g, '');
            }
          } else if (lastComma !== -1) {
            // Only comma: could be 1.000 (thousands) or 1,50 (decimal)
            const parts = str.split(',');
            if (parts.length > 2 || parts[parts.length - 1].length === 3) {
              str = str.replace(/,/g, '');
            } else {
              str = str.replace(',', '.');
            }
          } else if (lastDot !== -1) {
            // Only dot: could be 179.000 (thousands) or 17.50 (decimal)
            const parts = str.split('.');
            if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
              str = str.replace(/\./g, '');
            }
          }
          
          const cleaned = str.replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        };

        const getField = (row: any, possibleNames: string[]) => {
          if (!row) return undefined;
          const keys = Object.keys(row);
          let key = keys.find(k => k && possibleNames.some(p => String(k).trim().toLowerCase() === String(p).trim().toLowerCase()) && row[k] !== undefined);
          if (!key) {
            key = keys.find(k => k && possibleNames.some(p => String(k).toLowerCase().includes(String(p).toLowerCase())) && row[k] !== undefined);
          }
          return key ? row[key] : undefined;
        };

        const getFirstNonEmptyField = (row: any, possibleNames: string[]) => {
          for (const name of possibleNames) {
            const val = getField(row, [name]);
            if (val !== undefined && val !== null && String(val).trim() !== '') return val;
          }
          return undefined;
        };

        const extractFromNotes = (notesStr: string, labels: string[]) => {
          if (!notesStr || typeof notesStr !== 'string') return '';
          // Normalize line endings and split
          const lines = notesStr.split(/\r?\n/);
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            const lowerLine = cleanLine.toLowerCase();
            for (const label of labels) {
              const labelLower = label.toLowerCase();
              if (lowerLine.includes(labelLower)) {
                if (cleanLine.includes(':')) {
                  return cleanLine.split(':').slice(1).join(':').trim();
                }
                return cleanLine.replace(new RegExp(label, 'i'), '').trim();
              }
            }
          }
          return '';
        };

        const normalize = (amount: number) => {
          // Internal values must ALWAYS be stored in USD for consistency.
          // Since Dropi/Shopify imports are typically in local currency, we divide by exchangeRate.
          if (!exchangeRate || exchangeRate === 1) return amount;
          return amount / exchangeRate;
        };

        let newOrders: Omit<Order, 'id' | 'uid'>[] = [];

        if (platform === 'Shopify') {
          // Detect format by reading sheet rows
          const rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          const isBlockFormat = rowsRaw.some(r => {
            const c0 = String(r[0] || '').toLowerCase();
            return c0.includes('nombre y apellido:') || c0.includes('dirección completa:');
          });

          if (isBlockFormat) {
            let currentOrder: any = null;
            const blockOrders: Omit<Order, 'id' | 'uid'>[] = [];

            for (let i = 0; i < rowsRaw.length; i++) {
              const row = rowsRaw[i];
              if (!row || row.length === 0) continue;
              
              const firstCell = String(row[0] || '').trim();

              if (firstCell.startsWith('#')) {
                if (currentOrder) blockOrders.push(currentOrder);
                
                const id = firstCell.includes(',') ? firstCell.split(',')[0].replace('#', '') : firstCell.replace('#', '');
                
                currentOrder = {
                  date: shopifyDate(row[15] || row[16] || row[14]),
                  orderId: id,
                  product: String(row[17] || row[18] || row[15] || 'Producto Shopify'),
                  price: normalize(parseMoney(row[11] || row[8] || 0)),
                  cost: normalize(parseMoney(row[11] || row[8] || 0)) * 0.4,
                  status: 'Pendiente',
                  provider: 'Shopify',
                  notas: 'Importado como Bloque',
                  nombreCliente: '',
                  telefono: '',
                  ciudadDestino: '',
                  departamentoDestino: '',
                  direccion: '',
                  shippingCharged: 0,
                  shippingReal: 0,
                  adsCost: 0,
                  platformFee: 0,
                  country: 'Colombia',
                  priorityShipping: 0
                };
              } else if (currentOrder) {
                const line = String(row[0] || '');
                const lowerLine = line.toLowerCase();
                const val = line.includes(':') ? line.split(':').slice(1).join(':').trim() : String(row[1] || '').trim();
                
                if (lowerLine.includes('nombre') || lowerLine.includes('apellido')) currentOrder.nombreCliente = val;
                else if (lowerLine.includes('tel') || lowerLine.includes('celular')) currentOrder.telefono = val.replace(/\D/g, '');
                else if (lowerLine.includes('departamento') || lowerLine.includes('provincia')) { 
                  currentOrder.departamentoDestino = val; 
                  currentOrder.country = val; 
                }
                else if (lowerLine.includes('ciudad') || lowerLine.includes('municipio')) currentOrder.ciudadDestino = val;
                else if (lowerLine.includes('direcci') || lowerLine.includes('calle')) currentOrder.direccion = val;
              }
            }
            if (currentOrder) blockOrders.push(currentOrder);
            newOrders = blockOrders;
          } else {
            // Standard Horizontal CSV Parsing - Process line by line then group
            const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
            const groupedMap = new Map<string, Omit<Order, 'id' | 'uid'>>();

            jsonData.forEach(row => {
              const orderId = String(getField(row, ['Name', 'Order ID', 'ID', 'Order', 'Número']) || '').replace('#', '').trim();
              if (!orderId || orderId.toLowerCase() === 'name') return;

              const notes = String(getFirstNonEmptyField(row, ['Notes', 'Note', 'Notas', 'Note Attributes', 'Comentarios']) || '');
              
              const subtotal = normalize(parseMoney(getField(row, ['Subtotal', 'Sub-total', 'Sub Total', 'Valor sin envío'])));
              const shipping = normalize(parseMoney(getField(row, ['Shipping', 'Envío', 'Coste de envío', 'Envío prioritario'])));
              const total = normalize(parseMoney(getField(row, ['Total', 'Price', 'Importe', 'Total Price', 'Valor Total'])));

              const rawProduct = String(getField(row, ['Lineitem name', 'Name', 'Producto', 'Item', 'Product Title']) || '');
              const isShippingRow = rawProduct.toLowerCase().includes('envio') || rawProduct.toLowerCase().includes('shipping');

              if (!groupedMap.has(orderId)) {
                const shippingName = extractFromNotes(notes, ['Nombre y Apellido', 'Nombre', 'Cliente', 'Name', 'FullName']) || 
                                   getField(row, ['Shipping Name', 'Billing Name', 'Customer Name', 'Nombre', 'Cliente']);
                                   
                const shippingPhone = extractFromNotes(notes, ['Teléfono', 'TelÃ©fono', 'Telefono', 'Celular', 'WhatsApp', 'WhatsApp:', 'Phone', 'NÃºmero de WhatsApp']) || 
                                    getField(row, ['Shipping Phone', 'Phone', 'Teléfono', 'Celular', 'Billing Phone', 'Tel:', 'WhatsApp']);
                                    
                const shippingCity = extractFromNotes(notes, ['Ciudad', 'Municipio', 'City', 'Mpio', 'Shipping City']) || 
                                   getField(row, ['Shipping City', 'City', 'Ciudad', 'Billing City', 'Municipio']);
                                   
                const shippingProvince = extractFromNotes(notes, ['Departamento', 'Depto', 'Estado', 'RegiÃ³n', 'Province', 'State']) || 
                                       getField(row, ['Shipping Province', 'Shipping Province Name', 'Province', 'State', 'Departamento', 'Billing Province Name', 'Provincia']);
                                       
                const shippingAddress1 = getField(row, ['Shipping Address1', 'Address1', 'Address', 'Dirección', 'Billing Address1', 'Calle', 'Direccion']);
                const shippingAddress2 = getField(row, ['Shipping Address2', 'Address2', 'Referencia', 'Indicaciones']);
                
                const fullAddress = extractFromNotes(notes, ['Dirección completa', 'Direccion completa', 'DirecciÃ³n completa', 'Dirección']) || 
                                   `${String(shippingAddress1 || '').trim()} ${String(shippingAddress2 || '').trim()}`.trim();

                const dateVal = getField(row, ['Created at', 'Fecha', 'Date', 'Created']) || '';

                const shippingVal = normalize(parseMoney(getField(row, ['Lineitem price', 'Price', 'Net Price'])));
                const isPriorityShipping = shippingVal === 198 || shippingVal === 7 || shippingVal === 7.5;
                
                groupedMap.set(orderId, {
                  date: shopifyDate(dateVal),
                  orderId,
                  product: isShippingRow ? 'Producto Shopify' : rawProduct,
                  nombreCliente: String(shippingName || 'Desconocido').trim(),
                  telefono: String(shippingPhone || '').replace(/\D/g, ''),
                  ciudadDestino: String(shippingCity || '').trim(),
                  departamentoDestino: String(shippingProvince || '').trim(),
                  direccion: fullAddress || String(shippingAddress1 || '').trim(),
                  price: total || (subtotal + shipping) || 0,
                  cost: (subtotal || total || 0) * 0.4,
                  shippingCharged: 0,
                  shippingReal: 0,
                  platformFee: 0,
                  adsCost: 0,
                  country: String(shippingProvince || '').trim(),
                  status: 'Pendiente',
                  provider: 'Shopify',
                  priorityShipping: isPriorityShipping ? shippingVal : 0,
                  notas: notes || 'Importado de Shopify'
                });
              } else {
                const existing = groupedMap.get(orderId)!;
                if (isShippingRow) {
                  const shippingVal = normalize(parseMoney(getField(row, ['Lineitem price', 'Price', 'Net Price'])));
                  const isPriorityShipping = shippingVal === 198 || shippingVal === 7 || shippingVal === 7.5;
                  if (isPriorityShipping) {
                    existing.priorityShipping = (existing.priorityShipping || 0) + shippingVal;
                  }
                }
                if (!isShippingRow && existing.product === 'Producto Shopify') {
                   existing.product = rawProduct;
                }
                // Ensure name/phone is filled if first row missed it
                if (existing.nombreCliente === 'Desconocido') {
                  const retryName = getField(row, ['Shipping Name', 'Billing Name', 'Customer Name', 'Nombre', 'Cliente']);
                  if (retryName) existing.nombreCliente = String(retryName).trim();
                }
                if (!existing.telefono) {
                  const retryPhone = getField(row, ['Shipping Phone', 'Phone', 'Teléfono', 'Celular', 'Billing Phone']);
                  if (retryPhone) existing.telefono = String(retryPhone).replace(/\D/g, '');
                }
              }
            });
            newOrders = Array.from(groupedMap.values()).filter(o => o.nombreCliente !== 'Desconocido' || o.telefono);
          }
        } else {
          // Dropi Mapping
          const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
          newOrders = jsonData.map(row => {
            const keys = Object.keys(row);
            const getField = (possibleNames: string[]) => {
              // Priority 1: Exact matches (cleaner)
              let key = keys.find(k => 
                possibleNames.some(p => k.toLowerCase().trim() === p.toLowerCase().trim()) && 
                row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== ''
              );
              
              // Priority 2: Contains match (but avoiding greedy matches for common short terms)
              if (!key) {
                key = keys.find(k => 
                  possibleNames.some(p => {
                    const pk = k.toLowerCase().trim();
                    const pp = p.toLowerCase().trim();
                    // Avoid matching "Flete" inside "Flete Devolución" when looking for outbound flete
                    if (pp === 'flete' || pp === 'venta' || pp === 'total' || pp === 'precio') {
                      return pk === pp; 
                    }
                    return pk.includes(pp);
                  }) && 
                  row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== ''
                );
              }
              return key ? row[key] : undefined;
            };

            const rawRecaudo = getField([
              'PRECIO_VENTA', 
              'VALOR_VENTA', 
              'VALOR_RECAUDO',
              'VALOR FACTURADO', 
              'RECAUDO_TOTAL', 
              'TOTAL_A_RECAUDAR', 
              'TOTAL_RECAUDO', 
              'RECAUDO', 
              'Precio Venta', 
              'Venta'
            ]);
            const rawProductoCol = getField(['PRODUCTO', 'ITEM', 'NOMBRE_PRODUCTO', 'NOMBRE PRODUCTO']);
            
            let valorFacturadoRaw = parseMoney(rawRecaudo);
            
            // Priority: Product name often contains the real price in Dropi (e.g., "Producto - 179000" or "X3 - 179")
            const pNameFull = String(getField(['Nombre Producto', 'Producto', 'Item', 'PRODUCTO', 'NOMBRE', 'ITEM', 'NOMBRE_PRODUCTO']) || '');
            const priceInNameMatch = pNameFull.match(/\d{3,}/);
            if (priceInNameMatch) {
              const extracted = parseMoney(priceInNameMatch[0]);
              // If extracted looks like a realistic price (usually > 10 in custom markets like GTQ)
              if (extracted > valorFacturadoRaw || valorFacturadoRaw < 10) {
                valorFacturadoRaw = extracted;
              }
            }

            // Fallback for very low values (using 5 as a floor for GTQ/custom currencies)
            if (valorFacturadoRaw < 5 && rawProductoCol !== undefined) {
              const extractedPrice = parseMoney(rawProductoCol);
              if (extractedPrice >= 5) valorFacturadoRaw = extractedPrice;
            }

            const valorFacturado = normalize(valorFacturadoRaw);
            const valorCompra = normalize(parseMoney(getField(['VALOR DE COMPRA EN PRODUCTOS', 'COSTO_PRODUCTO', 'COSTO_PROVEEDOR', 'VALOR_COMPRA', 'VALOR_UNITARIO_PROVEEDOR', 'Costo Producto', 'Costo'])));
            
            // Outbound shipping flete - specifically avoiding return columns
            // Added stricter matching for outbound flete
            const fleteField = getField([
              'PRECIO FLETE', 
              'VALOR_FLETE', 
              'COSTO_ENVIO', 
              'VALOR_ENVIO',
              'FLETE_TOTAL', 
              'Flete', 
              'Valor Flete'
            ]);
            const flete = normalize(parseMoney(fleteField));
            
            const ganancia = normalize(parseMoney(getField(['GANANCIA', 'Profit', 'Utilidad', 'GANANCIA_VENDEDOR', 'LIQUIDACION', 'UTILIDAD_NETA'])));
            const comision = normalize(parseMoney(getField(['COMISION', 'COMMISSION', 'FEE_PLATFORM', 'COMISION_TOTAL', 'Comisión'])));
            
            // Specific mapping for return/devolución columns - focusing on Dropi's "Flete Devolución"
            const rawDevolucion = getField([
              'VALOR FLETE DEVOLUCION', 
              'FLETE_DEVOLUCION', 
              'COSTO_RETORNO', 
              'VALOR_DEVOLUCION_FLETE', 
              'COSTO_LOGISTICA_DEVOLUCION',
              'Flete Devolución',
              'Costo Retorno',
              'FLETE_REGRESO',
              'ENVIO_DEVOLUCION'
            ]);
            const valorDevolucionRaw = parseMoney(rawDevolucion);
            const costoDevolucion = normalize(valorDevolucionRaw);
            
            const totalPreciosProveedor = normalize(parseMoney(getField(['TOTAL PRECIOS PROVEEDOR', 'TOTAL_PROVEEDOR', 'Supplier Total', 'Costo Total Proveedor'])));

            const rawStatus = String(getField(['Estado', 'Status', 'Estado Orden', 'Estado de la orden', 'Estado Actual', 'Seguimiento', 'Situación', 'ESTADO', 'ESTATUS']) || '').toUpperCase();
            let status: OrderStatus = 'Pendiente';
            if (rawStatus.includes('ENTREGADO') || rawStatus.includes('EXITOSO') || rawStatus.includes('FINALIZADO')) status = 'Entregado';
            else if (rawStatus.includes('DEVOLUCION') || rawStatus.includes('DEVUELTO') || rawStatus.includes('RETORNO')) status = 'Devuelto';
            else if (rawStatus.includes('CANCELADO') || rawStatus.includes('ANULADO')) status = 'Cancelado';
            else if (rawStatus.includes('TRANSITO') || rawStatus.includes('DESPACHADO') || rawStatus.includes('BODEGA')) status = 'En tránsito';
            else if (rawStatus.includes('GUIA_GENERADA') || rawStatus.includes('GUIA GENERADA')) status = 'Guía Generada';
            else if (rawStatus.includes('RECOLECTADO')) status = 'Recolectado';
            else if (rawStatus.includes('INCIDENCIA') || rawStatus.includes('NOVEDAD')) status = 'Incidencia';

            const trackingId = String(getField(['Guía', 'Guia', 'Tracking', 'Seguimiento', 'NÚMERO GUIA']) || '');
            const rawDropiDate = getField(['Fecha', 'Date', 'Creado', 'FECHA']);

            return {
              id: `temp-${Math.random().toString(36).substring(2, 11)}`,
              date: (rawDropiDate ? parseFlexibleDate(String(rawDropiDate)) : null) || new Date(),
              orderId: String(getField(['ID Pedido', 'ID', 'Referencia']) || '').replace('#', '') || `DRP-${Math.random().toString(36).substring(7).toUpperCase()}`,
              product: (() => {
                const nameCol = getField(['Nombre Producto', 'Producto', 'Item', 'NOMBRE_PRODUCTO', 'PRODUCTO_NOMBRE', 'NOMBRE']);
                if (nameCol) return String(nameCol);
                
                // Si "PRODUCTO" no es un número, probablemente sea el nombre
                const prodCol = getField(['PRODUCTO']);
                if (prodCol && parseMoney(prodCol) === 0) return String(prodCol);
                
                return 'Producto Dropi';
              })(),
              price: valorFacturado,
              valorFacturado: valorFacturado,
              cost: valorCompra,
              valorCompraProductos: valorCompra,
              shippingCharged: 0,
              shippingReal: flete,
              adsCost: 0,
              platformFee: comision > 0 ? 0 : 0.05, 
              status: status,
              provider: 'Dropi',
              country: 'Colombia',
              trackingId: trackingId,
              gananciaManual: ganancia,
              comision: comision,
              precioFlete: flete,
              costoDevolucionFlete: costoDevolucion,
              totalPreciosProveedor: totalPreciosProveedor,
              fechaReporte: String(getField(['FECHA DE REPORTE']) || ''),
              hora: String(getField(['HORA']) || ''),
              nombreCliente: String(getField(['NOMBRE CLIENTE']) || ''),
              telefono: String(getField(['TELÉFONO']) || ''),
              emailCliente: String(getField(['EMAIL']) || ''),
              departamentoDestino: String(getField(['DEPARTAMENTO DESTINO']) || ''),
              ciudadDestino: String(getField(['CIUDAD DESTINO']) || ''),
              direccion: String(getField(['DIRECCION']) || ''),
              notas: String(getField(['NOTAS']) || '') || 'Dropi Import',
              transportadora: String(getField(['TRANSPORTADORA']) || ''),
              numeroFactura: String(getField(['NUMERO DE FACTURA']) || ''),
              novedad: String(getField(['NOVEDAD']) || ''),
              solucion: String(getField(['SOLUCIÓN']) || ''),
              observacion: String(getField(['OBSERVACIÓN']) || ''),
              ultimoMovimiento: String(getField(['ÚLTIMO MOVIMIENTO']) || ''),
              vendedor: String(getField(['VENDEDOR']) || ''),
              tienda: String(getField(['TIENDA']) || ''),
              tags: String(getField(['TAGS']) || '')
            };
          });
        }
        
        function shopifyDate(raw: any) {
          const d = raw ? parseFlexibleDate(String(raw)) : null;
          return d && !isNaN(d.getTime()) ? d : new Date();
        }

        onAddOrders(newOrders);
        setNotification({ 
          message: `ÉXITO: Se han importado ${newOrders.length} pedidos de ${platform} correctamente.`, 
          type: 'success' 
        });
        setTimeout(() => setNotification(null), 5000);
      } catch (error) {
        console.error(`Error importing Excel:`, error);
        setNotification({ message: `Error al procesar el archivo.`, type: 'error' });
        setTimeout(() => setNotification(null), 5000);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredOrders = useMemo(() => {
    const normalizePhone = (num: any) => {
      if (!num) return '';
      return String(num).replace(/\D/g, '').slice(-10);
    };

    const shopifyCustomers = new Set();
    orders.forEach(o => {
      const isShopify = o.provider?.toLowerCase().includes('shopify') || (!o.provider && !o.transportadora);
      if (isShopify) {
        const name = (o.nombreCliente || '').toLowerCase().trim();
        const phone = normalizePhone(o.telefono);
        if (name && phone) shopifyCustomers.add(`${name}|${phone}`);
      }
    });

    return orders.filter(order => {
      const isDropi = order.provider?.toLowerCase().includes('dropi') || !!order.transportadora;
      const isShopify = order.provider?.toLowerCase().includes('shopify') || (!order.provider && !order.transportadora);

      if (viewMode === 'SHOPIFY') {
        if (!isShopify) return false;
      } else if (viewMode === 'DROPI') {
        if (!isDropi) return false;
      } else if (viewMode === 'TIKTOK') {
        if (!isDropi) return false;
        const name = (order.nombreCliente || '').toLowerCase().trim();
        const phone = normalizePhone(order.telefono);
        if (shopifyCustomers.has(`${name}|${phone}`)) return false;
      }
      
      const orderId = (order.orderId || '').toString();
      const product = (order.product || '').toString();
      const customerName = (order.nombreCliente || '').toString();
      const trackingId = (order.trackingId || '').toString();
      const phone = (order.telefono || '').toString();

      const matchesSearch = orderId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           product.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           phone.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      const matchesDept = !deptFilter || (order.departamentoDestino && order.departamentoDestino.toLowerCase().includes(deptFilter.toLowerCase())) || (order.country && order.country.toLowerCase().includes(deptFilter.toLowerCase()));
      const matchesCity = !cityFilter || (order.ciudadDestino && order.ciudadDestino.toLowerCase().includes(cityFilter.toLowerCase()));
      const matchesTag = !tagFilter 
        ? true 
        : tagFilter === 'SIN ETIQUETA' 
          ? (!order.tags || order.tags.trim() === '') 
          : (order.tags && order.tags.toLowerCase().includes(tagFilter.toLowerCase()));

      let matchesReqDate = true;
      if (reqDate) {
        try {
          if (order.date && !isNaN(order.date.getTime())) {
            const orderTime = startOfDay(order.date).getTime();
            const filterTime = startOfDay(parseISO(reqDate)).getTime();
            matchesReqDate = orderTime === filterTime;
          } else {
            matchesReqDate = false;
          }
        } catch (e) {
          matchesReqDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDept && matchesCity && matchesTag && matchesReqDate;
    });
  }, [orders, searchTerm, statusFilter, deptFilter, cityFilter, tagFilter, reqDate, viewMode]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('order-column-widths');
    return saved ? JSON.parse(saved) : {};
  });

  const resizingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const startResizing = (colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const header = (e.target as HTMLElement).parentElement;
    if (!header) return;
    
    resizingRef.current = {
      colId,
      startX: e.pageX,
      startWidth: header.offsetWidth
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { colId, startX, startWidth } = resizingRef.current;
    const delta = e.pageX - startX;
    const newWidth = Math.max(50, startWidth + delta);
    
    setColumnWidths(prev => {
      const next = { ...prev, [colId]: newWidth };
      localStorage.setItem('order-column-widths', JSON.stringify(next));
      return next;
    });
  };

  const stopResizing = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  };

  const activeColumns = useMemo(() => {
    if (viewMode === 'SHOPIFY') {
      return [
        { id: 'orderId', label: 'ID ORDEN', value: (o: Order) => o.orderId, className: 'font-black text-white text-[15px]' },
        { id: 'nombreCliente', label: 'NOMBRE COMPLETO', value: (o: Order) => o.nombreCliente, className: 'text-white font-black text-[15px]' },
        { id: 'telefono', label: 'TELÉFONO', value: (o: Order) => o.telefono, className: 'text-slate-300' },
        { id: 'ciudadDestino', label: 'CIUDAD', value: (o: Order) => o.ciudadDestino || '---' },
        { id: 'product', label: 'PRODUCTO', value: (o: Order) => o.product },
        { id: 'departamentoDestino', label: 'DEPARTAMENTO', value: (o: Order) => o.departamentoDestino || o.country || '---' },
        { id: 'direccion', label: 'DIRECCIÓN', value: (o: Order) => o.direccion, className: 'text-xs text-slate-400 truncate max-w-[150px]' },
        { id: 'price', label: 'VALOR PRODUCTO', value: (o: Order) => (o.price || 0) - (o.priorityShipping || 0), isMoney: true, className: 'text-emerald-400 font-bold' },
        { id: 'priorityShipping', label: 'ENVÍO PRIORITARIO', value: (o: Order) => o.priorityShipping || 0, isMoney: true, className: 'text-amber-400 font-bold' },
        { id: 'status', label: 'ESTATUS', value: (o: Order) => o.status, render: (o: Order) => <StatusBadge status={o.status} /> },
      ];
    }

    const allCols = [
      { id: 'fechaReporte', label: 'FECHA REPORTE', value: (o: Order) => o.fechaReporte, className: 'text-slate-300' },
      { id: 'orderId', label: 'ID ORDEN', value: (o: Order) => o.orderId, className: 'font-black text-white text-[15px]' },
      { id: 'hora', label: 'HORA', value: (o: Order) => o.hora, className: 'text-slate-300' },
      { id: 'date', label: 'FECHA', value: (o: Order) => (o.date && !isNaN(o.date.getTime())) ? format(o.date, 'yyyy-MM-dd') : '---', className: 'text-blue-400/80' },
      { id: 'nombreCliente', label: 'NOMBRE CLIENTE', value: (o: Order) => o.nombreCliente, className: 'text-white font-black text-[15px]' },
      { id: 'telefono', label: 'TELÉFONO', value: (o: Order) => o.telefono, className: 'text-slate-300' },
      { id: 'trackingId', label: 'NÚMERO GUIA', value: (o: Order) => o.trackingId || 'SIN GUÍA', className: 'text-slate-400 font-medium' },
      { id: 'status', label: 'ESTATUS', value: (o: Order) => o.status, render: (o: Order) => <StatusBadge status={o.status} /> },
      { id: 'product', label: 'PRODUCTO', value: (o: Order) => o.product },
      { 
        id: 'valorFacturado', 
        label: 'VALOR VENTA', 
        value: (o: Order) => calculateOrderProfit(o).revenue, 
        isMoney: true, 
        className: 'text-emerald-400 font-bold text-right' 
      },
      { 
        id: 'precioFlete', 
        label: 'FLETE (DROPI)', 
        value: (o: Order) => o.precioFlete || 0, 
        isMoney: true, 
        className: 'text-amber-400 text-right' 
      },
      { 
        id: 'costoDevolucionFlete', 
        label: 'FLETE DEV.', 
        value: (o: Order) => o.costoDevolucionFlete || 0, 
        isMoney: true, 
        className: 'text-red-400 text-right' 
      },
      { 
        id: 'netProfit', 
        label: 'UTILIDAD NETA', 
        value: (o: Order) => calculateOrderProfit(o).netProfit, 
        isMoney: true, 
        isProfit: true,
        className: 'text-right font-black'
      },
      { id: 'ciudadDestino', label: 'CIUDAD', value: (o: Order) => o.ciudadDestino },
      { id: 'departamentoDestino', label: 'DEPTO', value: (o: Order) => o.departamentoDestino },
      { id: 'direccion', label: 'DIRECCIÓN', value: (o: Order) => o.direccion, className: 'text-xs text-slate-500 truncate max-w-[150px]' },
      { id: 'transportadora', label: 'LOGÍSTICA', value: (o: Order) => o.transportadora },
      { id: 'notas', label: 'RECONCILIACIÓN / NOTAS', value: (o: Order) => o.notas, className: 'text-xs text-slate-400 truncate max-w-[200px]', hide: !isReconciliationMode },
      { id: 'emailCliente', label: 'EMAIL', value: (o: Order) => o.emailCliente },
      { id: 'vendedor', label: 'VENDEDOR', value: (o: Order) => o.vendedor },
      { id: 'tienda', label: 'TIENDA', value: (o: Order) => o.tienda },
      { id: 'numeroFactura', label: 'NRO FACTURA', value: (o: Order) => o.numeroFactura },
      { id: 'novedad', label: 'NOVEDAD', value: (o: Order) => o.novedad, className: 'text-xs text-slate-400' },
      { id: 'fueSolucionadaNovedad', label: 'SOLUCIONADO?', value: (o: Order) => o.fueSolucionadaNovedad },
      { id: 'solucion', label: 'SOLUCIÓN', value: (o: Order) => o.solucion, className: 'text-xs' },
      { id: 'observacion', label: 'OBSERVACIÓN', value: (o: Order) => o.observacion, className: 'text-xs' },
      { id: 'ultimoMovimiento', label: 'ULT. MOVIMIENTO', value: (o: Order) => o.ultimoMovimiento },
      { id: 'conceptoUltimoMovimiento', label: 'CONCEPTO MOV.', value: (o: Order) => o.conceptoUltimoMovimiento, className: 'text-xs' },
      { id: 'tags', label: 'TAGS', value: (o: Order) => o.tags },
    ];

    if (filteredOrders.length === 0) return allCols.filter(col => !(col as any).hide).slice(0, 15);

    return allCols.filter(col => {
      if ((col as any).hide) return false;
      return filteredOrders.some(order => {
        const val = col.value(order);
        if (val === undefined || val === null || val === '') return false;
        if (typeof val === 'string' && (val === '---' || val.trim() === '')) return false;
        if (typeof val === 'number' && val === 0) return false;
        return true;
      });
    });
  }, [filteredOrders, viewMode, isReconciliationMode]);

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedOrderIds.length === 0) return;
    setShowConfirm({ type: 'selected' });
  };

  const confirmDelete = () => {
    if (!showConfirm || !onDeleteOrders) return;
    
    if (showConfirm.type === 'selected') {
      onDeleteOrders(selectedOrderIds);
      setSelectedOrderIds([]);
    }
    setShowConfirm(null);
  };

  const exportToCSV = () => {
    const headers = [
      'FECHA DE REPORTE', 'ID', 'HORA', 'FECHA', 'NOMBRE CLIENTE', 'TELÉFONO', 'EMAIL', 
      'TIPO DE IDENTIFICACION', 'NRO DE IDENTIFICACION', 'NÚMERO GUIA', 'ESTATUS', 
      'TIPO DE ENVIO', 'DEPARTAMENTO DESTINO', 'CIUDAD DESTINO', 'DIRECCION', 
      'NOTAS', 'TRANSPORTADORA', 'NUMERO DE FACTURA', 'VALOR FACTURADO', 
      'VALOR DE COMPRA EN PRODUCTOS', 'GANANCIA', 'PRECIO FLETE', 'COSTO DEVOLUCION FLETE', 
      'COMISION', 'TOTAL EN PRECIOS DE PROVEEDOR', 'NOVEDAD', 'FUE SOLUCIONADA LA NOVEDAD', 
      'HORA DE NOVEDAD', 'FECHA DE NOVEDAD', 'SOLUCIÓN', 'HORA DE SOLUCIÓN', 
      'FECHA DE SOLUCIÓN', 'OBSERVACIÓN', 'HORA DE ÚLTIMO MOVIMIENTO', 
      'FECHA DE ÚLTIMO MOVIMIENTO', 'ÚLTIMO MOVIMIENTO', 'CONCEPTO ÚLTIMO MOVIMIENTO', 
      'UBICACIÓN DE ÚLTIMO MOVIMIENTO', 'VENDEDOR', 'TIPO DE TIENDA', 'TIENDA', 
      'ID DE ORDEN DE TIENDA', 'NUMERO DE PEDIDO DE TIENDA', 'TAGS', 
      'FECHA GENERACION DE GUIA', 'USUARIO GENERACION DE GUIA', 
      'USUARIO QUE SOLUCIONA LA NOVEDAD', 'CODIGO POSTAL', 'CONTADOR DE INDEMNIZACIONES', 
      'CONCEPTO ÚLTIMA INDENMIZACIÓN', 'CATEGORÍAS', 'RAZON SOCIAL PARA FACTURACION', 
      'EMAIL PARA FACTURACION', 'FE PAIS', 'FE TIPO DE PERSONA', 'FE TIPO DOCUMENTO', 
      'FE DOCUMENTO', 'FE MUNICIPIO', 'FE DIRECCION', 'FE NUMERO TELEFONO', 
      'FE TIPO DE REGIMEN', 'FE TIPO DE RESPONSABILIDAD', 'FE IMPUESTO'
    ];

    const rows = filteredOrders.map(o => {
      const formattedDate = (o.date && !isNaN(o.date.getTime())) ? format(o.date, 'yyyy-MM-dd') : '---';
      return [
        o.fechaReporte || '', o.orderId, o.hora || '', formattedDate,
        o.nombreCliente || '', o.telefono || '', o.emailCliente || '',
        o.tipoIdentificacion || '', o.nroIdentificacion || '', o.trackingId || '', o.status,
        o.tipoEnvio || '', o.departamentoDestino || '', o.ciudadDestino || '', o.direccion || '',
        o.notas || '', o.transportadora || '', o.numeroFactura || '', o.valorFacturado || 0,
        o.valorCompraProductos || 0, o.gananciaManual || 0, o.precioFlete || 0, o.costoDevolucionFlete || 0,
        o.comision || 0, o.totalPreciosProveedor || 0, o.novedad || '', o.fueSolucionadaNovedad || '',
        o.horaNovedad || '', o.fechaNovedad || '', o.solucion || '', o.horaSolucion || '',
        o.fechaSolucion || '', o.observacion || '', o.horaUltimoMovimiento || '',
        o.fechaUltimoMovimiento || '', o.ultimoMovimiento || '', o.conceptoUltimoMovimiento || '',
        o.ubicacionUltimoMovimiento || '', o.vendedor || '', o.tipoTienda || '', o.tienda || '',
        o.idOrdenTienda || '', o.numeroPedidoTienda || '', o.tags || '',
        o.fechaGeneracionGuia || '', o.usuarioGeneracionGuia || '',
        o.usuarioSolucionaNovedad || '', o.codigoPostal || '', o.contadorIndemnizaciones || 0,
        o.conceptoUltimaIndemnizacion || '', o.categorias || '', o.razonSocialFacturacion || '',
        o.emailFacturacion || '', o.fePais || '', o.feTipoPersona || '', o.feTipoDocumento || '',
        o.feDocumento || '', o.feMunicipio || '', o.feDireccion || '', o.feNumeroTelefono || '',
        o.feTipoRegimen || '', o.feTipoResponsabilidad || '', o.feImpuesto || ''
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `budgettrack_orders_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-24 relative">
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 min-w-[320px] backdrop-blur-md ${
              notification.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <p className="font-bold text-sm tracking-wide">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="ml-auto p-1 hover:bg-white/5 rounded-full transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00df9a] flex items-center justify-center text-black shadow-lg">
              <Zap size={26} fill="currentColor" />
            </div>
            <div>
              <h2 className="text-4xl font-display font-black text-white tracking-tighter uppercase leading-none">
                {viewMode === 'SHOPIFY' ? 'Panel Shopify' : viewMode === 'TIKTOK' ? <>TIKTOK <span className="text-[#00df9a]">PANEL</span></> : 'Gestión Dropi'}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">
                  {viewMode === 'SHOPIFY' ? 'Ventas e Ingresos' : viewMode === 'TIKTOK' ? 'Pedidos Dropi fuera de Shopify' : 'Logística y Despachos'}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-[#00df9a] animate-pulse" />
              </div>
            </div>
          </div>
          
          {isReconciliationMode && (
            <div className="flex gap-2 p-1 bg-[#111] border border-white/5 rounded-xl w-fit">
              {(['all', 'shopify', 'dropi', 'tiktok', 'reconciliation'] as const).map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveSource(tab)}
                  className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 whitespace-nowrap ${
                    activeSource === tab 
                      ? 'bg-white text-black shadow-md' 
                      : 'text-slate-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab === 'all' ? 'VISTA GLOBAL' : tab === 'shopify' ? 'SHOPIFY' : tab === 'dropi' ? 'DROPI' : tab === 'tiktok' ? 'TIKTOK' : 'ALERTAS'}
                </button>
              ))}
            </div>
          )}
        </div>

          <div className="flex flex-wrap items-center gap-4 bg-[#111] p-2 rounded-2xl border border-white/5 shadow-2xl">
          <div className="flex items-center gap-4 px-4 py-1 border-r border-white/5">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Importar</span>
            <div className="flex gap-2">
              {viewMode === 'SHOPIFY' && (
                <>
                  <input 
                    type="file" 
                    onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'Shopify')}
                    className="hidden" id="shopify-upload-clean"
                  />
                  <label 
                    htmlFor="shopify-upload-clean"
                    className="px-6 py-2.5 bg-[#00df9a]/5 border-2 border-[#00df9a]/60 rounded-xl font-black text-[11px] text-[#00df9a] cursor-pointer hover:bg-[#00df9a]/20 hover:border-[#00df9a] transition-all tracking-[0.15em] uppercase shadow-lg shadow-[#00df9a]/10 active:scale-95"
                  >
                    Importar Shopify
                  </label>
                </>
              )}

              {(viewMode === 'DROPI' || viewMode === 'TIKTOK') && (
                <>
                  <input 
                    type="file" 
                    onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'Dropi')}
                    className="hidden" id="dropi-upload-clean"
                  />
                  <label 
                    htmlFor="dropi-upload-clean"
                    className="px-6 py-2.5 bg-[#ff9100]/5 border-2 border-[#ff9100]/60 rounded-xl font-black text-[11px] text-[#ff9100] cursor-pointer hover:bg-[#ff9100]/20 hover:border-[#ff9100] transition-all tracking-[0.15em] uppercase shadow-lg shadow-orange-500/10 active:scale-95"
                  >
                    Importar Dropi
                  </label>
                </>
              )}
            </div>
          </div>

          {isReconciliationMode && (
            <button 
              onClick={reconcile}
              disabled={shopifyOrders.length === 0 || dropiOrders.length === 0}
              className={`flex items-center gap-3 px-8 py-3 rounded-lg font-black text-[11px] tracking-[0.1em] transition-all uppercase shadow-lg active:scale-95 ${
                shopifyOrders.length > 0 && dropiOrders.length > 0
                  ? 'bg-[#00df9a] text-black hover:bg-[#00c589] shadow-[#00df9a]/20'
                  : 'bg-slate-900 border border-white/5 text-slate-700 cursor-not-allowed'
              }`}
            >
              <Zap size={16} fill="currentColor" /> 
              PROCESAR INTELIGENCIA
            </button>
          )}

          <div className="flex bg-background/50 rounded-lg p-0.5 border border-border">
            <div className={`px-3 py-1.5 flex items-center gap-2 text-[10px] font-black tracking-widest ${isConversionActive ? 'text-neon' : 'text-slate-500'}`}>
              <Globe size={14} />
              {isConversionActive ? `MONEDA: ${currentCurrency}` : 'MODO USD'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {activeSource === 'reconciliation' ? (
          <>
            <div className="bg-gradient-to-br from-card/50 to-card/20 border border-white/5 rounded-3xl p-6 group hover:border-red-500/50 transition-all duration-500 shadow-xl overflow-hidden relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all"></div>
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl group-hover:scale-110 transition-transform"><AlertTriangle size={24} /></div>
                <span className="text-[10px] font-black text-red-500/50 tracking-widest px-2.5 py-1.5 bg-red-500/5 rounded-lg border border-red-500/10 uppercase">Faltante Dropi</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2">
                {orders.filter(o => o.notas?.includes('ERROR')).length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Shopify sin respaldo en Dropi</p>
            </div>

            <div className="bg-gradient-to-br from-card/50 to-card/20 border border-white/5 rounded-3xl p-6 group hover:border-emerald-500/50 transition-all duration-500 shadow-xl overflow-hidden relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform"><CheckCircle2 size={24} /></div>
                <span className="text-[10px] font-black text-emerald-400/50 tracking-widest px-2.5 py-1.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10 uppercase">Sincronizados</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2">
                {orders.filter(o => o.notas === 'CONCILIADO OK').length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Cruce de teléfono exitoso</p>
            </div>

            <div className="bg-gradient-to-br from-card/50 to-card/20 border border-white/5 rounded-3xl p-6 group hover:border-blue-500/50 transition-all duration-500 shadow-xl overflow-hidden relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform"><Globe size={24} /></div>
                <span className="text-[10px] font-black text-blue-400/50 tracking-widest px-2.5 py-1.5 bg-blue-500/5 rounded-lg border border-blue-500/10 uppercase">TikTok Orgánico</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2">
                {orders.filter(o => o.notas?.includes('TIKTOK')).length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Dropi sin registro en Shopify</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl overflow-hidden relative">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl group-hover:scale-110 transition-transform"><Zap size={24} /></div>
                <span className="text-[9px] font-black text-[#00df9a]/50 tracking-widest px-2.5 py-1.5 bg-[#00df9a]/5 rounded-lg border border-[#00df9a]/10 uppercase">Total Registros</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {orders.length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Base de datos procesada</p>
            </div>
          </>
        ) : activeSource === 'shopify' ? (
          <>
            <div className="bg-card/30 border border-border rounded-2xl p-6 group hover:border-[#00df9a] transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><Package size={24} /></div>
                <span className="text-[10px] font-bold text-[#00df9a]/50 tracking-widest px-2 py-1 bg-card rounded-md border border-[#00df9a]/10 uppercase">Ventas Shopify</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none">
                {shopifyOrders.length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-2 italic">Órdenes importadas</p>
            </div>
            <div className="bg-card/30 border border-border rounded-2xl p-6 group hover:border-[#00df9a] transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><FileSpreadsheet size={24} /></div>
                <span className="text-[10px] font-bold text-[#00df9a]/50 tracking-widest px-2 py-1 bg-card rounded-md border border-[#00df9a]/10 uppercase">Monto Productos</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none">
                {localFormatCurrency(shopifyOrders.reduce((sum, o) => sum + ((o.price || 0) - (o.priorityShipping || 0)), 0))}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-2 italic">Valor bruto de venta</p>
            </div>
            <div className="bg-card/30 border border-border rounded-2xl p-6 group hover:border-amber-500 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl"><Truck size={24} /></div>
                <span className="text-[10px] font-bold text-amber-500/50 tracking-widest px-2 py-1 bg-card rounded-md border border-amber-500/10 uppercase">Envío Prioritario</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none">
                {localFormatCurrency(shopifyOrders.reduce((sum, o) => sum + (o.priorityShipping || 0), 0))}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-2 italic">Total fletes prioritarios (7.00/198.00)</p>
            </div>
            <div className="bg-card/30 border border-border rounded-2xl p-6 group hover:border-red-500 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-red-500/10 text-red-400 rounded-xl"><AlertTriangle size={24} /></div>
                <span className="text-[10px] font-bold text-red-500/50 tracking-widest px-2 py-1 bg-card rounded-md border border-red-500/10 uppercase">Pendientes Logística</span>
              </div>
              <p className="text-2xl font-display font-black text-red-400 leading-none">
                {shopifyOrders.length > 0 ? Math.max(0, shopifyOrders.length - dropiOrders.length) : 0}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-2 italic">Diferencia Shopify vs Dropi</p>
            </div>
          </>
        ) : activeSource === 'tiktok' ? (
          <>
            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><Globe size={24} /></div>
                <span className="text-[10px] font-black text-[#00df9a]/50 tracking-widest px-2.5 py-1.5 bg-[#00df9a]/5 rounded-lg border border-[#00df9a]/10 uppercase">Ventas TikTok</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {orders.filter(o => o.notas?.includes('TIKTOK')).length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Diferencia Dropi vs Shopify (Celular)</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><FileSpreadsheet size={24} /></div>
                <span className="text-[10px] font-black text-[#00df9a]/50 tracking-widest px-2.5 py-1.5 bg-[#00df9a]/5 rounded-lg border border-[#00df9a]/10 uppercase">Facturación TT</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {localFormatCurrency(orders.filter(o => o.notas?.includes('TIKTOK')).reduce((sum, o) => sum + (o.price || 0), 0))}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Ventas detectadas en TikTok</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><Truck size={24} /></div>
                <span className="text-[10px] font-black text-[#00df9a]/50 tracking-widest px-2.5 py-1.5 bg-[#00df9a]/5 rounded-lg border border-[#00df9a]/10 uppercase">Costos Logística</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {localFormatCurrency(orders.filter(o => o.notas?.includes('TIKTOK')).reduce((sum, o) => sum + (o.precioFlete || 0), 0))}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Fletes reales de estas ventas</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><Zap size={24} /></div>
                <span className="text-[10px] font-black text-[#00df9a]/50 tracking-widest px-2.5 py-1.5 bg-[#00df9a]/5 rounded-lg border border-[#00df9a]/10 uppercase">Utilidad Pro</span>
              </div>
              <p className="text-2xl font-display font-black text-[#00df9a] leading-none mb-2 tabular-nums">
                {localFormatCurrency(orders.filter(o => o.notas?.includes('TIKTOK')).reduce((sum, o) => sum + (o.gananciaManual || 0), 0))}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Utilidad libre sin gasto en Ads</p>
            </div>
          </>
        ) : activeSource === 'dropi' ? (
          <>
            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><Package size={24} /></div>
                <span className="text-[10px] font-black text-[#00df9a]/50 tracking-widest px-2.5 py-1.5 bg-[#00df9a]/5 rounded-lg border border-[#00df9a]/10 uppercase">Ingresos Dropi</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {dropiOrders.length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Gestión logística total</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><CheckCircle2 size={24} /></div>
                <span className="text-[10px] font-black text-blue-400/50 tracking-widest px-2.5 py-1.5 bg-blue-400/5 rounded-lg border border-blue-400/10 uppercase">Efectividad</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {dropiOrders.filter(o => o.status === 'Entregado').length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Pedidos entregados con éxito</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl"><FileSpreadsheet size={24} /></div>
                <span className="text-[10px] font-black text-amber-400/50 tracking-widest px-2.5 py-1.5 bg-amber-400/5 rounded-lg border border-amber-400/10 uppercase">Gasto Logístico</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {localFormatCurrency(dropiOrders.reduce((sum, o) => sum + (o.precioFlete || 0), 0))}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Costo total de transportadoras</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl"><RotateCcw size={24} /></div>
                <span className="text-[10px] font-black text-orange-400/50 tracking-widest px-2.5 py-1.5 bg-orange-400/5 rounded-lg border border-orange-400/10 uppercase">Devoluciones</span>
              </div>
              <p className="text-2xl font-display font-black text-[#ff9100] leading-none mb-2 tabular-nums">
                {dropiOrders.filter(o => o.status === 'Devuelto').length}
              </p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest italic">Logística inversa detectada</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><Package size={24} /></div>
                <span className="text-[10px] font-black text-[#00df9a]/50 tracking-widest px-2.5 py-1.5 bg-[#00df9a]/5 rounded-lg border border-[#00df9a]/10 uppercase">Total Registros</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {filteredOrders.length}
              </p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shopify: {shopifyOrders.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00df9a] animate-pulse"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dropi: {dropiOrders.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><Download size={24} /></div>
                <span className="text-[9px] font-black text-blue-400/50 tracking-widest px-2.5 py-1.5 bg-blue-400/5 rounded-lg border border-blue-400/10 uppercase">Facturación Bruta</span>
              </div>
              <p className="text-2xl font-display font-black text-white leading-none mb-2 tabular-nums">
                {localFormatCurrency(filteredOrders.reduce((sum, o) => sum + (o.valorFacturado || 0), 0))}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Ventas brutas calculadas</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#00df9a]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#00df9a]/10 text-[#00df9a] rounded-xl"><Zap size={24} /></div>
                <span className="text-[9px] font-black text-[#00df9a]/50 tracking-widest px-2.5 py-1.5 bg-[#00df9a]/5 rounded-lg border border-[#00df9a]/10 uppercase">Utilidad Total</span>
              </div>
              <p className="text-2xl font-display font-black text-[#00df9a] leading-none mb-2 tabular-nums">
                {localFormatCurrency(filteredOrders.reduce((sum, o) => sum + (o.gananciaManual || 0), 0))}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Margen de ganancia calculado</p>
            </div>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 group hover:border-[#ff4b4b]/50 transition-all duration-300 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-[#ff4b4b]/10 text-[#ff4b4b] rounded-xl"><AlertTriangle size={24} /></div>
                <span className="text-[9px] font-black text-[#ff4b4b]/50 tracking-widest px-2.5 py-1.5 bg-[#ff4b4b]/5 rounded-lg border border-[#ff4b4b]/10 uppercase">Alertas Activas</span>
              </div>
              <p className="text-2xl font-display font-black text-[#ff4b4b] leading-none mb-2 tabular-nums">
                {filteredOrders.filter(o => o.notas?.includes('ERROR') || o.status === 'Incidencia').length}
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Detección de errores críticos</p>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-8">
        {selectedOrderIds.length > 0 && (
          <button 
            onClick={handleDeleteSelected}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
          >
            <Trash2 size={16} /> Borrar Registros ({selectedOrderIds.length})
          </button>
        )}
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all shadow-xl"
        >
          <Download size={16} /> Exportar Reporte
        </button>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
        {/* Filters Bar */}
        <div className="flex flex-col relative z-10">
          <div className="p-6 border-b border-white/5 flex flex-wrap items-center gap-6 bg-white/[0.01]">
            <div className="relative flex-1 min-w-[280px] group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por ID, Cliente o Producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-[14px] text-white focus:outline-none focus:border-white/20 focus:bg-[#111] transition-all placeholder:text-slate-600 font-medium"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Estado</span>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-[#111] border border-white/5 rounded-xl py-2.5 px-4 text-[13px] text-white focus:outline-none focus:border-white/20 transition-all font-bold cursor-pointer hover:bg-[#222]"
                >
                  <option value="All">Todos</option>
                  <option value="Entregado">Entregado</option>
                  <option value="En tránsito">En tránsito</option>
                  <option value="Guía Generada">Guía Generada</option>
                  <option value="Recolectado">Recolectado</option>
                  <option value="Incidencia">Incidencia</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Devuelto">Devuelto</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Tags</span>
                <select 
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="bg-[#111] border border-white/5 rounded-xl py-2 px-4 text-[13px] text-white focus:outline-none focus:border-white/20 transition-all font-bold h-[38px]"
                >
                  <option value="">TODOS</option>
                  <option value="SIN ETIQUETA">SIN ETIQUETA</option>
                  <option value="TIK TOK ORGANICO">TIK TOK ORGANICO</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Ciudad</span>
                <select 
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="bg-[#111] border border-white/5 rounded-xl py-2.5 px-4 text-[13px] text-white focus:outline-none focus:border-white/20 transition-all font-bold cursor-pointer hover:bg-[#222] max-w-[150px]"
                >
                  <option value="">Todas</option>
                  {Array.from(new Set(orders.map(o => o.ciudadDestino).filter(Boolean))).sort().map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Depto</span>
                <select 
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-[#111] border border-white/5 rounded-xl py-2.5 px-4 text-[13px] text-white focus:outline-none focus:border-white/20 transition-all font-bold cursor-pointer hover:bg-[#222] max-w-[150px]"
                >
                  <option value="">Todos</option>
                  {Array.from(new Set(orders.map(o => o.departamentoDestino).filter(Boolean))).sort().map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Origen</span>
                <select 
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as any)}
                  className="bg-[#111] border border-white/5 rounded-xl py-2.5 px-4 text-[13px] text-white focus:outline-none focus:border-white/20 transition-all font-bold cursor-pointer hover:bg-[#222]"
                >
                  <option value="All">Todas</option>
                  <option value="Shopify">Shopify</option>
                  <option value="Dropi">Dropi</option>
                  <option value="TikTok">TikTok / Externo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-white/5 flex flex-wrap items-center gap-6 bg-white/[0.005]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 bg-slate-800/40 p-2.5 rounded-2xl border border-white/5 min-w-[200px] hover:bg-slate-800/60 transition-colors">
                <div className="p-2 bg-white/5 rounded-xl text-slate-400">
                  <Clock size={16} />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">F. Solicitado</span>
                  <input 
                    type="date"
                    value={reqDate}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="bg-transparent border-none p-0 text-[11px] font-bold text-white focus:outline-none focus:ring-0 [color-scheme:dark] w-full cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-800/40 p-2.5 rounded-2xl border border-white/5 min-w-[200px] hover:bg-slate-800/60 transition-colors">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 shadow-sm">
                  <CheckCircle2 size={16} />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">F. Entregado</span>
                  <input 
                    type="date"
                    value={delDate}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    onChange={(e) => setDelDate(e.target.value)}
                    className="bg-transparent border-none p-0 text-[11px] font-bold text-white focus:outline-none focus:ring-0 [color-scheme:dark] w-full cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-800/40 p-2.5 rounded-2xl border border-white/5 min-w-[160px] hover:bg-slate-800/60 transition-colors">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                  <MapPin size={16} />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">Ubicación</span>
                  <input 
                    type="text" 
                    placeholder="Ciudad/Depto"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="bg-transparent border-none p-0 text-[11px] font-bold text-white focus:outline-none placeholder:text-slate-700 w-full"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                setDeptFilter('');
                setCityFilter('');
                setReqDate('');
                setDelDate('');
                setStatusFilter('All');
                setSearchTerm('');
                setSourceFilter('All');
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase tracking-[0.15em] ml-auto border border-transparent hover:border-white/5"
            >
              <RotateCcw size={14} /> Resetear Filtros
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar relative border border-white/5 rounded-2xl bg-black">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[3000px]">
            <thead>
              <tr className="bg-[#111] border-b border-white/5">
                <th className="p-5 font-black border-b border-white/5 sticky left-0 z-20 bg-[#111] w-14 text-center">
                  <button 
                    onClick={toggleSelectAll}
                    className="p-1 hover:text-white transition-colors"
                  >
                    {selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare size={16} className="text-white" /> : <Square size={16} className="text-slate-600" />}
                  </button>
                </th>
                {activeColumns.map(col => (
                  <th 
                    key={col.id} 
                    className={`p-5 text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 border-b border-white/5 relative group ${col.className?.includes('text-right') ? 'text-right' : 'text-left'}`}
                    style={{ width: columnWidths[col.id] || 'auto', minWidth: columnWidths[col.id] || 'auto' }}
                  >
                    <div className="truncate pr-4">{col.label}</div>
                    <div 
                      onMouseDown={(e) => startResizing(col.id, e)}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-[#00df9a]/20 cursor-col-resize transition-all z-10 hover:w-2 hover:bg-[#00df9a]/40"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length + 1} className="py-32 text-center">
                    <div className="flex flex-col items-center gap-6 opacity-30">
                      <div className="p-8 bg-slate-800/20 rounded-full text-slate-600 border border-white/5"><FileX size={64} strokeWidth={1} /></div>
                      <p className="text-slate-500 font-black tracking-[0.3em] uppercase text-[10px]">No se encontraron registros</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  return (
                    <motion.tr 
                      key={order.id || `order-${idx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`group hover:bg-white/[0.03] transition-all cursor-default ${isSelected ? 'bg-white/[0.05]' : ''}`}
                    >
                      <td className={`p-5 border-b border-white/5 sticky left-0 z-10 transition-colors ${isSelected ? 'bg-slate-900' : 'bg-[#0a0a0a] group-hover:bg-slate-900'}`} onClick={(e) => { e.stopPropagation(); toggleSelectOrder(order.id); }}>
                        <button className="p-1 text-slate-700 hover:text-white transition-colors transform active:scale-90">
                          {isSelected ? <CheckSquare size={18} className="text-white" /> : <Square size={18} />}
                        </button>
                      </td>
                      {activeColumns.map(col => {
                        const val = col.value(order);
                        const display = col.render ? col.render(order) : (col.isMoney ? localFormatCurrency(val as number) : String(val || '---'));
                        
                        let cellClassName = `p-5 border-b border-white/5 tracking-tight ${col.className || 'text-slate-300'}`;
                        if (col.isProfit) {
                          cellClassName += ` ${val as number > 0 ? 'text-[#00df9a] font-black' : val as number < 0 ? 'text-[#ff4b4b] font-black' : 'text-slate-500'}`;
                        } else if (col.id === 'orderId') {
                          cellClassName += ' font-black text-white tabular-nums';
                        } else if (col.id === 'trackingId') {
                          cellClassName += ' text-slate-400 font-medium tabular-nums';
                        }

                        return (
                          <td 
                            key={col.id} 
                            className={cellClassName} 
                            onClick={() => setShowDetailModal(order)}
                            style={{ 
                              width: columnWidths[col.id] || 'auto', 
                              maxWidth: columnWidths[col.id] || 'none' 
                            }}
                          >
                            <div className="truncate">
                              {display}
                            </div>
                          </td>
                        );
                      })}
                    </motion.tr>
                  );
                })
              )}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot className="border-t border-white/10 bg-white/[0.02] backdrop-blur-3xl sticky bottom-0 z-20">
                <tr className="font-black text-[13px]">
                  <td className="p-6 sticky left-0 z-30 bg-slate-950/80 border-t border-white/10"></td>
                  {activeColumns.map(col => {
                    const total = filteredOrders.reduce((sum, o) => {
                      const v = col.value(o);
                      return sum + (typeof v === 'number' ? v : 0);
                    }, 0);

                    if (col.isMoney) {
                      return (
                        <td 
                          key={col.id} 
                          className={`p-6 text-white border-t border-white/10 ${col.className?.includes('text-right') ? 'text-right' : ''}`}
                          style={{ width: columnWidths[col.id] || 'auto', minWidth: columnWidths[col.id] || 'auto' }}
                        >
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest leading-none mb-1">Total {col.label}</span>
                            <span className={col.isProfit ? (total >= 0 ? 'text-[#00df9a] text-lg' : 'text-red-400 text-lg') : 'text-white'}>
                              {localFormatCurrency(total)}
                            </span>
                          </div>
                        </td>
                      );
                    }
                    if (col.id === 'orderId') {
                      return (
                        <td 
                          key={col.id} 
                          className="p-6 border-t border-white/10"
                          style={{ width: columnWidths[col.id] || 'auto', minWidth: columnWidths[col.id] || 'auto' }}
                        >
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest leading-none mb-1">Total Registros</span>
                            <span className="text-white text-lg">{filteredOrders.length}</span>
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td 
                        key={col.id} 
                        className="p-6 border-t border-white/10"
                        style={{ width: columnWidths[col.id] || 'auto', minWidth: columnWidths[col.id] || 'auto' }}
                      ></td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-[15px] text-slate-500 italic">No se encontraron pedidos con los filtros aplicados.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/95 backdrop-blur-xl overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fintech-card max-w-4xl w-full my-auto max-h-[90vh] overflow-hidden flex flex-col border-primary/20 shadow-2xl"
            >
              <div className="p-6 border-b border-border flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-white">Detalles del Pedido: {showDetailModal.orderId}</h3>
                    <p className="text-sm text-slate-500">Información completa de logística y facturación</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Basic & Customer Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-4 border-b border-primary/20 pb-2">Información Básica</h4>
                    <div className="space-y-4">
                      <DetailRow label="ID de Orden" value={showDetailModal.orderId} />
                      <DetailRow label="Fecha" value={(showDetailModal.date && !isNaN(showDetailModal.date.getTime())) ? format(showDetailModal.date, 'yyyy-MM-dd') : '---'} />
                      <DetailRow label="Hora" value={showDetailModal.hora} />
                      <DetailRow label="Cliente" value={showDetailModal.nombreCliente} />
                      <DetailRow label="Teléfono" value={showDetailModal.telefono} />
                      <DetailRow label="Email" value={showDetailModal.emailCliente} />
                      <DetailRow label="Tipo ID" value={showDetailModal.tipoIdentificacion} />
                      <DetailRow label="Nro ID" value={showDetailModal.nroIdentificacion} />
                    </div>
                  </div>

                  {/* Logistics Info */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-[#00df9a] uppercase tracking-[0.2em] mb-4 border-b border-[#00df9a]/20 pb-2">Logística y Envío</h4>
                    <div className="space-y-4">
                      <DetailRow label="Guía" value={showDetailModal.trackingId} />
                      <DetailRow label="Estado" value={showDetailModal.status} />
                      <DetailRow label="Tipo Envío" value={showDetailModal.tipoEnvio} />
                      <DetailRow label="Vendedor" value={showDetailModal.vendedor} />
                      <DetailRow label="Transportadora" value={showDetailModal.transportadora} />
                      <DetailRow label="Departamento" value={showDetailModal.departamentoDestino} />
                      <DetailRow label="Ciudad" value={showDetailModal.ciudadDestino} />
                      <DetailRow label="Dirección" value={showDetailModal.direccion} />
                      <DetailRow label="Código Postal" value={showDetailModal.codigoPostal} />
                    </div>
                  </div>

                  {/* Financial Info */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 border-b border-blue-400/20 pb-2">Finanzas</h4>
                    <div className="space-y-4">
                      <DetailRow label="Valor Facturado" value={localFormatCurrency(showDetailModal.valorFacturado || 0)} />
                      <DetailRow label="Compra Productos" value={localFormatCurrency(showDetailModal.valorCompraProductos || 0)} />
                      <DetailRow label="Ganancia" value={localFormatCurrency(showDetailModal.gananciaManual || 0)} />
                      <DetailRow label="Flete" value={localFormatCurrency(showDetailModal.precioFlete || 0)} />
                      <DetailRow label="Comisión" value={localFormatCurrency(showDetailModal.comision || 0)} />
                      <DetailRow label="Gasto Publicidad" value={localFormatCurrency(showDetailModal.adsCost || 0)} />
                    </div>
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-white/5 pt-8">
                   {/* Novedades Info */}
                   <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-4 border-b border-red-400/20 pb-2">Novedades e Incidencias</h4>
                    <div className="space-y-4">
                      <DetailRow label="Novedad" value={showDetailModal.novedad} />
                      <DetailRow label="Solucionada" value={showDetailModal.fueSolucionadaNovedad} />
                      <DetailRow label="Solución" value={showDetailModal.solucion} />
                      <DetailRow label="Observación" value={showDetailModal.observacion} />
                      <DetailRow label="Último Movimiento" value={showDetailModal.ultimoMovimiento} />
                      <DetailRow label="Ubicación" value={showDetailModal.ubicacionUltimoMovimiento} />
                    </div>
                  </div>

                  {/* Billing Info (FE) */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4 border-b border-blue-400/20 pb-2">Facturación Electrónica</h4>
                    <div className="space-y-4">
                      <DetailRow label="Razón Social" value={showDetailModal.razonSocialFacturacion} />
                      <DetailRow label="Email Fact." value={showDetailModal.emailFacturacion} />
                      <DetailRow label="FE Documento" value={showDetailModal.feDocumento} />
                      <DetailRow label="FE Municipio" value={showDetailModal.feMunicipio} />
                      <DetailRow label="FE Impuesto" value={showDetailModal.feImpuesto} />
                    </div>
                  </div>
                </div>

                {/* Tags and extra info */}
                <div className="mt-8 p-4 rounded-xl bg-white/5 border border-border">
                   <div className="flex flex-wrap gap-4 text-xs">
                      <div><span className="text-slate-500 mr-2">Tienda:</span> <span className="text-white">{showDetailModal.tienda} ({showDetailModal.tipoTienda})</span></div>
                      <div><span className="text-slate-500 mr-2">Tags:</span> <span className="text-white">{showDetailModal.tags || 'Ninguno'}</span></div>
                      <div><span className="text-slate-500 mr-2">Generado por:</span> <span className="text-white">{showDetailModal.usuarioGeneracionGuia}</span></div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Order Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="fintech-card p-6 md:p-8 max-w-2xl w-full border-primary/30 my-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-display font-bold text-white">Nuevo Pedido Manual</h4>
                    <p className="text-sm text-slate-500">Ingresa los detalles del pedido</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddManualOrder} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                   <h5 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-4 border-b border-primary/20 pb-1">Información de la Orden</h5>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">ID de Orden</label>
                  <input 
                    type="text" 
                    value={newOrderForm.orderId}
                    onChange={e => setNewOrderForm({...newOrderForm, orderId: e.target.value})}
                    placeholder="Ej: DRP-12345"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Producto</label>
                  <input 
                    required
                    type="text" 
                    value={newOrderForm.product}
                    onChange={e => setNewOrderForm({...newOrderForm, product: e.target.value})}
                    placeholder="Nombre del producto"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="md:col-span-2 mt-4">
                   <h5 className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] mb-4 border-b border-gold/20 pb-1">Datos del Cliente</h5>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre Cliente</label>
                  <input 
                    type="text" 
                    value={newOrderForm.nombreCliente || ''}
                    onChange={e => setNewOrderForm({...newOrderForm, nombreCliente: e.target.value})}
                    placeholder="Nombre completo"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Teléfono / Ciudad</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newOrderForm.telefono || ''}
                      onChange={e => setNewOrderForm({...newOrderForm, telefono: e.target.value})}
                      placeholder="Tel"
                      className="w-1/2 bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                    />
                    <input 
                      type="text" 
                      value={newOrderForm.ciudadDestino || ''}
                      onChange={e => setNewOrderForm({...newOrderForm, ciudadDestino: e.target.value})}
                      placeholder="Ciudad"
                      className="w-1/2 bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 mt-4">
                   <h5 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4 border-b border-secondary/20 pb-1">Logística y Costos</h5>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Plataforma</label>
                  <select 
                    value={newOrderForm.provider}
                    onChange={e => setNewOrderForm({...newOrderForm, provider: e.target.value})}
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="Dropi">Dropi</option>
                    <option value="Shopify">Shopify</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Estado</label>
                  <select 
                    value={newOrderForm.status}
                    onChange={e => setNewOrderForm({...newOrderForm, status: e.target.value as any})}
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En tránsito">En tránsito</option>
                    <option value="Entregado">Entregado</option>
                    <option value="Guía Generada">Guía Generada</option>
                    <option value="Incidencia">Incidencia</option>
                    <option value="Devuelto">Devuelto</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Guía / Tracking</label>
                  <input 
                    type="text" 
                    value={newOrderForm.trackingId}
                    onChange={e => setNewOrderForm({...newOrderForm, trackingId: e.target.value})}
                    placeholder="Número de guía"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Precio Venta (Ingreso)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={newOrderForm.price || ''}
                    onChange={e => setNewOrderForm({...newOrderForm, price: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Costo Producto</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={newOrderForm.cost || ''}
                    onChange={e => setNewOrderForm({...newOrderForm, cost: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Flete (Costo Envío)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={newOrderForm.shippingReal || ''}
                    onChange={e => setNewOrderForm({...newOrderForm, shippingReal: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="w-full bg-background border border-border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="md:col-span-2 pt-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-primary text-background rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                  >
                    Guardar Pedido
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fintech-card p-8 max-w-sm w-full space-y-6 border-primary/30"
            >
              <div className="flex items-center gap-3 text-gold">
                <AlertTriangle size={28} />
                <h4 className="text-xl font-display font-bold text-white">¿Confirmar Acción?</h4>
              </div>
              <p className="text-[15px] text-slate-400 leading-relaxed">
                ¿Estás seguro de que deseas eliminar {selectedOrderIds.length} pedidos seleccionados? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 py-3 rounded-xl border border-border text-slate-400 hover:text-white transition-all text-[15px] font-bold uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all text-[15px] font-bold uppercase tracking-widest"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrderManagement;
