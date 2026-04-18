import React, { useState, useMemo, useRef } from 'react';
import { Search, Filter, Download, ChevronDown, CheckCircle2, Truck, RotateCcw, XCircle, Clock, Trash2, Square, CheckSquare, AlertTriangle, Upload, FileSpreadsheet, Package, Plus, X } from 'lucide-react';
import { Order, calculateOrderProfit, OrderStatus } from '../mockData';
import { format, parseISO, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface OrderManagementProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
  onDeleteOrders?: (ids: string[]) => void;
  onAddOrders?: (newOrders: Omit<Order, 'id' | 'uid'>[]) => void;
  currentCurrency?: string;
  exchangeRate?: number;
  isConversionActive?: boolean;
}

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const styles = {
    'Entregado': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'En tránsito': 'bg-secondary/10 text-secondary border-secondary/20',
    'Devuelto': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'Cancelado': 'bg-red-500/10 text-red-400 border-red-500/20',
    'Pendiente': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Guía Generada': 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    'Recolectado': 'bg-slate-600/10 text-slate-300 border-slate-600/20',
    'Incidencia': 'bg-red-900/10 text-red-300 border-red-900/20',
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
    <span className={`px-2 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 w-fit whitespace-nowrap ${styles[status] || styles['Pendiente']}`}>
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
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
    <span className="text-sm text-white font-medium">{value || '---'}</span>
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
  formatCurrency, 
  onDeleteOrders, 
  onAddOrders,
  currentCurrency = 'USD',
  exchangeRate = 1,
  isConversionActive = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [deptFilter, setDeptFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
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
    onAddOrders([{
      ...newOrderForm,
      orderId: newOrderForm.orderId || `MAN-${Date.now().toString().slice(-6)}`
    }]);
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
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const parseMoney = (val: any) => {
          if (val === undefined || val === null || val === '') return 0;
          if (typeof val === 'number') return val;
          
          let str = String(val).trim();
          if (!str) return 0;

          // Check if it already has GTQ or Q to normalize back to USD if needed
          const hasLocalCurrencyIndicator = /GTQ|TQ|6TQ|Q/i.test(str);

          // Specialized cleaning for GTQ and common OCR errors
          str = str.replace(/GTQ|TQ|6TQ|Q/gi, '').trim();
          
          // Remove currency symbols and spaces
          str = str.replace(/[$\s]/g, '');

          const lastComma = str.lastIndexOf(',');
          const lastDot = str.lastIndexOf('.');

          // Determine which one is the decimal separator
          if (lastComma !== -1 && lastDot !== -1) {
            if (lastComma > lastDot) {
              str = str.replace(/\./g, '').replace(',', '.');
            } else {
              str = str.replace(/,/g, '');
            }
          } else if (lastComma !== -1) {
            const parts = str.split(',');
            if (parts.length > 2 || parts[parts.length - 1].length > 2) {
              str = str.replace(/,/g, '');
            } else {
              str = str.replace(',', '.');
            }
          } else if (lastDot !== -1) {
            const parts = str.split('.');
            // If it's one dot and last part is 3 digits, it's thousands (1.000)
            // If it's more than one dot, it's thousands (1.000.000)
            if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
              str = str.replace(/\./g, '');
            }
            // If it's one dot and 1 or 2 digits, it's decimal (7.9 or 7.90)
          }
          
          // Keep only numbers, dot and minus sign
          const cleaned = str.replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(cleaned);

          return isNaN(parsed) ? 0 : parsed;
        };

        const newOrders: Omit<Order, 'id' | 'uid'>[] = data.map(row => {
          const keys = Object.keys(row);
          const getField = (possibleNames: string[]) => {
            let key = keys.find(k => 
              possibleNames.some(p => k.toLowerCase() === p.toLowerCase()) && 
              row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== ''
            );
            if (!key) {
              key = keys.find(k => 
                possibleNames.some(p => k.toLowerCase().includes(p.toLowerCase())) && 
                row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== ''
              );
            }
            return key ? row[key] : undefined;
          };

          if (platform === 'Shopify') {
            const externalId = String(getField(['Name', 'Order ID', 'ID', 'Reference', 'Order']) || '');
            const price = parseMoney(getField(['Total', 'Price', 'Total Price', 'Subtotal', 'Importe']));
            const lineItemPrice = parseMoney(getField(['Lineitem price', 'Price', 'Item Price', 'Precio Unitario']));
            const lineItemQuantity = parseMoney(getField(['Lineitem quantity', 'Quantity', 'Qty', 'Cantidad'])) || 1;
            const financialStatus = String(getField(['Financial Status', 'Pagado', 'Estado Pago', 'Pago']) || '').toLowerCase();
            const fulfillmentStatus = String(getField(['Fulfillment Status', 'Estado Envío', 'Estado Despacho', 'Cumplimiento']) || '').toLowerCase();
            
            let status: OrderStatus = 'Pendiente';
            if (financialStatus.includes('paid') || financialStatus.includes('pagado')) {
              status = 'Entregado';
            }
            if (fulfillmentStatus.includes('fulfilled') || fulfillmentStatus.includes('enviado') || fulfillmentStatus.includes('entregado')) {
              status = 'Entregado';
            } else if (fulfillmentStatus.includes('transit') || fulfillmentStatus.includes('ruta')) {
              if (status !== 'Entregado') status = 'En tránsito';
            }

            const trackingId = String(getField(['Guía', 'Guia', 'Tracking', 'Seguimiento', 'Tracking number', 'Number']) || '');
            
            return {
              date: getField(['Created at', 'Fecha', 'Date', 'Creado']) ? new Date(getField(['Created at', 'Fecha', 'Date', 'Creado'])) : new Date(),
              orderId: externalId || `SHP-${Math.random().toString(36).substring(7).toUpperCase()}`,
              product: getField(['Lineitem name', 'Name', 'Nombre', 'Producto', 'Artículo']) || 'Producto Shopify',
              price: price,
              cost: lineItemPrice * 0.4 * lineItemQuantity, 
              shippingCharged: parseMoney(getField(['Shipping', 'Shipping Price', 'Envío', 'Flete'])),
              shippingReal: 0,
              adsCost: 0,
              platformFee: 0.02,
              status: status,
              provider: 'Shopify',
              country: getField(['Billing Country', 'Country', 'Pais', 'País']) || 'Colombia',
              trackingId: trackingId
            };
          } else {
            // Dropi Professional Mapping
            const externalId = String(getField(['ID Pedido', 'ID', 'Referencia', 'Order ID', 'Factura', 'N° Orden', 'Consecutivo', 'ID_PEDIDO']) || '');
            const product = getField(['Producto', 'Nombre Producto', 'Item', 'Lineitem name', 'Descripción', 'PRODUCTO', 'NOMBRE_PRODUCTO']) || 'Producto Dropi';
            
            // Prioritize specific fields for price and cost
            const valorFacturado = parseMoney(getField(['VALOR FACTURADO', 'Precio Venta', 'Total', 'Valor Total', 'Venta', 'Amount', 'Precio', 'PRECIO_VENTA', 'VALOR_VENTA', 'PRECIO_TOTAL', 'TOTAL_A_COBRAR', 'RECAUDO']));
            const valorCompra = parseMoney(getField(['VALOR DE COMPRA EN PRODUCTOS', 'Costo Producto', 'Costo', 'Provider Cost', 'Unit Price', 'Precio Costo', 'COSTO_PRODUCTO', 'COSTO_PROVEEDOR', 'TOTAL EN PRECIOS DE PROVEEDOR', 'PROVEEDOR', 'COSTO_TOTAL']));
            const flete = parseMoney(getField(['PRECIO FLETE', 'Flete', 'Valor Flete', 'Costo Envío', 'Shipping', 'Flete Real', 'Envío', 'VALOR_FLETE', 'COSTO_ENVIO', 'COSTO_FLETE']));
            const ganancia = parseMoney(getField(['GANANCIA', 'Profit', 'Utilidad', 'Net Profit', 'GANANCIA_VENDEDOR', 'LIQUIDACION', 'TOTAL_A_PAGAR', 'UTILIDAD_NETA', 'GANANCIA_NETA', 'UTILIDAD_BRUTA']));
            const comision = parseMoney(getField(['COMISION', 'Comisión', 'COMMISSION', 'FEE_PLATFORM', 'COMISION_CORTE', 'COMISION_VENTA']));
            const costoDevolucion = parseMoney(getField(['COSTO DEVOLUCION FLETE', 'Costo Devolución', 'Return Cost', 'FLETE_DEVOLUCION', 'COSTO_RETORNO']));
            const totalPreciosProveedor = parseMoney(getField(['TOTAL PRECIOS PROVEEDOR', 'Supplier Total', 'Costo Total Proveedor', 'TOTAL EN PRECIOS DE PROVEEDOR', 'TOTAL_PROVEEDOR', 'MONTO_PROVEEDOR']));

            const rawStatus = String(getField(['Estado', 'Status', 'Estado Orden', 'Estado de la orden', 'Estado Actual', 'Seguimiento', 'Situación', 'ESTADO', 'ESTATUS']) || '').toUpperCase();
            
            // Map Dropi status with more variations
            let status: OrderStatus = 'Pendiente';
            
            if (rawStatus.includes('ENTREGADO') || rawStatus.includes('EXITOSO') || rawStatus.includes('FINALIZADO') || rawStatus === 'DELIVERED') {
              status = 'Entregado';
            } else if (rawStatus.includes('DEVOLUCION') || rawStatus.includes('DEVUELTO') || rawStatus.includes('RETORNO') || rawStatus.includes('RECHAZADO')) {
              status = 'Devuelto';
            } else if (rawStatus.includes('CANCELADO') || rawStatus === 'CANCELLED' || rawStatus.includes('ANULADO')) {
              status = 'Cancelado';
            } else if (rawStatus.includes('TRANSITO') || rawStatus.includes('DESPACHADO') || rawStatus.includes('EN RUTA') || rawStatus.includes('VIAJE') || rawStatus.includes('DESPACHO') || rawStatus.includes('BODEGA')) {
              status = 'En tránsito';
            } else if (rawStatus.includes('GUIA_GENERADA') || rawStatus.includes('GUIA GENERADA') || rawStatus.includes('GENERADA') || rawStatus.includes('GUÍA')) {
              status = 'Guía Generada';
            } else if (rawStatus.includes('RECOLECTADO') || rawStatus.includes('RECOGIDO') || rawStatus.includes('RECOLECCION')) {
              status = 'Recolectado';
            } else if (rawStatus.includes('INCIDENCIA') || rawStatus.includes('NOVEDAD') || rawStatus.includes('REPROGRAMADO') || rawStatus.includes('PROBLEMA')) {
              status = 'Incidencia';
            } else if (rawStatus.includes('PENDIENTE') || rawStatus === 'PENDING' || rawStatus.includes('ESPERA')) {
              status = 'Pendiente';
            } else if (rawStatus.length > 0) {
              const matchedOrderStatuses: OrderStatus[] = ['Entregado', 'En tránsito', 'Devuelto', 'Cancelado', 'Pendiente', 'Guía Generada', 'Recolectado', 'Incidencia'];
              const matched = matchedOrderStatuses.find(s => s.toUpperCase() === rawStatus);
              if (matched) status = matched;
            }

            const trackingId = String(getField(['Guía', 'Guia', 'Tracking', 'Seguimiento', 'Tracking number', 'Código Seguimiento', 'Guía de la transportadora', 'GUIA_SEGUIMIENTO', 'NÚMERO GUIA']) || '');

            return {
              date: getField(['Fecha', 'Date', 'Creado', 'Fecha Orden', 'FECHA', 'FECHA_ORDEN']) ? new Date(getField(['Fecha', 'Date', 'Creado', 'Fecha Orden', 'FECHA', 'FECHA_ORDEN'])) : new Date(),
              orderId: externalId || `DRP-${Math.random().toString(36).substring(7).toUpperCase()}`,
              product: product,
              price: valorFacturado,
              cost: valorCompra,
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
              
              // New fields mapping with source prioritization
              fechaReporte: String(getField(['FECHA DE REPORTE']) || ''),
              hora: String(getField(['HORA']) || ''),
              nombreCliente: String(getField(['NOMBRE CLIENTE']) || ''),
              telefono: String(getField(['TELÉFONO']) || ''),
              emailCliente: String(getField(['EMAIL']) || ''),
              tipoIdentificacion: String(getField(['TIPO DE IDENTIFICACION']) || ''),
              nroIdentificacion: String(getField(['NRO DE IDENTIFICACION']) || ''),
              tipoEnvio: String(getField(['TIPO DE ENVIO']) || ''),
              departamentoDestino: String(getField(['DEPARTAMENTO DESTINO']) || ''),
              ciudadDestino: String(getField(['CIUDAD DESTINO']) || ''),
              direccion: String(getField(['DIRECCION']) || ''),
              notas: String(getField(['NOTAS']) || ''),
              transportadora: String(getField(['TRANSPORTADORA']) || ''),
              numeroFactura: String(getField(['NUMERO DE FACTURA']) || ''),
              valorFacturado: valorFacturado,
              valorCompraProductos: valorCompra,
              novedad: String(getField(['NOVEDAD']) || ''),
              fueSolucionadaNovedad: String(getField(['FUE SOLUCIONADA LA NOVEDAD']) || ''),
              horaNovedad: String(getField(['HORA DE NOVEDAD']) || ''),
              fechaNovedad: String(getField(['FECHA DE NOVEDAD']) || ''),
              solucion: String(getField(['SOLUCIÓN']) || ''),
              horaSolucion: String(getField(['HORA DE SOLUCIÓN']) || ''),
              fechaSolucion: String(getField(['FECHA DE SOLUCIÓN']) || ''),
              observacion: String(getField(['OBSERVACIÓN']) || ''),
              usuarioSolucionaNovedad: String(getField(['USUARIO QUE SOLUCIONA LA NOVEDAD']) || ''),
              horaUltimoMovimiento: String(getField(['HORA DE ÚLTIMO MOVIMIENTO']) || ''),
              fechaUltimoMovimiento: String(getField(['FECHA DE ÚLTIMO MOVIMIENTO']) || ''),
              ultimoMovimiento: String(getField(['ÚLTIMO MOVIMIENTO']) || ''),
              conceptoUltimoMovimiento: String(getField(['CONCEPTO ÚLTIMO MOVIMIENTO']) || ''),
              ubicacionUltimoMovimiento: String(getField(['UBICACIÓN DE ÚLTIMO MOVIMIENTO']) || ''),
              vendedor: String(getField(['VENDEDOR']) || ''),
              tipoTienda: String(getField(['TIPO DE TIENDA']) || ''),
              tienda: String(getField(['TIENDA']) || ''),
              idOrdenTienda: String(getField(['ID DE ORDEN DE TIENDA']) || ''),
              numeroPedidoTienda: String(getField(['NUMERO DE PEDIDO DE TIENDA']) || ''),
              tags: String(getField(['TAGS']) || ''),
              fechaGeneracionGuia: String(getField(['FECHA GENERACION DE GUIA']) || ''),
              usuarioGeneracionGuia: String(getField(['USUARIO GENERACION DE GUIA']) || ''),
              codigoPostal: String(getField(['CODIGO POSTAL']) || ''),
              contadorIndemnizaciones: parseMoney(getField(['CONTADOR DE INDEMNIZACIONES'])),
              conceptoUltimaIndemnizacion: String(getField(['CONCEPTO ÚLTIMA INDENMIZACIÓN']) || ''),
              categorias: String(getField(['CATEGORÍAS']) || ''),
              razonSocialFacturacion: String(getField(['RAZON SOCIAL PARA FACTURACION']) || ''),
              emailFacturacion: String(getField(['EMAIL PARA FACTURACION']) || ''),
              fePais: String(getField(['FE PAIS']) || ''),
              feTipoPersona: String(getField(['FE TIPO DE PERSONA']) || ''),
              feTipoDocumento: String(getField(['FE TIPO DOCUMENTO']) || ''),
              feDocumento: String(getField(['FE DOCUMENTO']) || ''),
              feMunicipio: String(getField(['FE MUNICIPIO']) || ''),
              feDireccion: String(getField(['FE DIRECCION']) || ''),
              feNumeroTelefono: String(getField(['FE NUMERO TELEFONO']) || ''),
              feTipoRegimen: String(getField(['FE TIPO DE REGIMEN']) || ''),
              feTipoResponsabilidad: String(getField(['FE TIPO DE  RESPONSABILIDAD']) || ''),
              feImpuesto: String(getField(['FE IMPUESTO']) || '')
            };
          }
        });

        onAddOrders(newOrders);
        setNotification({ 
          message: `ÉXITO: Se han importado ${newOrders.length} pedidos de ${platform} correctamente.`, 
          type: 'success' 
        });
        setTimeout(() => setNotification(null), 5000);
      } catch (error) {
        console.error(`Error importing ${platform} Excel:`, error);
        setNotification({ 
          message: `Error al procesar el archivo de ${platform}. Verifica el formato.`, 
          type: 'error' 
        });
        setTimeout(() => setNotification(null), 5000);
      } finally {
        setIsImporting(false);
        if (dropiInputRef.current) dropiInputRef.current.value = '';
        if (shopifyInputRef.current) shopifyInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           order.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (order.trackingId && order.trackingId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (order.nombreCliente && order.nombreCliente.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
      
      const matchesDept = !deptFilter || (order.departamentoDestino && order.departamentoDestino.toLowerCase().includes(deptFilter.toLowerCase()));
      const matchesCity = !cityFilter || (order.ciudadDestino && order.ciudadDestino.toLowerCase().includes(cityFilter.toLowerCase()));

      // Date Filtering
      let matchesReqDate = true;
      if (reqDate) {
        const orderTime = startOfDay(order.date).getTime();
        const filterTime = startOfDay(parseISO(reqDate)).getTime();
        matchesReqDate = orderTime === filterTime;
      }

      let matchesDelDate = true;
      if (delDate) {
        // Try to find delivery date from various fields
        const deliveryStr = order.fechaUltimoMovimiento || order.fechaSolucion || order.fechaReporte;
        if (deliveryStr && order.status === 'Entregado') {
          const deliveryDate = parseFlexibleDate(deliveryStr);
          if (deliveryDate) {
            const deliveryTime = startOfDay(deliveryDate).getTime();
            const filterTime = startOfDay(parseISO(delDate)).getTime();
            matchesDelDate = deliveryTime === filterTime;
          } else {
            matchesDelDate = false;
          }
        } else {
          matchesDelDate = false; 
        }
      }

      return matchesSearch && matchesStatus && matchesDept && matchesCity && matchesReqDate && matchesDelDate;
    });
  }, [orders, searchTerm, statusFilter, deptFilter, cityFilter, reqDate, delDate]);

  const activeColumns = useMemo(() => {
    const allCols = [
      { id: 'fechaReporte', label: 'FECHA REPORTE', value: (o: Order) => o.fechaReporte },
      { id: 'orderId', label: 'ID ORDEN', value: (o: Order) => o.orderId, className: 'font-bold text-white' },
      { id: 'hora', label: 'HORA', value: (o: Order) => o.hora },
      { id: 'date', label: 'FECHA', value: (o: Order) => o.date ? format(o.date, 'yyyy-MM-dd') : '', className: 'text-slate-500' },
      { id: 'nombreCliente', label: 'NOMBRE CLIENTE', value: (o: Order) => o.nombreCliente, className: 'text-white font-bold' },
      { id: 'telefono', label: 'TELÉFONO', value: (o: Order) => o.telefono },
      { id: 'emailCliente', label: 'EMAIL', value: (o: Order) => o.emailCliente },
      { id: 'tipoIdentificacion', label: 'TIPO ID', value: (o: Order) => o.tipoIdentificacion, className: 'text-xs text-slate-500' },
      { id: 'nroIdentificacion', label: 'NRO ID', value: (o: Order) => o.nroIdentificacion },
      { id: 'trackingId', label: 'NÚMERO GUIA', value: (o: Order) => o.trackingId || 'SIN GUÍA', className: 'font-mono text-xs text-slate-300 uppercase' },
      { id: 'status', label: 'ESTATUS', value: (o: Order) => o.status, render: (o: Order) => <StatusBadge status={o.status} /> },
      { id: 'tipoEnvio', label: 'TIPO ENVIO', value: (o: Order) => o.tipoEnvio },
      { id: 'departamentoDestino', label: 'DEPARTAMENTO', value: (o: Order) => o.departamentoDestino },
      { id: 'ciudadDestino', label: 'CIUDAD', value: (o: Order) => o.ciudadDestino, className: 'text-slate-300' },
      { id: 'direccion', label: 'DIRECCION', value: (o: Order) => o.direccion, className: 'text-xs text-slate-500 truncate max-w-[150px]' },
      { id: 'notas', label: 'NOTAS', value: (o: Order) => o.notas, className: 'text-xs text-slate-500 truncate max-w-[150px]' },
      { id: 'transportadora', label: 'TRANSPORTADORA', value: (o: Order) => o.transportadora },
      { id: 'numeroFactura', label: 'NRO FACTURA', value: (o: Order) => o.numeroFactura },
      { 
        id: 'valorFacturado', 
        label: 'VALOR FACTURADO', 
        value: (o: Order) => calculateOrderProfit(o).revenue, 
        isMoney: true, 
        className: 'text-emerald-400 font-bold text-right' 
      },
      { 
        id: 'valorCompraProductos', 
        label: 'VALOR COMPRA', 
        value: (o: Order) => {
          const { revenue } = calculateOrderProfit(o);
          return revenue > 0 ? Math.abs(o.valorCompraProductos || 0) : 0;
        }, 
        isMoney: true, 
        className: 'text-slate-400 text-right' 
      },
      { 
        id: 'netProfit', 
        label: 'GANANCIA', 
        value: (o: Order) => calculateOrderProfit(o).netProfit, 
        isMoney: true, 
        isProfit: true,
        className: 'text-right'
      },
      { 
        id: 'precioFlete', 
        label: 'PRECIO FLETE', 
        value: (o: Order) => (o.status === 'Entregado' || o.status === 'Devuelto' ? Math.abs(o.precioFlete || 0) : 0), 
        isMoney: true, 
        className: 'text-slate-400 text-right' 
      },
      { 
        id: 'costoDevolucionFlete', 
        label: 'COSTO DEV. FLETE', 
        value: (o: Order) => (o.status === 'Devuelto' ? Math.abs(o.costoDevolucionFlete || 0) : 0), 
        isMoney: true, 
        className: 'text-red-400 text-right' 
      },
      { 
        id: 'comision', 
        label: 'COMISION', 
        value: (o: Order) => (o.status === 'Entregado' ? Math.abs(o.comision || 0) : 0), 
        isMoney: true, 
        className: 'text-slate-400 text-right' 
      },
      { 
        id: 'totalPreciosProveedor', 
        label: 'TOTAL PROVEEDOR', 
        value: (o: Order) => (o.status === 'Entregado' ? Math.abs(o.totalPreciosProveedor || 0) : 0), 
        isMoney: true, 
        className: 'text-slate-400 text-right' 
      },
      { id: 'novedad', label: 'NOVEDAD', value: (o: Order) => o.novedad, className: 'text-xs text-slate-400 truncate max-w-[150px]' },
      { id: 'fueSolucionadaNovedad', label: 'SOLUCIONADO?', value: (o: Order) => o.fueSolucionadaNovedad },
      { id: 'horaNovedad', label: 'HORA NOVEDAD', value: (o: Order) => o.horaNovedad },
      { id: 'fechaNovedad', label: 'FECHA NOVEDAD', value: (o: Order) => o.fechaNovedad },
      { id: 'solucion', label: 'SOLUCIÓN', value: (o: Order) => o.solucion, className: 'text-xs text-slate-400 truncate max-w-[150px]' },
      { id: 'horaSolucion', label: 'HORA SOLUCIÓN', value: (o: Order) => o.horaSolucion },
      { id: 'fechaSolucion', label: 'FECHA SOLUCIÓN', value: (o: Order) => o.fechaSolucion },
      { id: 'observacion', label: 'OBSERVACIÓN', value: (o: Order) => o.observacion, className: 'text-xs text-slate-500 truncate max-w-[150px]' },
      { id: 'horaUltimoMovimiento', label: 'HORA ULT. MOV.', value: (o: Order) => o.horaUltimoMovimiento },
      { id: 'fechaUltimoMovimiento', label: 'FECHA ULT. MOV.', value: (o: Order) => o.fechaUltimoMovimiento },
      { id: 'ultimoMovimiento', label: 'ULT. MOVIMIENTO', value: (o: Order) => o.ultimoMovimiento },
      { id: 'conceptoUltimoMovimiento', label: 'CONCEPTO ULT. MOV.', value: (o: Order) => o.conceptoUltimoMovimiento, className: 'whitespace-normal min-w-[200px] text-xs leading-tight' },
      { id: 'ubicacionUltimoMovimiento', label: 'UBICACIÓN ULT. MOV.', value: (o: Order) => o.ubicacionUltimoMovimiento },
      { id: 'vendedor', label: 'VENDEDOR', value: (o: Order) => o.vendedor },
      { id: 'tipoTienda', label: 'TIPO TIENDA', value: (o: Order) => o.tipoTienda },
      { id: 'tienda', label: 'TIENDA', value: (o: Order) => o.tienda },
      { id: 'idOrdenTienda', label: 'ID ORDEN TIENDA', value: (o: Order) => o.idOrdenTienda },
      { id: 'numeroPedidoTienda', label: 'NRO PEDIDO TIENDA', value: (o: Order) => o.numeroPedidoTienda },
      { id: 'tags', label: 'TAGS', value: (o: Order) => o.tags },
      { id: 'fechaGeneracionGuia', label: 'FECHA GEN. GUIA', value: (o: Order) => o.fechaGeneracionGuia },
      { id: 'usuarioGeneracionGuia', label: 'USUARIO GEN. GUIA', value: (o: Order) => o.usuarioGeneracionGuia },
      { id: 'usuarioSolucionaNovedad', label: 'USUARIO SOL. NOVEDAD', value: (o: Order) => o.usuarioSolucionaNovedad },
      { id: 'codigoPostal', label: 'CODIGO POSTAL', value: (o: Order) => o.codigoPostal, className: 'font-mono' },
      { id: 'contadorIndemnizaciones', label: 'CONTADOR INDEM.', value: (o: Order) => o.contadorIndemnizaciones },
      { id: 'conceptoUltimaIndemnizacion', label: 'CONCEPTO ULT. INDEM.', value: (o: Order) => o.conceptoUltimaIndemnizacion, className: 'text-xs' },
      { id: 'categorias', label: 'CATEGORÍAS', value: (o: Order) => o.categorias },
      { id: 'razonSocialFacturacion', label: 'RAZON SOCIAL FAC.', value: (o: Order) => o.razonSocialFacturacion },
      { id: 'emailFacturacion', label: 'EMAIL FAC.', value: (o: Order) => o.emailFacturacion },
      { id: 'fePais', label: 'FE PAIS', value: (o: Order) => o.fePais },
      { id: 'feTipoPersona', label: 'FE TIPO PERSONA', value: (o: Order) => o.feTipoPersona, className: 'text-xs' },
      { id: 'feTipoDocumento', label: 'FE TIPO DOC', value: (o: Order) => o.feTipoDocumento, className: 'text-xs' },
      { id: 'feDocumento', label: 'FE DOCUMENTO', value: (o: Order) => o.feDocumento },
      { id: 'feMunicipio', label: 'FE MUNICIPIO', value: (o: Order) => o.feMunicipio },
      { id: 'feDireccion', label: 'FE DIRECCION', value: (o: Order) => o.feDireccion, className: 'text-xs truncate max-w-[150px]' },
      { id: 'feNumeroTelefono', label: 'FE TELEFONO', value: (o: Order) => o.feNumeroTelefono },
      { id: 'feTipoRegimen', label: 'FE TIPO REGIMEN', value: (o: Order) => o.feTipoRegimen, className: 'text-xs' },
      { id: 'feTipoResponsabilidad', label: 'FE TIPO RESP.', value: (o: Order) => o.feTipoResponsabilidad, className: 'text-xs' },
      { id: 'feImpuesto', label: 'FE IMPUESTO', value: (o: Order) => o.feImpuesto },
    ];

    if (filteredOrders.length === 0) return allCols.slice(0, 15);

    return allCols.filter(col => {
      return filteredOrders.some(order => {
        const val = col.value(order);
        if (val === undefined || val === null || val === '') return false;
        if (typeof val === 'string' && (val === '---' || val.trim() === '')) return false;
        if (typeof val === 'number' && val === 0) return false;
        return true;
      });
    });
  }, [filteredOrders]);

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
      return [
        o.fechaReporte || '', o.orderId, o.hora || '', format(o.date, 'yyyy-MM-dd'),
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Gestión de Ingresos</h2>
          <p className="text-[15px] text-slate-500">Visualiza y filtra cada transacción en detalle</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="file" 
            ref={dropiInputRef} 
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'Dropi')} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <input 
            type="file" 
            ref={shopifyInputRef} 
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'Shopify')} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neon/10 text-neon rounded-xl font-bold text-[15px] border border-neon/30 hover:bg-neon/20 transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)]"
          >
            <Plus size={18} /> Nuevo Pedido
          </button>

          <div className="flex bg-card border border-border p-1 rounded-xl">
            <button 
              onClick={() => dropiInputRef.current?.click()}
              disabled={!!isImporting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${isImporting === 'Dropi' ? 'bg-orange-600 text-white' : 'text-orange-400/70 hover:text-orange-400 hover:bg-orange-500/5'}`}
            >
              <FileSpreadsheet size={16} /> {isImporting === 'Dropi' ? 'Importando Dropi...' : 'Importar Dropi'}
            </button>
            <div className="w-px h-8 bg-border self-center mx-1" />
            <button 
              onClick={() => shopifyInputRef.current?.click()}
              disabled={!!isImporting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${isImporting === 'Shopify' ? 'bg-emerald-600 text-white' : 'text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/5'}`}
            >
              <FileSpreadsheet size={16} /> {isImporting === 'Shopify' ? 'Importando Shopify...' : 'Importar Shopify'}
            </button>
          </div>

          {selectedOrderIds.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-[15px] hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
            >
              <Trash2 size={18} /> Borrar ({selectedOrderIds.length})
            </button>
          )}
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded-xl font-bold text-[15px] hover:bg-primary/90 transition-all"
          >
            <Download size={18} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="fintech-card overflow-hidden">
        {/* Filters Bar */}
        <div className="flex flex-col bg-white/5">
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por ID, Cliente o Producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-[15px] text-white focus:outline-none focus:border-primary"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-display text-slate-500 uppercase tracking-widest whitespace-nowrap">Estado:</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-background border border-border rounded-xl py-2 px-3 text-[15px] text-white focus:outline-none focus:border-primary"
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
              <span className="text-[15px] font-display text-slate-500 uppercase tracking-widest whitespace-nowrap">Departamento:</span>
              <input 
                type="text" 
                placeholder="Filtrar..."
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-background border border-border rounded-xl py-2 px-3 text-[15px] text-white focus:outline-none focus:border-primary w-32"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[15px] font-display text-slate-500 uppercase tracking-widest whitespace-nowrap">Ciudad:</span>
              <input 
                type="text" 
                placeholder="Filtrar..."
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="bg-background border border-border rounded-xl py-2 px-3 text-[15px] text-white focus:outline-none focus:border-primary w-32"
              />
            </div>
          </div>

          <div className="p-4 border-b border-border flex flex-wrap items-center gap-6 bg-slate-500/5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 bg-background/40 p-2 rounded-xl border border-border/50 min-w-[200px]">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Clock size={16} />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">F. Solicitado</span>
                  <input 
                    type="date"
                    value={reqDate}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="bg-transparent border-none p-0 text-xs text-white focus:outline-none focus:ring-0 [color-scheme:dark] w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-background/40 p-2 rounded-xl border border-border/50 min-w-[200px]">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <CheckCircle2 size={16} />
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">F. Entregado</span>
                  <input 
                    type="date"
                    value={delDate}
                    onChange={(e) => setDelDate(e.target.value)}
                    className="bg-transparent border-none p-0 text-xs text-white focus:outline-none focus:ring-0 [color-scheme:dark] w-full"
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
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase tracking-wider ml-auto"
            >
              <X size={14} /> Limpiar filtros
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[5000px]">
            <thead>
              <tr className="bg-background/50 text-[15px] uppercase tracking-widest text-slate-500 font-display">
                <th className="p-4 font-bold border-b border-border sticky left-0 z-10 bg-background/50 backdrop-blur-md w-12 text-center">
                  <button 
                    onClick={toggleSelectAll}
                    className="p-1 hover:text-primary transition-colors"
                  >
                    {selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                  </button>
                </th>
                {activeColumns.map(col => (
                  <th key={col.id} className={`p-4 font-bold border-b border-border ${col.className?.includes('text-right') ? 'text-right' : 'text-left'}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[15px] font-mono">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <React.Fragment key={order.id}>
                    <tr 
                      onClick={() => setShowDetailModal(order)}
                      className={`hover:bg-white/5 transition-colors cursor-pointer group ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      <td className="p-4 border-b border-border sticky left-0 z-10 bg-background group-hover:bg-white/5 transition-colors" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => toggleSelectOrder(order.id)}
                          className="p-1 hover:text-primary transition-colors"
                        >
                          {isSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                        </button>
                      </td>
                      {activeColumns.map(col => {
                        const val = col.value(order);
                        const display = col.render ? col.render(order) : (col.isMoney ? formatCurrency(val as number) : String(val || '---'));
                        
                        let cellClassName = `p-4 border-b border-border ${col.className || ''}`;
                        if (col.isProfit) {
                          cellClassName += ` ${val as number > 0 ? 'text-primary' : val as number < 0 ? 'text-red-400' : 'text-slate-500'}`;
                        }

                        return (
                          <td key={col.id} className={cellClassName}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-primary/20 bg-primary/5 font-bold text-[15px]">
              <tr>
                <td className="p-4 sticky left-0 z-10 bg-background/80 backdrop-blur-md"></td>
                {activeColumns.map(col => {
                  if (col.isMoney) {
                    const total = filteredOrders.reduce((sum, order) => sum + Number(col.value(order) || 0), 0);
                    return (
                      <td key={`total-${col.id}`} className={`p-4 text-right ${col.className || ''}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">TOTAL</span>
                          <span className={col.isProfit ? (total > 0 ? 'text-primary' : total < 0 ? 'text-red-400' : 'text-slate-500') : 'text-white'}>
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </td>
                    );
                  }
                  if (col.id === 'orderId') {
                    return (
                      <td key={`total-${col.id}`} className="p-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">PEDIDOS</span>
                          <span className="text-white">{filteredOrders.length}</span>
                        </div>
                      </td>
                    );
                  }
                  return <td key={`total-${col.id}`} className="p-4"></td>;
                })}
              </tr>
            </tfoot>
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
                      <DetailRow label="Fecha" value={format(showDetailModal.date, 'yyyy-MM-dd')} />
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
                    <h4 className="text-xs font-bold text-gold uppercase tracking-[0.2em] mb-4 border-b border-gold/20 pb-2">Logística y Envío</h4>
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
                    <h4 className="text-xs font-bold text-secondary uppercase tracking-[0.2em] mb-4 border-b border-secondary/20 pb-2">Finanzas</h4>
                    <div className="space-y-4">
                      <DetailRow label="Valor Facturado" value={formatCurrency(showDetailModal.valorFacturado || 0)} />
                      <DetailRow label="Compra Productos" value={formatCurrency(showDetailModal.valorCompraProductos || 0)} />
                      <DetailRow label="Ganancia" value={formatCurrency(showDetailModal.gananciaManual || 0)} />
                      <DetailRow label="Flete" value={formatCurrency(showDetailModal.precioFlete || 0)} />
                      <DetailRow label="Comisión" value={formatCurrency(showDetailModal.comision || 0)} />
                      <DetailRow label="Gasto Publicidad" value={formatCurrency(showDetailModal.adsCost || 0)} />
                    </div>
                  </div>
                </div>

                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-border pt-8">
                   {/* Novedades Info */}
                   <div className="space-y-6">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-[0.2em] mb-4 border-b border-red-400/20 pb-2">Novedades e Incidencias</h4>
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
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-[0.2em] mb-4 border-b border-blue-400/20 pb-2">Facturación Electrónica</h4>
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
