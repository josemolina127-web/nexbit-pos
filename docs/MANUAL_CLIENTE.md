# Next Byte — Manual del Cliente

Punto de venta moderno para Windows. Este manual cubre la instalación, la activación de tu licencia y los requisitos para usar el sistema (una o varias cajas).

---

## 1. Requisitos del sistema

| Requisito | Mínimo |
|---|---|
| Sistema operativo | Windows 10 u 11 (64 bits) |
| Memoria RAM | 4 GB |
| Disco libre | 500 MB |
| Conexión | Internet solo para instalar/actualizar la aplicación |

**Impresora de boletas, lector de código de barras, balanza y cajón de dinero** se conectan por USB o serie (configurables desde la app).

---

## 2. Instalación

1. Descarga el instalador desde el enlace que recibiste en tu correo.
2. Ejecuta `Next Byte Setup.exe`.
3. Sigue los pasos del asistente (puedes elegir la carpeta de instalación).
4. Al terminar, la aplicación se abre automáticamente.

> Si Windows muestra una advertencia de "Editor desconocido": es porque el instalador no tiene un certificado de firma digital pago. Acepta la advertencia (Más información → Ejecutar de todas formas). Es normal en esta etapa del producto.

**Versión portable (sin instalar):** puedes usar `Next Byte Portable.exe` desde un pendrive; la información se guarda en el equipo donde se ejecuta.

---

## 3. Activación de la licencia

La primera vez que abras la aplicación, aparecerá la pantalla de activación:

1. Ingresa el **código de licencia** que recibiste en tu correo (formato: `....` largo con puntos).
2. Pulsa **Activar**.
3. La aplicación verificará el código y mostrará tu plan y vigencia.

El código queda **vinculado a este equipo** (se valida contra un identificador único del hardware). Si cambias de equipo, solicita una re-activación a tu proveedor.

**Cambiar de licencia (renovar o subir de plan):** en *Configuración → Licencia del Sistema* puedes pegar el nuevo código que recibas y aplicar la renovación/upgrade.

---

## 4. Planes

| Plan | Cajas | Usuarios | Funciones premium |
|---|---|---|---|
| **Básica** | 1 | 1 | — |
| **Pro** | 1 | 2 | Ventas con facturación SII, promociones y cupones, auditoría |
| **Multi-Cajas** | 4 | 4 | Todo lo de Pro |

Los planes pueden ser **anuales** o **de por vida**. Al vencer la vigencia, la aplicación te lo indicará y dejará de operar hasta renovar.

---

## 5. Uso diario

1. Inicia sesión con tu usuario y contraseña.
2. Elige la caja (si tu plan tiene más de una).
3. **Abrir caja** (monto inicial) → vender → **cerrar caja** al final del día con el cuadre de caja.

Las secciones principales: Punto de Venta, Inventario, Clientes, Proveedores, Ventas (historial), Devoluciones, Reportes, Usuarios, Configuración.

---

## 6. Respaldo de la información (IMPORTANTE)

Toda tu información (ventas, productos, clientes) vive en un archivo de base de datos en el equipo donde instalas la aplicación.

### Con el plan Pro (recomendado)

En **Configuración → Respaldo de Base de Datos** encontrarás el botón **"Respaldar base de datos"**:

1. Haz clic en el botón.
2. Elige dónde guardar la copia (carpeta local, disco duro externo o pendrive).
3. Listo: la aplicación crea una copia completa y segura de toda tu información.

**Recomendación: realiza un respaldo diario**, idealmente al cerrar el local. Guarda la copia en un disco externo o pendrive (no en el mismo equipo), y conserva al menos los últimos 7 días de respaldo.

Si el disco del equipo falla y no hay respaldo, la información **se pierde**.

### En el plan Básica (manual)

- Cierra la aplicación y copia el archivo `nexbit.db` a un pendrive, disco externo o la nube.
- Ruta habitual: `C:\Users\TU_USUARIO\AppData\Roaming\nexbit-pos\nexbit.db`
- Conserva al menos los últimos 7 días de respaldo.

---

## 7. Multi-Cajas (plan de 4 cajas)

### Cómo funciona

Una sola base de datos compartida en la red local. Un equipo hace de **servidor** y las demás cajas se conectan a ella. Así todas las cajas ven los mismos productos, stock y ventas al instante.

### Requisitos obligatorios

| Requisito | Detalle |
|---|---|
| **Red cableada (Ethernet)** | Cada caja debe conectarse con cable de red. NO funciona de forma confiable por WiFi. |
| **PC servidor siempre encendido** | Mientras haya una caja operando, el servidor debe estar encendido. Si se apaga, las cajas no pueden vender. |
| **Carpeta compartida** | En el servidor se comparte una carpeta en la red local con permisos de lectura/escritura para las cajas. |
| **Máximo 4 cajas** | El plan permite hasta 4 cajas conectadas a la vez. |
| **Red local cerrada** | La carpeta compartida no debe ser accesible desde internet. |

### Pautas de uso

- Todos los equipos dentro del mismo router/red local.
- El router puede funcionar **sin internet** (solo se necesita internet para actualizar la aplicación).
- Cierra todos los equipos de forma ordenada al final del día (con el botón "Salir" de la aplicación).
- **El respaldo diario se hace en el PC servidor** (ahí vive la base de datos compartida).

---

## 8. Actualizaciones

La aplicación se actualiza sola: al abrirla, si hay una versión nueva la descarga y se instala al cerrar. Mantén el equipo encendido unos minutos al cerrar para que termine de instalar.

---

## 9. Soporte

Ante dudas o problemas: contacta a tu proveedor indicando el código de licencia y el nombre del equipo.
