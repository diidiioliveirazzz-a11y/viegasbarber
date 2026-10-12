// =============================================================
// Viegas Barber - WhatsApp Service Gateway
// Suporta:
// 1) Links diretos Click-to-Chat (wa.me) para envio imediato com 1 clique (100% grátis)
// 2) Envio autónomo em background pelo servidor se configurada uma API de WhatsApp
// =============================================================

const { cleanPhoneNumber, buildWhatsAppLink } = require("./lib");

/**
 * Envia uma mensagem de WhatsApp em segundo plano via API (se configurada no .env)
 * Suporta Evolution API, Z-API, ou qualquer webhook/gateway HTTP padrão.
 */
async function sendWhatsAppMessage(phone, message) {
  const cleaned = cleanPhoneNumber(phone);
  if (!cleaned) return { success: false, reason: "Número de telemóvel inválido" };

  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

  if (!apiUrl) {
    // Modo Click-to-Chat (Sem API externa configurada)
    return {
      success: true,
      mode: "click_to_chat",
      url: buildWhatsAppLink(cleaned, message),
    };
  }

  try {
    const payload = {
      number: cleaned,
      phone: cleaned,
      message,
      text: message,
    };

    const headers = {
      "Content-Type": "application/json",
    };
    if (apiToken) {
      headers["apikey"] = apiToken;
      headers["Authorization"] = `Bearer ${apiToken}`;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    return { success: response.ok, mode: "api", data };
  } catch (error) {
    console.error("[WhatsApp] Erro ao enviar mensagem automática:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendWhatsAppMessage,
};
