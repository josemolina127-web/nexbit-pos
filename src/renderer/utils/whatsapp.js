// Numero y mensaje de WhatsApp del proveedor (un solo lugar de verdad)
export const WHATSAPP_NUM = '56923796187'; // +56 9 2379 6187
export const WHATSAPP_MSG = 'Hola, necesito una licencia para la app Next Byte';
export const WHATSAPP_MSG_PRO = 'Hola, quiero subir mi plan a Pro';
export const WHATSAPP_MSG_CAJAS = 'Hola, necesito más cajas para mi plan';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(WHATSAPP_MSG)}`;
export const WHATSAPP_URL_PRO = `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(WHATSAPP_MSG_PRO)}`;
export const WHATSAPP_URL_CAJAS = `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(WHATSAPP_MSG_CAJAS)}`;