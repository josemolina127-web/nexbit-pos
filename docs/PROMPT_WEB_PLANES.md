# Prompt: Página web de Next Byte (planes y venta)

Copia y pega el siguiente prompt en la herramienta de IA que prefieras (ChatGPT, Claude, Gemini, etc.).

---

## Prompt

Crea una landing page moderna en español para **Next Byte**, un punto de venta (POS) para Windows. El propósito es presentar el producto, mostrar los planes y permitir comprar con pago en línea (WooCommerce + Flow). La página debe ser profesional, rápida y enfocada 100% a conversión (comprar).

### Tecnología
- HTML, CSS y JavaScript puro en un solo archivo `index.html` (o React + Vite si prefieres, pero sin framework pesado). Sin dependencias externas. Todo el estilo inline en el archivo.
- Diseño **dark mode** como base (fondo oscuro #050505), acento **naranja #FF4B00** (color de marca de la app), tipografía Inter. Estética similar a la app: limpia, con bordes redondeados (12px), sombras suaves, cards.
- Sin frameworks UI; CSS propio.

### Estructura y secciones (todas en español)
1. **Navbar** fija: logo "Next Byte" + enlaces: Inicio, Características, Planes, Preguntas frecuentes, Contacto + botón CTA "Comprar ahora".
2. **Hero**: título potente ("El punto de venta que tu negocio necesita"), subtítulo de una línea, botón CTA principal "Ver planes" y uno secundario "Ver manual de usuario". Fondo oscuro con acento naranja. Mencionar la frase "¡Prueba gratis? No, pago único!". Simplificar: frases de valor reales del producto.
3. **Características** (6 features en grid 3x2), extraídas exactamente de estas funcionalidades del producto:
   - Punto de venta rápido (ventas, productos, inventario, clientes, proveedores en una sola pantalla)
   - Facturación SII (facturas para SII) — solo planes Pro y Multi
   - Promociones y cupones de descuento
   - Auditoría completa de ventas: quién, cuándo, qué cantidad
   - Cajas múltiples en red local (hasta 4 equipos comparten la misma base de datos al instante) — solo plan MultiCajas
   - Corte de caja diario con monto inicial, cuadre de caja y trazabilidad
   - Respaldo de base de datos con un botón (plan Pro+)
   - Usuarios con permisos y roles (admin, gerente, vendedor) — plan Pro+
   - Actualizaciones automáticas vía internet
4. **Planes** (6 tarjetas en grid, precio grande, botón **"Agregar al carrito"** en cada una). Cada plan tiene 2 variantes: **Anual** y **De por vida**. Precios exactos en **CLP** (pesos chilenos), con los **IDs de WooCommerce ya asignados**:

   | Producto | Precio | ID WooCommerce |
   |---|---|---|
   | Básica — Anual | $120.000 | 26 |
   | Básica — De por vida | $140.000 | 27 |
   | Pro — Anual | $160.000 | 28 |
   | Pro — De por vida | $180.000 | 29 |
   | Multi-Cajas + Pro — Anual | $250.000 | 30 |
   | Multi-Cajas + Pro — De por vida | $300.000 | 31 |

   - Agrupar visualmente en 3 columnas (Básica, Pro, Multi-Cajas) y dentro de cada columna 2 tarjetas (Anual / De por vida), marcando las 3 de por vida con un badge "MEJOR VALOR" y en naranja.
   - **Los botones "Agregar al carrito" deben apuntar a un enlace WooCommerce `?add-to-cart=`** (agrega el producto al carrito sin pasar por la página del producto).
   - Deja en el JS las constantes: `URL_WOO` y los IDs (26, 27, 28, 29, 30, 31).
   - Debajo de cada card agregar la nota: "Activa de inmediato por correo. Incluye instalador y código de licencia."

   **Lista de características detallada por plan** (usar exactamente esto en cada tarjeta):

   - **Básica — Anual (id 26)** y **Básica — De por vida (id 27)**:
     - 1 caja (1 equipo) y 1 usuario
     - Punto de venta: venta rápida con boleta térmica
     - Inventario con alertas de stock bajo
     - Registro de clientes y proveedores
     - Historial de ventas y devoluciones
     - Corte de caja diario
     - Respaldo manual de base de datos (copiar archivo `nexbit.db`)
     - Actualizaciones automáticas
     - Soporte por correo

   - **Pro — Anual (id 28)** y **Pro — De por vida (id 29)** (badge "MEJOR VALOR"): todo lo de Básica, más:
     - 2 usuarios con roles y permisos (admin, gerente, vendedor)
     - Facturación SII (facturas electrónicas)
     - Promociones, cupones y descuentos
     - Auditoría completa: quién vendió, cuándo y cuánto
     - Botón de respaldo de base de datos con un clic
     - Reportes avanzados de ventas y métricas
     - Soporte prioritario por correo

   - **Multi-Cajas + Pro — Anual (id 30)** y **Multi-Cajas + Pro — De por vida (id 31)** (sello "PARA NEGOCIOS CON VARIAS CAJAS"): todo lo de Pro, más:
     - 4 cajas en red local (todas ven la misma base de datos al instante)
     - 4 usuarios simultáneos
     - Configuración guiada de PC servidor con un botón (comparte la carpeta en la red automáticamente)
     - Conexión de cajas con una ruta compartida (copiar y pegar)
     - Validación de escritura en la base de datos compartida
     - Recomendado para locales con más de un cajero o mostrador
     - Soporte prioritario + asistencia por teléfono
5. **Cómo funciona / Venta**: 3 pasos — (1) compra 1 licencia (agrega al carrito y paga con Flujo), (2) te enviamos por correo el instalador y tu código de licencia, (3) activas en tu PC y listo.
6. **Preguntas frecuentes** (acordeón o detalles hijos, mínimo 6):
   - ¿Necesito internet? (solo para instalar/actualizar; la app funciona offline)
   - ¿Es en la nube? (no, local en tu PC)
   - ¿Puedo probarla? (sí, hay versión demo instalable en modo prueba)
   - ¿Qué pasa si mi licencia expira? (se le avisa; renuevas y sigue, la data queda intacta)
   - ¿Cuántas cajas soporta el plan Multi? (4)
   - ¿Cómo hago respaldo? (pro: botón en la app; básico: copiar archivo)
7. **Footer**: copyright año actual, licencia/privacidad ficticia, contacto `contacto@tudominio.cl`.
8. **Barra de compra fija** (sticky CTA) que aparece al hacer scroll: botón "Comprar plan Pro".

### Requisitos técnicos
- Las secciones con IDs para arrancar anclas.
- Un script código JS con constantes al inicio del archivo: `URL_WOO`, los 6 IDs de producto de WooCommerce y el año; para que cambiar precios/enlaces no toque el HTML.
- Animaciones ligeras (fade-in on scroll mediante IntersectionObserver) y hover en cards.
- El botón "Descargar manual" debe enlazar a `docs/manual-cliente.pdf` (carpeta relativa al sitio).
- SEO: `<meta>`s, Open Graph, favicon y eslogan.
- Idioma 100% español, sin inglés visible.

### Entregable
Código completo de la landing page en 3 archivos: `index.html`, `styles.css`, `script.js`, con comentarios en español en cada sección. Y un corto README.md explicando cómo abrir (`open index.html`) y cómo conectar después la URL de compra de Flow cuando exista.

---

### Notas
- Precios finales en CLP incorporados (6 productos). `URL_WOO_URL` y los `ID_*` quedarán vacíos hasta que existan los productos en WooCommerce — en WooCommerce el ID de cada producto se ve en la URL de edición (por ejemplo `...wp-admin/post.php?post=123` → ID `123`).
- Los botones "Agregar al carrito" usan el patrón nativo de WooCommerce `?add-to-cart={id}`: agrega directo al carrito sin salir de la página. Alternativamente `?add-to-cart={id}&quantity=1`.
- El PDF del manual vive en `docs/web/MANUAL_CLIENTE.pdf` de la app; el link de la página debe apuntar ahí.