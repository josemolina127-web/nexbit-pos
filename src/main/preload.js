const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexbit', {
  // License
  getLicenseStatus: () => ipcRenderer.invoke('license:getStatus'),
  activateLicense: (code) => ipcRenderer.invoke('license:activate', code),

  // Auth
  login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  createUser: (data) => ipcRenderer.invoke('auth:createUser', data),
  updateUser: (id, data) => ipcRenderer.invoke('auth:updateUser', id, data),
  getUsers: () => ipcRenderer.invoke('auth:getUsers'),
  getUserPermissions: () => ipcRenderer.invoke('auth:getUserPermissions'),
  getUserPermissionsByUser: (id) => ipcRenderer.invoke('auth:getUserPermissionsByUser', id),

  // Products
  getProducts: (filters) => ipcRenderer.invoke('products:getAll', filters),
  getProduct: (id) => ipcRenderer.invoke('products:get', id),
  createProduct: (data) => ipcRenderer.invoke('products:create', data),
  updateProduct: (id, data) => ipcRenderer.invoke('products:update', id, data),
  deleteProduct: (id) => ipcRenderer.invoke('products:delete', id),
  importProducts: (data) => ipcRenderer.invoke('products:import', data),
  searchProducts: (query) => ipcRenderer.invoke('products:search', query),
  getCategories: () => ipcRenderer.invoke('products:getCategories'),
  createCategory: (name) => ipcRenderer.invoke('products:createCategory', name),
  updateCategory: (id, name) => ipcRenderer.invoke('products:updateCategory', id, name),
  deleteCategory: (id) => ipcRenderer.invoke('products:deleteCategory', id),

  // Providers
  getProviders: () => ipcRenderer.invoke('proveedores:getAll'),
  getProvider: (id) => ipcRenderer.invoke('proveedores:get', id),
  createProvider: (data) => ipcRenderer.invoke('proveedores:create', data),
  updateProvider: (id, data) => ipcRenderer.invoke('proveedores:update', id, data),
  deleteProvider: (id) => ipcRenderer.invoke('proveedores:delete', id),

  // Inventory
  getStockAlerts: () => ipcRenderer.invoke('inventory:getStockAlerts'),
  adjustStock: (data) => ipcRenderer.invoke('inventory:adjustStock', data),
  receiveInventory: (data) => ipcRenderer.invoke('inventory:receive', data),
  getReceiveDocuments: () => ipcRenderer.invoke('inventory:getReceiveDocuments'),
  updateReceiveDocument: (id, data) => ipcRenderer.invoke('inventory:updateReceiveDocument', id, data),
  deleteReceiveDocument: (id) => ipcRenderer.invoke('inventory:deleteReceiveDocument', id),
  updateReceiveDocumentItem: (docId, productId, data) => ipcRenderer.invoke('inventory:updateReceiveDocumentItem', docId, productId, data),
  deleteReceiveDocumentItem: (docId, productId) => ipcRenderer.invoke('inventory:deleteReceiveDocumentItem', docId, productId),
  getInventoryMovements: (filters) => ipcRenderer.invoke('inventory:getMovements', filters),
  getInventoryDashboard: (filters) => ipcRenderer.invoke('inventory:dashboard', filters),
  updateMovement: (data) => ipcRenderer.invoke('inventory:updateMovement', data),
  deleteMovement: (id) => ipcRenderer.invoke('inventory:deleteMovement', id),

  // Sales
  createSale: (data) => ipcRenderer.invoke('sales:create', data),
  getSales: (filters) => ipcRenderer.invoke('sales:getAll', filters),
  getSale: (id) => ipcRenderer.invoke('sales:get', id),
  voidSale: (id, reason) => ipcRenderer.invoke('sales:void', id, reason),
  getTodaySales: () => ipcRenderer.invoke('sales:getToday'),
  getSalesSummary: (filters) => ipcRenderer.invoke('sales:getSummary', filters),

  // Clients
  getClients: (filters) => ipcRenderer.invoke('clients:getAll', filters),
  getClient: (id) => ipcRenderer.invoke('clients:get', id),
  createClient: (data) => ipcRenderer.invoke('clients:create', data),
  updateClient: (id, data) => ipcRenderer.invoke('clients:update', id, data),
  searchClients: (query) => ipcRenderer.invoke('clients:search', query),
  getClientDebt: (id) => ipcRenderer.invoke('clients:getDebt', id),
  registerPayment: (data) => ipcRenderer.invoke('clients:registerPayment', data),

  // Cash Register
  openCashRegister: (data) => ipcRenderer.invoke('caja:open', data),
  closeCashRegister: (data) => ipcRenderer.invoke('caja:close', data),
  getCashRegisterStatus: (filters) => ipcRenderer.invoke('caja:status', filters),
  getCashRegisterHistory: (filters) => ipcRenderer.invoke('caja:history', filters),
  getCajaStatus: (cajaId) => ipcRenderer.invoke('cajas:getStatus', cajaId),

  // Multi-Cajas
  getCajas: () => ipcRenderer.invoke('cajas:list'),
  createCaja: (data) => ipcRenderer.invoke('cajas:create', data),
  updateCaja: (data) => ipcRenderer.invoke('cajas:update', data),
  deleteCaja: (id) => ipcRenderer.invoke('cajas:delete', id),
  getCajaMetrics: () => ipcRenderer.invoke('cajas:metrics'),

  // Sessions
  startSession: (data) => ipcRenderer.invoke('sesiones:start', data),
  endSession: (data) => ipcRenderer.invoke('sesiones:end', data),
  endSessionByUser: (data) => ipcRenderer.invoke('sesiones:endByUser', data),
  getAvailableCajas: () => ipcRenderer.invoke('sesiones:getAvailable'),
  getActiveSession: (cajaId) => ipcRenderer.invoke('sesiones:getActive', cajaId),
  getCurrentSession: () => ipcRenderer.invoke('sesiones:getCurrent'),
  getAllActiveSessions: () => ipcRenderer.invoke('sesiones:allActive'),
  getAllCajasWithStatus: () => ipcRenderer.invoke('cajas:getAllWithStatus'),
  joinCajaSession: (data) => ipcRenderer.invoke('sesiones:join', data),

  // Version
  getVersion: () => ipcRenderer.invoke('config:getVersion'),
  setVersion: (v) => ipcRenderer.invoke('config:setVersion', v),
  getMaxCajas: () => ipcRenderer.invoke('config:getMaxCajas'),

  // Reports
  getDailyReport: (date) => ipcRenderer.invoke('reports:daily', date),
  getTopProducts: (filters) => ipcRenderer.invoke('reports:topProducts', filters),
  getProfitReport: (filters) => ipcRenderer.invoke('reports:profit', filters),
  getAuditLog: (filters) => ipcRenderer.invoke('reports:auditLog', filters),

  // Returns
  createReturn: (data) => ipcRenderer.invoke('returns:create', data),
  getReturns: (filters) => ipcRenderer.invoke('returns:getAll', filters),
  getReturn: (id) => ipcRenderer.invoke('returns:get', id),

  // Printer
  printTicket: (data) => ipcRenderer.invoke('printer:printTicket', data),
  getPrinters: () => ipcRenderer.invoke('printer:getPrinters'),

  // Scale
  readScale: () => ipcRenderer.invoke('scale:read'),
  configureScale: (config) => ipcRenderer.invoke('scale:configure', config),
  getScaleConfig: () => ipcRenderer.invoke('scale:getConfig'),

  // Printer
  getPrinterConfig: () => ipcRenderer.invoke('printer:getConfig'),
  setPrinterConfig: (config) => ipcRenderer.invoke('printer:setConfig', config),

  // SII / DTE
  getSiiConfig: () => ipcRenderer.invoke('sii:getConfig'),
  setSiiConfig: (config) => ipcRenderer.invoke('sii:setConfig', config),

  // Backup
  backupDatabase: () => ipcRenderer.invoke('backup:create'),

  // App
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),

  // Boletas emitidas
  getBoletasEmitidas: () => ipcRenderer.invoke('boletas:getAll'),
  registerBoletaEmitida: (data) => ipcRenderer.invoke('boletas:register', data),

  // Promociones y Cupones
  getCupones: () => ipcRenderer.invoke('cupones:getAll'),
  createCupon: (data) => ipcRenderer.invoke('cupones:create', data),
  updateCupon: (data) => ipcRenderer.invoke('cupones:update', data),
  deleteCupon: (id) => ipcRenderer.invoke('cupones:delete', id),
  usarCupon: (codigo) => ipcRenderer.invoke('cupones:usar', codigo),

  getDescuentosCantidad: () => ipcRenderer.invoke('descuentos:getAll'),
  createDescuentoCantidad: (data) => ipcRenderer.invoke('descuentos:create', data),
  updateDescuentoCantidad: (data) => ipcRenderer.invoke('descuentos:update', data),
  deleteDescuentoCantidad: (id) => ipcRenderer.invoke('descuentos:delete', id),
  getDescuentoPorProducto: (productoId) => ipcRenderer.invoke('descuentos:getByProducto', productoId),

  getPromoted: () => ipcRenderer.invoke('products:getPromoted'),
  setPromotion: (data) => ipcRenderer.invoke('products:setPromotion', data),

  getGrupos: () => ipcRenderer.invoke('grupos:getAll'),
  createGrupo: (data) => ipcRenderer.invoke('grupos:create', data),
  updateGrupo: (data) => ipcRenderer.invoke('grupos:update', data),
  deleteGrupo: (id) => ipcRenderer.invoke('grupos:delete', id),
});
