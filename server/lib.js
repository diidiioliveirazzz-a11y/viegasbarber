const crypto = require("crypto");

const TZ = "Europe/Lisbon";

const WEEK_SCHEDULE = {
  1: { open: "09:00", close: "19:00", closed: false, label: "Segunda-feira" },
  2: { open: "09:00", close: "20:00", closed: false, label: "Terça-feira" },
  3: { open: "09:00", close: "19:00", closed: false, label: "Quarta-feira" },
  4: { open: "09:00", close: "19:00", closed: false, label: "Quinta-feira" },
  5: { open: "09:00", close: "20:00", closed: false, label: "Sexta-feira" },
  6: { open: "09:00", close: "12:00", closed: false, label: "Sábado" },
  0: { open: null, close: null, closed: true, label: "Domingo" },
};

function getDaySchedule(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { closed: true };
  const [year, month, day] = dateStr.split("-").map(Number);
  // Using noon to avoid timezone shift on date boundaries
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = d.getUTCDay();
  const sched = WEEK_SCHEDULE[dayOfWeek];
  return {
    dayOfWeek,
    label: sched.label,
    closed: sched.closed,
    open: sched.open,
    close: sched.close,
  };
}

function id() {
  return crypto.randomUUID();
}

function normalizeInstagramHandle(value) {
  const handle = String(value || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle) || handle.startsWith(".") || handle.endsWith(".")) {
    return null;
  }
  return handle;
}

function instagramLoginEmail(handle) {
  return `${handle}@instagram.user`;
}

function loyaltyTierForVisits(visits) {
  if (visits >= 25) return "VIP";
  if (visits >= 12) return "Ouro";
  if (visits >= 5) return "Prata";
  return "Bronze";
}

function isNighttimeBlocked(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hourPart = parts.find((p) => p.type === "hour");
  const hour = hourPart ? parseInt(hourPart.value, 10) : now.getHours();
  return hour >= 1 && hour < 8;
}

const NIGHTTIME_BLOCK_MESSAGE =
  "🌙 As marcações estão em pausa durante a madrugada (01:00 às 08:00). A agenda reabre às 08:00 da manhã!";

function todayDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function maxBookableDate(_isVip, now = new Date()) {
  const [year, month, day] = todayDate(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 30)).toISOString().slice(0, 10);
}

function isDateWithinBookingWindow(date, isVip, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const today = todayDate(now);
  return date >= today && date <= maxBookableDate(isVip, now);
}

function bookingWindowMessage() {
  return "A data selecionada está fora do período disponível para marcações.";
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isStaff(user) {
  return user && (user.role === "ADMIN" || user.role === "BARBER");
}

function mediaUrl(value) {
  if (!value) return "";
  if (String(value).startsWith("media:")) return `/api/media/${value.slice(6)}`;
  return value;
}

// -------------------------------------------------------------
// WhatsApp Notification Helpers
// -------------------------------------------------------------

function cleanPhoneNumber(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  // If Portuguese number without country code (starts with 9 and has 9 digits)
  if (digits.length === 9 && digits.startsWith("9")) {
    digits = "351" + digits;
  }
  return digits;
}

function buildWhatsAppLink(phone, message) {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return null;
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

function formatBookingNotification({ clientName, clientPhone, serviceName, date, startTime, isSilent, musicRequest, isDuo, companionName }) {
  const lines = [
    `✂️ *Nova Marcação - Viegas Barber*`,
    ``,
    `👤 *Cliente:* ${clientName || "Cliente"}`,
    clientPhone ? `📞 *Contacto:* ${clientPhone}` : null,
    `💈 *Serviço:* ${serviceName}`,
    `📅 *Data:* ${date}`,
    `⏰ *Horário:* ${startTime}`,
    isDuo ? `👥 *Marcação Duo:* Sim (${companionName || "Acompanhante"})` : null,
    isSilent ? `🤫 *Corte Silencioso:* Sim` : null,
    musicRequest ? `🎵 *Pedido Musical:* "${musicRequest}"` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function formatOrderNotification({ clientName, clientPhone, items, total }) {
  const itemsList = items.map((i) => `• ${i.name} × ${i.quantity} (${(i.price * i.quantity).toFixed(2)}€)`).join("\n");
  const lines = [
    `🛍️ *Nova Reserva na Loja - Viegas Barber*`,
    ``,
    `👤 *Cliente:* ${clientName || "Cliente"}`,
    clientPhone ? `📞 *Contacto:* ${clientPhone}` : null,
    ``,
    `*Produtos reservados:*`,
    itemsList,
    ``,
    `💰 *Total a pagar no balcão:* ${Number(total).toFixed(2)}€`,
  ].filter(Boolean);
  return lines.join("\n");
}

function formatWaitlistNotification({ serviceName, date, timeSlot }) {
  return [
    `⚡ *Viegas Barber - Vaga Disponível!*`,
    ``,
    `Olá! O corte anterior foi cancelado e surgiu uma vaga disponível para hoje:`,
    `💈 *Serviço:* ${serviceName}`,
    `📅 *Data:* ${date}`,
    `⏰ *Horário:* ${timeSlot}`,
    ``,
    `Tens 10 minutos para aceitar no site antes de ser oferecida a outro cliente!`,
  ].join("\n");
}

function formatOrderAcceptedNotification({ orderId, total }) {
  return [
    `🛍️ *Viegas Barber - Encomenda Aceite!*`,
    ``,
    `A tua reserva de produtos foi confirmada e está pronta para levantamento e pagamento no balcão da barbearia.`,
    `💰 *Total:* ${Number(total).toFixed(2)}€`,
    ``,
    `Estamos à tua espera!`,
  ].join("\n");
}

module.exports = {
  WEEK_SCHEDULE,
  getDaySchedule,
  id,
  normalizeInstagramHandle,
  instagramLoginEmail,
  loyaltyTierForVisits,
  isNighttimeBlocked,
  NIGHTTIME_BLOCK_MESSAGE,
  todayDate,
  maxBookableDate,
  isDateWithinBookingWindow,
  bookingWindowMessage,
  timeToMinutes,
  minutesToTime,
  normalizeText,
  isStaff,
  mediaUrl,
  cleanPhoneNumber,
  buildWhatsAppLink,
  formatBookingNotification,
  formatOrderNotification,
  formatWaitlistNotification,
  formatOrderAcceptedNotification,
};
