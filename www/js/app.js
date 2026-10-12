const VB = (() => {
  let user = null;
  let theme = localStorage.getItem("vb-theme") || "dark";

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || "Pedido falhou");
    return data;
  }

  function applyTheme() {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("vb-theme", theme);
  }

  function getLocalDateStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function shiftDateStr(dateStr, offsetDays) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return getLocalDateStr();
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + offsetDays, 12, 0, 0);
    return getLocalDateStr(dt);
  }

  function navHtml(page) {
    const first = user?.name ? user.name.split(" ")[0] : "";
    const staff = user && (user.role === "ADMIN" || user.role === "BARBER");
    return `
      <header class="navbar ${staff ? "has-admin-bar" : ""}">
        ${staff ? `
          <div class="admin-top-bar">
            <div class="admin-top-bar-inner">
              <div class="admin-top-bar-left">
                <span class="admin-role-pill">💈 MODO BARBEIRO</span>
                <span class="admin-user-info">Sessão iniciada como <strong>${user.name}</strong></span>
              </div>
              <div class="admin-top-bar-right">
                <a class="admin-panel-btn" href="/dashboard">⚙️ Aceder à Dashboard / Agenda</a>
                <button class="admin-logout-btn" data-logout title="Terminar sessão">Sair</button>
              </div>
            </div>
          </div>` : ""}
        <div class="navbar-accent-line"></div>
        <div class="nav-inner">
          <a class="logo" href="/" title="Viegas Barber">
            <img src="/img/logo.png" alt="Viegas Barber" class="logo-img" onerror="this.style.display='none';">
            <span class="logo-text"><span>VIEGAS</span><span class="dot">.</span><span class="badge">Barber</span></span>
          </a>
          <nav class="nav-links">
            <a href="/diogo">O Diogo</a>
            <a href="/#servicos">Serviços</a>
            <a href="/galeria">Galeria</a>
            <a href="/loja">Loja</a>
            <a href="/fidelizacao">Fidelização</a>
            ${!staff && user ? `<a href="/minhas-marcacoes">As Minhas Marcações</a>` : ""}
          </nav>
          <div class="nav-right">
            <button class="icon-btn" data-theme title="Tema">${theme === "dark" ? "☀️" : "🌙"}</button>
            <span class="bell" id="bell-wrap"><button class="icon-btn" data-bell title="Notificações" aria-label="Notificações"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;pointer-events:none"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></button></span>
            ${!staff && user ? `<span class="muted" style="white-space:nowrap">Olá, <strong>${first}</strong></span><button class="icon-btn" data-logout title="Sair">Sair</button>` : ""}
            ${!user ? `<a href="/login" style="font-weight:700;font-size:.85rem">Entrar</a>` : ""}
            <a class="brand-button btn" href="/marcar">MARCAR AGORA</a>
          </div>
          <div class="nav-mobile">
            <a class="brand-button btn btn-marcar-mob" href="/marcar">MARCAR</a>
            <span class="bell" id="bell-wrap-mobile"><button class="icon-btn" data-bell title="Notificações" aria-label="Notificações"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;pointer-events:none"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></button></span>
            <button class="icon-btn" data-menu aria-label="Menu">☰</button>
          </div>
        </div>
        <div class="mobile-drawer" id="drawer">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.85rem;background:rgba(255,255,255,0.04);border:1px solid var(--card-border);border-radius:0.75rem;margin-bottom:0.8rem">
            <span style="font-size:0.82rem;font-weight:700">Modo de Ecrã</span>
            <button class="btn btn-ghost" data-theme style="padding:0.35rem 0.75rem;font-size:0.78rem;border-radius:0.6rem">
              ${theme === "dark" ? "☀️ Modo Claro" : "🌙 Modo Escuro"}
            </button>
          </div>
          ${staff ? `<a class="admin-panel-btn" href="/dashboard" style="display:flex;justify-content:center;margin-bottom:.8rem;padding:.75rem">⚙️ Ir para Dashboard do Barbeiro</a>` : ""}
          ${user ? `<div style="padding:.5rem .7rem;font-size:.85rem;color:var(--muted)">Olá, <strong>${first}</strong></div>` : ""}
          <a href="/diogo">💈 O Diogo Viegas</a>
          <a href="/#servicos">✂️ Serviços & Preços</a>
          <a href="/galeria">🖼️ Galeria de Trabalhos</a>
          <a href="/loja">🛒 Loja de Produtos</a>
          <a href="/fidelizacao">🎁 Cartão de Fidelização</a>
          ${user ? `<a href="/minhas-marcacoes">📅 As Minhas Marcações</a>` : ""}
          <a href="javascript:void(0)" data-bell style="display:flex;align-items:center;justify-content:space-between"><span>🔔 Notificações & Alertas</span><span class="count-drawer" style="display:none"></span></a>
          <div class="drawer-pwa-box" id="drawer-pwa-box">
            <button id="drawer-btn-enable" class="brand-button btn" style="width:100%;font-size:0.82rem;padding:0.7rem;border-radius:0.75rem;display:flex;align-items:center;justify-content:center;gap:0.5rem">
              <span>🔔</span> <strong>Ativar Notificações no Telemóvel</strong>
            </button>
          </div>
          ${user ? `<button class="btn-ghost btn" style="width:100%;margin-top:.6rem" data-logout>Terminar Sessão</button>` : `<a class="btn-ghost btn" style="width:100%;margin-top:.6rem;text-align:center" href="/login">Iniciar Sessão / Criar Conta</a>`}
        </div>
      </header>`;
  }

  function footerHtml(settings = {}) {
    const addr = settings.address || "Centro comercial São Julião, Setúbal";
    const phone = settings.phone || "+351 939 504 261";
    return `
      <footer class="footer">
        <div class="wrap footer-grid">
          <div><h3>VIEGAS<span style="color:var(--accent)">.</span>BARBER</h3><p>Barbearia contemporânea e de alta precisão em Setúbal.</p></div>
          <div><h4>Localização</h4><p>${addr}</p><p>Setúbal, Portugal</p></div>
          <div>
            <h4>Horário de Funcionamento</h4>
            <p>Segunda, Quarta, Quinta: 09:00 — 19:00</p>
            <p>Terça e Sexta: 09:00 — 20:00</p>
            <p>Sábado: 09:00 — 12:00</p>
            <p style="color:var(--accent);font-weight:700">Domingo: Encerrado</p>
          </div>
          <div><h4>Contacto & WhatsApp</h4><p>${phone}</p><p style="color:var(--accent);font-weight:700"><a href="https://instagram.com/v_barber8" target="_blank" rel="noopener" style="color:inherit">Instagram: @v_barber8</a></p></div>
        </div>
        <div class="wrap" style="border-top:1px solid var(--card-border);padding-top:1.5rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap">
          <p>© ${new Date().getFullYear()} Viegas Barber. Todos os direitos reservados.</p>
          <p>Barbeiro Exclusivo: Diogo Viegas · Setúbal</p>
        </div>
      </footer>
      <div class="assistant" id="assistant"></div>`;
  }

  function bindChrome() {
    document.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.onclick = () => {
        theme = theme === "dark" ? "light" : "dark";
        applyTheme();
        const page = document.body.dataset.page;
        boot(page);
      };
    });
    document.querySelectorAll("[data-menu]").forEach((btn) => {
      btn.onclick = () => {
        const drawer = document.getElementById("drawer");
        if (drawer) {
          drawer.classList.toggle("open");
          updateNotificationUI();
        }
      };
    });
    document.querySelectorAll("[data-logout]").forEach((btn) => {
      btn.onclick = async () => {
        await api("/api/auth/logout", { method: "POST" });
        location.href = "/";
      };
    });
    document.querySelectorAll("[data-bell]").forEach((btn) => {
      btn.onclick = toggleBell;
    });
    mountAssistant();
    updateNotificationUI();
  }

  function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function isStandalonePWA() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function getNotificationPermission() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  }

  function showNotificationToast(msg, isSuccess = true) {
    let toast = document.getElementById("vb-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "vb-toast";
      toast.style.cssText =
        "position:fixed;top:1.2rem;left:50%;transform:translateX(-50%);z-index:99999;padding:0.75rem 1.3rem;border-radius:0.85rem;font-size:0.82rem;font-weight:700;box-shadow:0 12px 30px rgba(0,0,0,0.6);transition:opacity 0.3s ease,transform 0.3s ease;pointer-events:none;text-align:center;max-width:92vw;";
      document.body.appendChild(toast);
    }
    toast.style.background = isSuccess ? "#15803d" : "#b91c1c";
    toast.style.color = "#ffffff";
    toast.textContent = msg;
    toast.style.opacity = "1";
    setTimeout(() => {
      if (toast) toast.style.opacity = "0";
    }, 4000);
  }

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch {}
  }

  function showSystemNotification(title, message, url) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body: message,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            vibrate: [200, 100, 200],
            data: { url: url || "/" },
          });
        });
      } else {
        new Notification(title, {
          body: message,
          icon: "/icon-192.png",
        });
      }
    } catch {}
  }

  function triggerTestNotification() {
    showNotificationToast("🔔 Enviada notificação de teste!");
    showSystemNotification(
      "Viegas Barber 💈",
      "As notificações no teu telemóvel estão ativas! Vais receber avisos de cortes, confirmações e vagas."
    );
    playNotificationSound();
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function registerWebPushSubscription() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const reg = await navigator.serviceWorker.ready;
      if (!reg || !reg.pushManager) return;

      const res = await fetch("/api/push/vapid-public-key");
      if (!res.ok) return;
      const { publicKey } = await res.json();
      if (!publicKey) return;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
    } catch (err) {
      console.warn("Registo de Push Subscription:", err);
    }
  }

  async function requestPushPermission() {
    const isIOS = isIOSDevice();
    const isStandalone = isStandalonePWA();

    // Caso iOS Safari fora de PWA standalone
    if (isIOS && !isStandalone && !("Notification" in window)) {
      alert(
        "📱 Para ativar notificações no iPhone (iOS):\n\n" +
        "1. Toca no botão Partilhar (ícone com quadrado e seta ⎋ na barra inferior do Safari).\n" +
        "2. Seleciona 'Adicionar ao Ecrã Principal' (+).\n" +
        "3. Abre a aplicação a partir do novo ícone no teu ecrã inicial para receberes todos os alertas de cortes e vagas!"
      );
      return;
    }

    if (!("Notification" in window)) {
      alert("O teu navegador não suporta notificações de sistema.");
      return;
    }

    if (Notification.permission === "denied") {
      alert(
        "⚠️ As notificações estão bloqueadas nas definições do teu telemóvel/navegador.\n\n" +
        "Para ativar:\n" +
        "• No Chrome/Android: Clica no cadeado/ícone ao lado do link do site > Definições do site > Notificações > Permitir.\n" +
        "• No iPhone: Abre Definições do iOS > Notificações > Viegas Barber > Ativar Notificações."
      );
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        showNotificationToast("🔔 Notificações ativadas com sucesso!");
        showSystemNotification(
          "Notificações Ativadas! 💈",
          "Receberás avisos de novos cortes, vagas de última hora e lembretes da Viegas Barber."
        );
        playNotificationSound();
        dismissFloatingBanner(true);
        updateNotificationUI();
        await registerWebPushSubscription();
      } else if (perm === "denied") {
        updateNotificationUI();
        alert("Notificações recusadas. Podes alterar mais tarde nas definições do teu telefone.");
      }
    } catch (err) {
      console.error("Erro ao pedir permissão de notificações:", err);
    }
  }

  function dismissFloatingBanner(permanent = false) {
    const banner = document.getElementById("pwa-notif-floating-banner");
    if (banner) banner.remove();
    if (permanent) {
      localStorage.setItem("vb-notif-banner-dismissed", "permanent");
    } else {
      localStorage.setItem("vb-notif-banner-dismissed", String(Date.now()));
    }
  }

  function checkFloatingBanner() {
    const perm = getNotificationPermission();
    const existing = document.getElementById("pwa-notif-floating-banner");

    if (perm === "granted" || perm === "unsupported") {
      if (existing) existing.remove();
      return;
    }

    const dismissed = localStorage.getItem("vb-notif-banner-dismissed");
    if (dismissed === "permanent") return;
    if (dismissed) {
      const past = parseInt(dismissed, 10);
      if (!isNaN(past) && Date.now() - past < 24 * 60 * 60 * 1000) {
        return;
      }
    }

    if (existing) return;

    const banner = document.createElement("div");
    banner.id = "pwa-notif-floating-banner";
    banner.className = "pwa-floating-banner";
    banner.innerHTML = `
      <div class="banner-head">
        <div class="banner-icon-title">
          <span class="banner-icon">🔔</span>
          <div>
            <div class="banner-title">Ativar notificações no telemóvel?</div>
            <p class="banner-text">Recebe lembretes de corte e avisos imediatos quando abrirem novas vagas.</p>
          </div>
        </div>
      </div>
      <div class="banner-actions">
        <button id="pwa-banner-dismiss-btn" class="btn btn-ghost banner-btn-dismiss">Agora não</button>
        <button id="pwa-banner-enable-btn" class="brand-button btn banner-btn-enable">Ativar Notificações</button>
      </div>
    `;

    document.body.appendChild(banner);
    document.getElementById("pwa-banner-enable-btn")?.addEventListener("click", () => {
      requestPushPermission();
    });
    document.getElementById("pwa-banner-dismiss-btn")?.addEventListener("click", () => {
      dismissFloatingBanner(false);
    });
  }

  function updateNotificationUI() {
    const drawerBox = document.getElementById("drawer-pwa-box");
    const isIOS = isIOSDevice();
    const isStandalone = isStandalonePWA();
    const perm = getNotificationPermission();

    if (drawerBox) {
      if (isIOS && !isStandalone && !("Notification" in window)) {
        drawerBox.innerHTML = `
          <div class="drawer-pwa-card" style="border-color:rgba(239,68,68,0.3)">
            <div style="font-weight:700;color:var(--accent);display:flex;align-items:center;gap:0.4rem;font-size:0.8rem">
              <span>📲</span> Notificações no iPhone
            </div>
            <p style="margin:0.35rem 0 0.5rem;font-size:0.74rem;color:var(--muted);line-height:1.35">
              Para ativar no iPhone, toca em <strong>Partilhar ⎋</strong> no Safari e depois em <strong>"Adicionar ao Ecrã Principal"</strong>.
            </p>
            <button id="drawer-pwa-ios-help" class="btn btn-ghost" style="width:100%;font-size:0.74rem;padding:0.45rem">Como ativar no iPhone</button>
          </div>`;
        document.getElementById("drawer-pwa-ios-help")?.addEventListener("click", requestPushPermission);
      } else if (perm === "granted") {
        drawerBox.innerHTML = `
          <div class="drawer-pwa-card" style="border-color:rgba(34,197,94,0.3);background:rgba(34,197,94,0.05)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
              <span style="color:#22c55e;font-weight:700;font-size:0.78rem">✓ Notificações do Telemóvel Ativas</span>
              <button id="drawer-btn-test" class="btn btn-ghost" style="padding:0.35rem 0.65rem;font-size:0.72rem;border-radius:0.5rem">Testar 🔔</button>
            </div>
          </div>`;
        document.getElementById("drawer-btn-test")?.addEventListener("click", triggerTestNotification);
      } else if (perm === "denied") {
        drawerBox.innerHTML = `
          <div class="drawer-pwa-card" style="border-color:rgba(239,68,68,0.3)">
            <div style="color:#ef4444;font-weight:700;font-size:0.8rem">⚠️ Notificações Bloqueadas</div>
            <p style="margin:0.25rem 0 0.5rem;font-size:0.73rem;color:var(--muted);line-height:1.3">
              Permite os avisos nas definições do telemóvel para receberes novidades e vagas.
            </p>
            <button id="drawer-btn-denied-help" class="btn btn-ghost" style="width:100%;font-size:0.74rem;padding:0.45rem">Como desbloquear</button>
          </div>`;
        document.getElementById("drawer-btn-denied-help")?.addEventListener("click", requestPushPermission);
      } else {
        drawerBox.innerHTML = `
          <div class="drawer-pwa-card">
            <button id="drawer-btn-enable" class="brand-button btn" style="width:100%;font-size:0.78rem;padding:0.6rem;border-radius:0.7rem;display:flex;align-items:center;justify-content:center;gap:0.4rem">
              <span>🔔</span> Ativar Notificações no Telemóvel
            </button>
            <p style="margin:0.35rem 0 0;font-size:0.72rem;color:var(--muted);text-align:center">Recebe avisos de vagas e lembretes de corte</p>
          </div>`;
        document.getElementById("drawer-btn-enable")?.addEventListener("click", requestPushPermission);
      }
    }

    checkFloatingBanner();
  }

  let notificationPoller = null;
  function startNotificationPoller() {
    if (notificationPoller) clearInterval(notificationPoller);
    if (!user) return;

    const check = async () => {
      try {
        const data = await api("/api/notifications/unread");
        const count = data.count || 0;

        const updateCountBadge = (wrapId) => {
          const wrap = document.getElementById(wrapId);
          if (!wrap) return;
          let countBadge = wrap.querySelector(".count");
          if (count > 0) {
            if (!countBadge) {
              countBadge = document.createElement("span");
              countBadge.className = "count";
              wrap.appendChild(countBadge);
            }
            countBadge.textContent = count;
          } else if (countBadge) {
            countBadge.remove();
          }
        };

        updateCountBadge("bell-wrap");
        updateCountBadge("bell-wrap-mobile");

        const drawerBellCount = document.querySelector(".count-drawer");
        if (drawerBellCount) {
          if (count > 0) {
            drawerBellCount.style.display = "inline-block";
            drawerBellCount.style.marginLeft = "0.5rem";
            drawerBellCount.style.background = "#ef4444";
            drawerBellCount.style.color = "#fff";
            drawerBellCount.style.padding = "0.1rem 0.45rem";
            drawerBellCount.style.borderRadius = "999px";
            drawerBellCount.style.fontSize = "0.7rem";
            drawerBellCount.style.fontWeight = "800";
            drawerBellCount.textContent = count;
          } else {
            drawerBellCount.style.display = "none";
          }
        }

        const unreadList = data.unread || [];
        const lastNotifId = localStorage.getItem("vb-last-notif-id");
        if (unreadList.length && unreadList[0].id !== lastNotifId) {
          const newest = unreadList[0];
          localStorage.setItem("vb-last-notif-id", newest.id);
          showSystemNotification(newest.title, newest.message, newest.action_url);
          if (user.role === "ADMIN" || user.role === "BARBER") {
            playNotificationSound();
          }
        }
      } catch {}
    };

    check();
    notificationPoller = setInterval(check, 20000);
  }

  async function toggleBell(event) {
    if (event) {
      if (typeof event.stopPropagation === "function") event.stopPropagation();
    }

    document.getElementById("drawer")?.classList.remove("open");

    const desktopWrap = document.getElementById("bell-wrap");
    const mobileWrap = document.getElementById("bell-wrap-mobile");
    const isMobileVisible = mobileWrap && window.getComputedStyle(mobileWrap).display !== "none";
    const targetWrap = isMobileVisible ? mobileWrap : (desktopWrap || document.querySelector(".navbar"));

    let panel = document.getElementById("bell-panel");
    if (panel) {
      panel.remove();
      return;
    }

    let items = [];
    try {
      items = await api("/api/notifications");
    } catch {
      items = [];
    }

    document.querySelectorAll(".count").forEach((b) => b.remove());
    const drawerBellCount = document.querySelector(".count-drawer");
    if (drawerBellCount) drawerBellCount.style.display = "none";

    const perm = getNotificationPermission();
    const isGranted = perm === "granted";

    panel = document.createElement("div");
    panel.id = "bell-panel";
    panel.className = "dropdown";
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:.5rem;border-bottom:1px solid var(--card-border);margin-bottom:.5rem">
        <strong>Notificações</strong>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span class="muted" style="font-size:.7rem">${items.length} total</span>
          <button id="close-bell-panel" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.95rem;padding:0.2rem" title="Fechar">✕</button>
        </div>
      </div>
      ${!isGranted ? `
        <button id="enable-pwa-notifs" class="brand-button btn" style="width:100%;margin-bottom:.7rem;font-size:.76rem;padding:.55rem;border-radius:.6rem">
          🔔 Ativar Notificações no Telemóvel
        </button>` : `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.35rem .5rem;margin-bottom:.6rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:.5rem;font-size:.72rem">
          <span style="color:#22c55e;font-weight:700">✓ Alertas no telemóvel ativos</span>
          <button id="test-pwa-notif-btn" style="background:none;border:none;color:var(--accent);font-weight:700;cursor:pointer;font-size:.72rem">Testar som 🔔</button>
        </div>`}
      ${items.length
        ? items.map((n) => `
          <div style="padding:.5rem 0;border-bottom:1px solid var(--card-border);font-size:.8rem">
            <div style="font-weight:700;color:var(--foreground)">${n.title}</div>
            <div class="muted" style="font-size:.75rem;margin:.2rem 0">${n.message}</div>
            ${n.action_url ? `<a href="${n.action_url}" style="color:var(--accent);font-size:.75rem;font-weight:700">Ver detalhes →</a>` : ""}
          </div>`).join("")
        : `<p class="muted" style="font-size:.8rem;padding:.5rem 0">Sem notificações de momento.</p>`}
    `;

    if (targetWrap) {
      targetWrap.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }

    panel.querySelector("#enable-pwa-notifs")?.addEventListener("click", () => {
      requestPushPermission();
    });
    panel.querySelector("#test-pwa-notif-btn")?.addEventListener("click", () => {
      triggerTestNotification();
    });
    panel.querySelector("#close-bell-panel")?.addEventListener("click", () => {
      panel.remove();
    });

    const clickOutsideHandler = (e) => {
      if (!panel.contains(e.target) && !e.target.closest("[data-bell]")) {
        panel.remove();
        document.removeEventListener("click", clickOutsideHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", clickOutsideHandler);
    }, 10);

    try {
      await api("/api/notifications/read", { method: "POST" });
    } catch {}
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatChatMessage(text) {
    if (!text) return "";
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/^[•\-]\s+(.+)$/gm, '<div class="chat-bullet-item"><span class="chat-bullet-dot"></span><span class="chat-bullet-text">$1</span></div>');
    html = html.replace(/&quot;MARCAR AGORA&quot;|MARCAR AGORA/gi, '<div class="chat-cta-wrap"><a href="/marcar" class="chat-cta-link">✂️ MARCAR AGORA →</a></div>');
    html = html.replace(/\n{2,}/g, '<div class="chat-para-break"></div>');
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  let assistantOpen = false;
  let assistantLoading = false;
  let assistantMessages = [
    {
      role: "assistant",
      text: "Olá! Sou o assistente oficial da Viegas Barber 💈\nComo te posso ajudar hoje? Clica numa sugestão abaixo ou faz a tua pergunta:",
    },
  ];
  const quickSuggestions = ["✂️ Preçário", "🕒 Horários", "📍 Localização", "📅 Como marcar?", "💈 O Diogo"];

  function mountAssistant() {
    let backdrop = document.getElementById("assistant-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "assistant-backdrop";
      backdrop.className = "chat-backdrop";
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", () => {
        assistantOpen = false;
        render();
      });
    }

    const host = document.getElementById("assistant");
    if (!host) return;

    const render = () => {
      host.classList.toggle("open", assistantOpen);
      backdrop.classList.toggle("active", assistantOpen);

      if (assistantOpen && window.innerWidth <= 640) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }

      if (!assistantOpen) {
        host.innerHTML = `
          <button class="assistant-btn" id="open-assistant-btn" title="Falar com o assistente">
            <span class="assistant-pulse"></span>
            <span>💬 Diogo AI</span>
          </button>`;
        host.querySelector("#open-assistant-btn")?.addEventListener("click", () => {
          assistantOpen = true;
          render();
        });
        return;
      }

      host.innerHTML = `
        <div class="chat">
          <div class="chat-mobile-handle"></div>
          <div class="chat-head">
            <div style="display:flex;align-items:center;gap:.6rem">
              <span style="font-size:1.15rem">💈</span>
              <div>
                <div style="font-size:.9rem;font-weight:800;line-height:1.2">Viegas Barber AI</div>
                <div class="chat-head-status"><span class="assistant-pulse" style="width:.4rem;height:.4rem"></span> Online • Resposta imediata</div>
              </div>
            </div>
            <button class="chat-close-btn" id="close-chat" title="Fechar assistente" aria-label="Fechar">✕</button>
          </div>
          <div class="chat-body" id="chat-scroll">
            ${assistantMessages.map((m) => `
              <div class="bubble ${m.role}">
                ${m.role === "assistant" ? formatChatMessage(m.text) : escapeHtml(m.text)}
              </div>`).join("")}
            ${assistantLoading ? `
              <div class="bubble assistant" style="display:inline-flex;align-items:center;gap:.5rem;font-style:italic;color:var(--muted)">
                <span class="assistant-pulse" style="width:.45rem;height:.45rem"></span> A escrever resposta...
              </div>` : ""}
          </div>
          <div class="chat-suggestions-bar">
            ${quickSuggestions.map((s) => `<button type="button" class="chat-suggestion-chip" data-chip="${s}">${s}</button>`).join("")}
          </div>
          <form class="chat-form" id="chat-form">
            <input name="q" placeholder="Escreve uma pergunta..." autocomplete="off" ${assistantLoading ? "disabled" : ""}>
            <button class="brand-button btn" type="submit" ${assistantLoading ? "disabled" : ""}>Enviar</button>
          </form>
        </div>`;

      const scrollEl = host.querySelector("#chat-scroll");
      if (scrollEl) {
        requestAnimationFrame(() => {
          scrollEl.scrollTop = scrollEl.scrollHeight;
        });
      }

      host.querySelector("#close-chat")?.addEventListener("click", () => {
        assistantOpen = false;
        render();
      });

      host.querySelectorAll("[data-chip]").forEach((b) => {
        b.addEventListener("click", () => {
          sendUserMessage(b.dataset.chip);
        });
      });

      const form = host.querySelector("#chat-form");
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector("input");
        const text = input?.value.trim();
        if (!text || assistantLoading) return;
        input.value = "";
        sendUserMessage(text);
      });
    };

    const sendUserMessage = async (text) => {
      assistantMessages.push({ role: "user", text });
      assistantLoading = true;
      render();

      try {
        const data = await api("/api/assistant", { method: "POST", body: { message: text } });
        assistantMessages.push({ role: "assistant", text: data.reply || "Desculpa, não consegui obter a resposta." });
      } catch (err) {
        assistantMessages.push({ role: "assistant", text: "Não foi possível contactar o servidor neste momento. Tenta novamente." });
      } finally {
        assistantLoading = false;
        render();
      }
    };

    render();
  }

  async function pageHome() {
    const data = await api("/api/home");
    const slides = (data.styles || []).filter((s) => s.imageUrl).slice(0, 8);
    document.getElementById("app").innerHTML = `
      ${navHtml("home")}
      <main class="page-shell">
        <section class="hero-section">
          <div class="hero-slideshow" id="slides">
            ${slides.length ? slides.map((s, i) => `<div class="hero-slide ${i === 0 ? "is-active" : ""}" style="background-image:url('${s.imageUrl}')"></div>`).join("") : `<div class="hero-slide is-active" style="background-image:url('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80')"></div>`}
            <div class="hero-slide-shade"></div>
            <div class="hero-wordmark"><p>VIEGAS BARBER</p></div>
          </div>
          <div class="hero-content">
            <div class="hero-eyebrow">Barbeiro Exclusivo: Diogo Viegas</div>
            <h1 class="hero-title">VIEGAS BARBER</h1>
            <p class="hero-tag">“Mais que um corte.”</p>
            <p class="hero-description">Atendimento individual, degradês milimétricos e um ambiente desenhado para o teu momento. Sem esperas desnecessárias, com marcação rápida e precisa.</p>
            <div class="hero-availability" style="margin-top:1.5rem"><div style="display:flex;gap:.5rem;align-items:center"><span class="pulse"></span> Agenda aberta para os próximos dias</div><a href="/marcar" style="color:var(--accent);font-weight:700">Ver vagas livres →</a></div>
            <div class="radar-box" style="margin:0.75rem auto 0;max-width:36rem;text-align:left">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
                <div style="display:flex;align-items:center;gap:0.5rem">
                  <span class="radar-ping-dot"></span>
                  <span style="font-size:0.72rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--foreground,#faf8f8)">RADAR DE VAGAS EM TEMPO REAL</span>
                </div>
                <span class="radar-badge-live">AO VIVO</span>
              </div>
              <div class="radar-grid">
                ${(() => {
                  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                  const now = new Date();
                  let cards = [];
                  for (let i = 0; i < 3; i++) {
                    const d = new Date();
                    d.setDate(now.getDate() + i);
                    const dayOfWeek = d.getDay();
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;
                    const label = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : dayLabels[dayOfWeek];
                    const dateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
                    const statusBadge = isSunday 
                      ? `<span class="radar-badge" style="font-size:0.68rem;color:#f87171;font-weight:700">🔴 Encerrado</span>` 
                      : `<span class="radar-badge" style="font-size:0.68rem;color:#4ade80;font-weight:700">🟢 Vagas</span>`;
                    const hours = isSunday ? "Folga" : (isSaturday ? "09h - 12h" : "09h - 19h");
                    cards.push(`
                      <a href="/marcar" class="radar-day-card" style="text-decoration:none;display:block">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem">
                          <strong style="font-size:0.78rem;color:var(--foreground,#fff)">${label}</strong>
                          <span class="radar-date" style="font-size:0.65rem;color:var(--muted,#a1a1aa)">${dateStr}</span>
                        </div>
                        <div style="margin-bottom:0.2rem">${statusBadge}</div>
                        <div class="radar-hours" style="font-size:0.65rem;color:var(--muted,#71717a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${hours}</div>
                      </a>
                    `);
                  }
                  return cards.join("");
                })()}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;padding-top:0.65rem;border-top:1px solid var(--card-border);font-size:0.72rem;flex-wrap:wrap;gap:0.4rem">
                <span style="color:var(--muted)">⚡ Atendimento individual sem esperas</span>
                <a href="/marcar" style="color:var(--accent);font-weight:700;text-decoration:none">Escolher Horário →</a>
              </div>
            </div>
          </div>
        </section>
        <section class="section section-alt">
          <div class="wrap card" style="display:grid;gap:2rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));align-items:center">
            <img class="photo" style="object-fit:cover" src="/img/diogo-viegas.jpg" alt="Diogo Viegas">
            <div>
              <div class="eyebrow">O Teu Barbeiro</div>
              <h2 class="h2">Conhece o Diogo Viegas</h2>
              <p class="muted">Na Viegas Barber és atendido exclusivamente pelo Diogo. Sem rotação de cadeiras, sem surpresas no resultado. Foco total no detalhe, higiene rigorosa e técnicas modernas de fade e barboterapia.</p>
              <div style="display:flex;gap:.8rem;flex-wrap:wrap;margin-top:1rem">
                <a class="btn btn-ghost" href="/diogo">Ver Perfil e Trabalhos do Diogo</a>
                <a class="btn brand-button" href="/marcar">Marcar com o Diogo</a>
              </div>
            </div>
          </div>
        </section>
        <section class="section" id="servicos">
          <div class="wrap">
            <div class="eyebrow">Catálogo</div>
            <h2 class="h2">SERVIÇOS DE EXCELÊNCIA</h2>
            <div class="rule"></div>
            <div class="grid-3" style="margin-top:2rem">
              ${data.services.map((s) => `<article class="card"><h3>${s.name}</h3><p class="muted">${s.description || ""}</p><div class="row" style="border-top:1px solid var(--card-border);padding-top:1rem;margin-top:1rem"><div><span class="muted">Preço</span><div class="price">${Number(s.price).toFixed(2)}€</div></div><span class="btn-ghost btn">⏱ ~${s.duration} min</span></div></article>`).join("")}
            </div>
          </div>
        </section>
        <section class="section section-alt">
          <div class="wrap">
            <div class="row"><div><div class="eyebrow">Portefólio</div><h2 class="h2">TRABALHOS DO DIOGO</h2></div><a href="/galeria" style="color:var(--accent);font-weight:700">Ver Mais Fotos →</a></div>
            ${data.styles.length ? `<div class="grid-3" style="margin-top:1.5rem">
              ${data.styles.slice(0, 6).map((s) => `<div class="card" style="padding:0;overflow:hidden"><div class="thumb" style="height:18rem"><img src="${s.imageUrl}" alt="Trabalho Diogo Viegas"></div></div>`).join("")}
            </div>
            <div style="text-align:center;margin-top:2.2rem">
              <a class="brand-button btn" href="/marcar" style="padding:.9rem 2.2rem;font-weight:800;font-size:0.95rem">MARCAR HORÁRIO</a>
            </div>` : `<div class="card" style="margin-top:1.5rem;text-align:center;padding:2.5rem"><p class="muted">📸 Galeria em atualização. Fica atento às novidades!</p><a class="brand-button btn" href="/marcar" style="margin-top:.8rem">Marcar Horário</a></div>`}
          </div>
        <section class="section">
          <div class="wrap" style="text-align:center">
            <div class="eyebrow">Feedback Verificado</div>
            <h2 class="h2">O QUE DIZEM DA VIEGAS BARBER</h2>
            <div class="grid-3" style="margin-top:1.5rem;text-align:left">
              ${data.reviews.length ? data.reviews.map((r) => `<article class="card"><div style="color:var(--accent)">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div><p class="muted">${r.comment || ""}</p><strong>${(r.user_name || "Cliente").split(" ")[0]}</strong></article>`).join("") : `<p class="muted">Todas as avaliações são 100% verificadas e deixadas exclusivamente por clientes com cortes concluídos.</p>`}
            </div>
          </div>
        </section>
        <section class="section wrap">
          <div class="card row" style="background:linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(20,20,23,0.95) 100%);border-color:rgba(239,68,68,0.25)">
            <div>
              <div class="eyebrow" style="color:var(--accent)">Cartão de Fidelização 💈</div>
              <h2 class="h2">Ao fim de 5 cortes, tu escolhes o teu desconto!</h2>
              <p class="muted">Completa 5 cortes na Viegas Barber e tem direito a <strong>3€ de desconto no corte</strong> OU <strong>4€ de desconto na compra de qualquer cera</strong>.</p>
            </div>
            <a class="brand-button btn" href="/fidelizacao" style="white-space:nowrap">Ver o Meu Cartão</a>
          </div>
        </section>
        <section class="section section-alt">
          <div class="wrap">
            <div class="row"><div><div class="eyebrow">Produtos Profissionais</div><h2 class="h2">LOJA VIEGAS BARBER</h2></div><a href="/loja" style="color:var(--accent);font-weight:700">Visitar Loja →</a></div>
            <div class="grid-3" style="margin-top:1.5rem">
              ${data.products.map((p) => `<article class="card"><div class="thumb" style="height:11rem">${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}">` : ""}</div><h4>${p.name}</h4><p class="muted">${p.description || ""}</p><div class="row"><span class="price">${Number(p.price).toFixed(2)}€</span><a href="/loja">Comprar →</a></div></article>`).join("")}
            </div>
          </div>
        </section>
        ${footerHtml(data.settings)}
      </main>`;
    let i = 0;
    setInterval(() => {
      const els = document.querySelectorAll(".hero-slide");
      if (els.length < 2) return;
      els[i].classList.remove("is-active");
      i = (i + 1) % els.length;
      els[i].classList.add("is-active");
    }, 6000);
  }

  async function pageDiogo() {
    const data = await api("/api/home");
    document.getElementById("app").innerHTML = `
      ${navHtml()}
      <main class="page-shell wrap section profile-grid">
        <div>
          <img class="photo" style="width:100%;height:26rem;object-fit:cover" src="/img/diogo-viegas.jpg" alt="Diogo Viegas">
        </div>
        <div>
          <div class="eyebrow">★ Fundador & Master Barber</div>
          <h1 class="h2">PRECISÃO, ESTILO E EXCLUSIVIDADE.</h1>
          <p class="muted">Olá, sou o <strong>Diogo Viegas</strong>. Criei a Viegas Barber para proporcionar mais do que um corte: uma experiência de relaxamento e estética contemporânea masculina de alto nível.</p>
          <p>Especialidades: Low/Mid/High Fade, Taper, barboterapia e cortes clássicos à tesoura.</p>
          <a class="brand-button btn" href="/marcar">Marcar com o Diogo</a>
        </div>
      </main>
      ${footerHtml(data.settings)}`;
  }

  async function pageGaleria() {
    const styles = await api("/api/gallery");
    document.getElementById("app").innerHTML = `
      ${navHtml()}
      <main class="page-shell wrap section">
        <div style="text-align:center;max-width:38rem;margin:0 auto 2.5rem">
          <div class="eyebrow">Portefólio</div>
          <h1 class="h2">TRABALHOS DO DIOGO</h1>
          <p class="muted" style="margin-top:.5rem">Registos reais do dia a dia na Viegas Barber. Atendimento personalizado e cortes à medida de cada cliente.</p>
          <div style="margin-top:1.5rem">
            <a class="brand-button btn" href="/marcar" style="padding:.8rem 2rem;font-weight:800;font-size:0.95rem">MARCAR HORÁRIO</a>
          </div>
        </div>
        ${styles.length ? `<div class="grid-3" id="gallery-grid">
          ${styles.map((s) => `
            <div class="card" style="padding:0;overflow:hidden">
              <div class="thumb" style="height:20rem"><img src="${s.imageUrl}" alt="Trabalho Diogo Viegas"></div>
            </div>`).join("")}
        </div>
        <div style="text-align:center;margin-top:3rem">
          <a class="brand-button btn" href="/marcar" style="padding:.9rem 2.5rem;font-weight:800;font-size:1rem">MARCAR HORÁRIO</a>
        </div>` : `
        <div class="card" style="text-align:center;padding:3.5rem 1.5rem">
          <div style="font-size:3.5rem;margin-bottom:1rem">💈</div>
          <h3>Galeria em Atualização</h3>
          <p class="muted" style="max-width:32rem;margin:0 auto 1.5rem">Estamos a carregar as novas fotografias dos trabalhos do Diogo Viegas.</p>
          <a class="brand-button btn" href="/marcar">Marcar Horário</a>
        </div>`}
      </main>${footerHtml()}`;
  }

  async function pageLoja() {
    const products = await api("/api/products");
    const cart = {};
    document.getElementById("app").innerHTML = `
      ${navHtml()}
      <main class="page-shell wrap section">
        <div class="eyebrow">Reservas no balcão</div>
        <h1 class="h2">LOJA VIEGAS BARBER</h1>
        <p class="muted">Reservas os produtos no site e pagas em numerário, MB Way ou cartão na barbearia.</p>
        <div class="grid-3" id="store"></div>
        <div class="card" style="margin-top:1.5rem" id="cart"></div>
      </main>${footerHtml()}`;
    const render = () => {
      document.getElementById("store").innerHTML = products
        .map(
          (p) => `<article class="card"><div class="thumb" style="height:10rem">${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}">` : ""}</div><h4>${p.name}</h4><p class="muted">${p.description || ""}</p><div class="row"><span class="price">${Number(p.price).toFixed(2)}€</span><span class="muted">Stock ${p.stock}</span></div><button class="brand-button btn" data-add="${p.id}">Reservar</button></article>`
        )
        .join("");
      const items = Object.entries(cart);
      document.getElementById("cart").innerHTML = items.length
        ? `<strong>Reserva</strong>${items
            .map(([id, qty]) => {
              const p = products.find((x) => x.id === id);
              return `<div class="row"><span>${p.name} × ${qty}</span><span>${(Number(p.price) * qty).toFixed(2)}€</span></div>`;
            })
            .join("")}<button class="brand-button btn" id="checkout">Confirmar reserva</button>`
        : `<p class="muted">Ainda não tens produtos na reserva.</p>`;
      document.querySelectorAll("[data-add]").forEach((btn) => {
        btn.onclick = () => {
          cart[btn.dataset.add] = (cart[btn.dataset.add] || 0) + 1;
          render();
        };
      });
      document.getElementById("checkout")?.addEventListener("click", async () => {
        if (!user) return (location.href = "/login");
        try {
          const res = await api("/api/orders", {
            method: "POST",
            body: { items: Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })) },
          });
          if (res.whatsAppUrl) {
            if (confirm("Reserva registada com sucesso! Desejas enviar a notificação dos produtos ao Diogo por WhatsApp?")) {
              window.open(res.whatsAppUrl, "_blank");
            }
          } else {
            alert("Reserva criada. Paga no balcão com o Diogo.");
          }
          location.href = "/minhas-marcacoes";
        } catch (err) {
          alert(err.message);
        }
      });
    };
    render();
  }

  async function pageFidelizacao() {
    let loyalty = { points: 0, visits: 0, tier: "Bronze" };
    if (user) loyalty = await api("/api/loyalty");
    const cutsDone = loyalty.visits || 0;
    const currentCycleCuts = cutsDone % 5;
    const cyclesCompleted = Math.floor(cutsDone / 5);
    const hasRewardReady = cutsDone >= 5 && currentCycleCuts === 0;
    const cutsNeeded = hasRewardReady ? 0 : 5 - currentCycleCuts;

    document.getElementById("app").innerHTML = `
      ${navHtml()}
      <main class="page-shell loyalty-shell">
        <div style="text-align:center;margin-bottom:1.2rem">
          <div class="eyebrow" style="color:var(--accent)">Programa de Recompensas</div>
          <h1 class="h2" style="font-size:clamp(1.7rem, 5vw, 2.4rem)">CARTÃO DE FIDELIZAÇÃO</h1>
          <p class="muted" style="max-width:34rem;margin:0.4rem auto 0;font-size:0.88rem;line-height:1.5">
            A tua fidelidade compensa: a cada <strong>5 cortes</strong> concluídos com o Diogo, escolhes o teu desconto!
          </p>
        </div>
        
        <!-- Cartão Virtual de Carimbos -->
        <div class="loyalty-card-container">
          <div class="loyalty-header-row">
            <div>
              <div class="loyalty-club-title">VIEGAS BARBER CLUB 💈</div>
              <div class="muted" style="font-size:.82rem;margin-top:.25rem">
                ${user ? `Cliente: <strong>${user.name}</strong>` : `<a href="/login?redirect=/fidelizacao" style="color:var(--accent);font-weight:700">Entrar na conta para ver os teus cortes →</a>`}
              </div>
            </div>
            <div>
              <span class="chip" style="position:static;font-size:.78rem;padding:.4rem .8rem;background:rgba(239,68,68,0.18);color:var(--accent);border:1px solid var(--accent);font-weight:800;border-radius:999px">
                ✂️ ${cutsDone} ${cutsDone === 1 ? "Corte Feito" : "Cortes Feitos"}
              </span>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.4rem">
              <span style="font-weight:700;font-size:.86rem;color:#e4e4e7">Progresso Atual:</span>
              <span style="font-weight:800;color:var(--accent);font-size:.86rem">
                ${currentCycleCuts === 0 && cutsDone > 0 ? "5 de 5 (Pronto a Usar!)" : `${currentCycleCuts} de 5 cortes`}
              </span>
            </div>
            
            <!-- 5 Slots de Cortes com Carimbo Perfeitamente Responsivos -->
            <div class="loyalty-stamps-grid">
              ${[1, 2, 3, 4, 5].map((slotNum) => {
                const isStamped = (currentCycleCuts === 0 && cutsDone > 0) ? true : slotNum <= currentCycleCuts;
                const isFinal = slotNum === 5;
                return `
                  <div class="loyalty-stamp-box ${isStamped ? "stamped" : ""}">
                    <span class="loyalty-stamp-icon">${isStamped ? (isFinal ? "🎁" : "✂️") : (isFinal ? "⭐" : "⚪")}</span>
                    <span class="loyalty-stamp-num">#${slotNum}</span>
                  </div>`;
              }).join("")}
            </div>
          </div>

          <!-- Estado do Desconto -->
          <div style="padding:0.9rem 1rem;border-radius:.8rem;background:rgba(255,255,255,0.03);border:1px solid var(--card-border);margin-top:0.8rem">
            ${cutsDone >= 5 && (currentCycleCuts === 0 || cutsDone % 5 === 0) ? `
              <div style="display:flex;align-items:center;gap:.65rem;color:#22c55e">
                <span style="font-size:1.4rem;flex-shrink:0">🎉</span>
                <div>
                  <strong style="font-size:.9rem">Parabéns! Completaste o ciclo de 5 cortes!</strong>
                  <div class="muted" style="font-size:.78rem;margin-top:.2rem">Já podes usufruir de 3€ de desconto no corte ou 4€ na cera com o Diogo.</div>
                </div>
              </div>` : `
              <div style="display:flex;align-items:center;gap:.65rem">
                <span style="font-size:1.3rem;flex-shrink:0">⏳</span>
                <div>
                  <div style="font-size:.84rem;font-weight:600">
                    Faltam apenas <strong style="color:var(--accent)">${cutsNeeded} ${cutsNeeded === 1 ? "corte" : "cortes"}</strong> para o teu desconto!
                  </div>
                  <div class="muted" style="font-size:.75rem;margin-top:.15rem">Ciclos completos aproveitados: ${cyclesCompleted}</div>
                </div>
              </div>`}
          </div>
        </div>

        <!-- Opções de Recompensa -->
        <div style="margin-top:2.2rem">
          <h3 style="font-size:1.05rem;font-weight:900;letter-spacing:0.02em;margin-bottom:0.3rem">
            AS 2 OPÇÕES À TUA ESCOLHA AO FIM DE 5 CORTES:
          </h3>
          <p class="muted" style="font-size:0.82rem;margin-bottom:1rem">
            Ao atingires cada patamar de 5 cortes, avisas o Diogo e escolhes qual das ofertas preferes aplicar:
          </p>

          <div class="grid-2" style="gap:1rem">
            <article class="card" style="border:1px solid rgba(239,68,68,0.3);position:relative;padding:1.3rem">
              <span class="chip" style="position:static;display:inline-block;margin-bottom:.5rem;background:rgba(239,68,68,0.15);color:var(--accent);border:1px solid var(--accent);font-weight:800;font-size:0.7rem">OPÇÃO 1</span>
              <h4 style="font-size:1.1rem;margin:0 0 .4rem;font-weight:800">✂️ 3€ de Desconto no Corte</h4>
              <p class="muted" style="font-size:.82rem;line-height:1.5;margin:0 0 1rem">Desconto direto no valor do teu corte (ex: Corte de 12€ fica por <strong>9,00€</strong>).</p>
              <div style="padding-top:.8rem;border-top:1px solid var(--card-border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
                <span style="font-size:.76rem;font-weight:700;color:var(--muted)">5 Cortes Realizados</span>
                <a href="/marcar" class="brand-button btn" style="font-size:.78rem;padding:.4rem .85rem">Marcar Horário</a>
              </div>
            </article>

            <article class="card" style="border:1px solid rgba(239,68,68,0.3);position:relative;padding:1.3rem">
              <span class="chip" style="position:static;display:inline-block;margin-bottom:.5rem;background:rgba(239,68,68,0.15);color:var(--accent);border:1px solid var(--accent);font-weight:800;font-size:0.7rem">OPÇÃO 2</span>
              <h4 style="font-size:1.1rem;margin:0 0 .4rem;font-weight:800">💈 4€ de Desconto na Cera</h4>
              <p class="muted" style="font-size:.82rem;line-height:1.5;margin:0 0 1rem">Desconto direto de 4€ na compra de qualquer cera para cabelo profissional na barbearia.</p>
              <div style="padding-top:.8rem;border-top:1px solid var(--card-border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
                <span style="font-size:.76rem;font-weight:700;color:var(--muted)">5 Cortes Realizados</span>
                <a href="/loja" class="brand-button btn" style="font-size:.78rem;padding:.4rem .85rem">Ver Ceras na Loja</a>
              </div>
            </article>
          </div>
        </div>

        ${!user ? `
          <div class="card" style="margin-top:1.8rem;text-align:center;padding:1.6rem 1.2rem">
            <h4 style="margin:0 0 .4rem;font-size:1rem">Ainda não tens conta iniciada?</h4>
            <p class="muted" style="margin:0 0 1rem;font-size:0.82rem">Inicia sessão ou cria a tua conta para os teus cortes acumularem automaticamente no teu cartão.</p>
            <a href="/login?redirect=/fidelizacao" class="brand-button btn" style="padding:0.65rem 1.2rem;font-size:0.85rem">Iniciar Sessão / Criar Conta</a>
          </div>` : ""}
      </main>
      ${footerHtml()}`;
  }

  async function pagePlano() {
    location.replace("/fidelizacao");
  }

  async function pageMarcar() {
    const root = document.getElementById("app");
    if (!user) {
      root.innerHTML = `
        ${navHtml()}
        <main class="page-shell wrap section" style="max-width:32rem">
          <div class="card" style="text-align:center;padding:2.5rem 1.8rem">
            <div class="auth-gate-badge">💈 RESERVAS VIEGAS BARBER</div>
            <h1 class="h2" style="font-size:1.6rem;margin:1.2rem 0 .6rem">Inicia Sessão para Marcar</h1>
            <p class="muted" style="line-height:1.6;font-size:.88rem;margin-bottom:1.8rem">
              Para reservares a tua cadeira com o Diogo e acumulares carimbos no teu Cartão de Fidelização, é necessário teres a tua conta iniciada.
            </p>
            <div style="display:flex;flex-direction:column;gap:.8rem">
              <a class="brand-button btn" href="/login?redirect=/marcar" style="padding:1rem;font-size:.95rem">
                🔑 Iniciar Sessão na Conta
              </a>
              <a class="btn-ghost btn" href="/register?redirect=/marcar" style="padding:.9rem;font-size:.9rem">
                ✨ Criar Conta Nova
              </a>
            </div>
            <div style="margin-top:1.5rem">
              <a href="/" class="muted" style="font-size:.8rem">← Voltar à página inicial</a>
            </div>
          </div>
        </main>
        ${footerHtml()}`;
      bindChrome();
      return;
    }

    const services = await api("/api/services");
    const ref = new URLSearchParams(location.search).get("ref") || "";
    const todayStr = getLocalDateStr();
    const state = {
      step: 1,
      service: null,
      date: todayStr,
      time: "",
      silent: false,
      music: "",
      duo: false,
      companion: "",
      style: ref,
      done: false,
      loading: false,
    };

    const draw = async () => {
      const stepNames = ["Serviço", "Data & Modo", "Horário", "Confirmar"];
      root.innerHTML = `
        ${navHtml()}
        <main class="page-shell wrap section booking-shell">
          <div class="booking-header">
            <span class="eyebrow">Agendamento Exclusivo</span>
            <h1 class="h2" style="margin:.2rem 0">Marcar com Diogo Viegas</h1>
            <p class="muted" style="font-size:.85rem">Atendimento exclusivo com hora marcada na cadeira do Diogo.</p>
          </div>

          <div class="booking-steps-bar">
            <div class="booking-step-track"></div>
            ${stepNames.map((name, i) => {
              const num = i + 1;
              const cls = state.step === num ? "active" : state.step > num ? "passed" : "";
              return `
                <div class="booking-step-item ${cls}">
                  <div class="booking-step-num">${state.step > num ? "✓" : num}</div>
                  <div class="booking-step-label">${name}</div>
                </div>`;
            }).join("")}
          </div>

          <div class="card" id="flow" style="position:relative"></div>
        </main>
        ${footerHtml()}`;
      bindChrome();
      const box = document.getElementById("flow");

      if (state.done) {
        box.innerHTML = `
          <div style="text-align:center;padding:1.5rem .5rem">
            <div style="width:4rem;height:4rem;border-radius:50%;background:rgba(34,197,94,.15);border:2px solid #22c55e;color:#22c55e;font-size:2rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1.2rem">✓</div>
            <h2 class="h2" style="font-size:1.8rem;margin-bottom:.4rem">Marcação Confirmada!</h2>
            <p class="muted" style="font-size:.9rem">A tua vaga está garantida na cadeira do Diogo Viegas.</p>
            
            <div class="receipt-ticket" style="max-width:26rem;margin:1.5rem auto;text-align:left">
              <div class="receipt-row">
                <span class="receipt-label">Barbeiro</span>
                <span class="receipt-val">💈 Diogo Viegas</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Serviço</span>
                <span class="receipt-val">${state.service.name}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Data e Hora</span>
                <span class="receipt-val" style="color:var(--accent)">📅 ${state.date} às ${state.time}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Modo Silencioso</span>
                <span class="receipt-val">${state.silent ? "🤫 Ativado" : "💬 Desativado (Normal)"}</span>
              </div>
              ${state.duo ? `
                <div class="receipt-row">
                  <span class="receipt-label">Marcação Duo</span>
                  <span class="receipt-val">👥 Com ${state.companion}</span>
                </div>` : ""}
              ${state.style ? `
                <div class="receipt-row">
                  <span class="receipt-label">Estilo / Ref</span>
                  <span class="receipt-val">✂️ ${state.style}</span>
                </div>` : ""}
              <div class="receipt-row">
                <span class="receipt-label">Valor Estimado</span>
                <span class="receipt-val price" style="font-size:1.15rem">${(Number(state.service.price) * (state.duo ? 2 : 1)).toFixed(2)}€</span>
              </div>
            </div>

            <div style="margin:1.4rem auto;max-width:26rem;padding:0.9rem 1.1rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:0.85rem;display:flex;align-items:center;gap:0.75rem;text-align:left">
              <span style="font-size:1.4rem">🔔</span>
              <div style="font-size:0.84rem;color:var(--text);line-height:1.4">
                <strong>O Diogo já foi notificado!</strong><br>
                <span class="muted">A marcação entrou diretamente na aplicação do barbeiro.</span>
              </div>
            </div>
            
            <div style="display:flex;gap:.8rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap">
              <a class="brand-button btn" href="/minhas-marcacoes">Ver As Minhas Marcações</a>
              <a class="btn-ghost btn" href="/">Voltar à Página Principal</a>
            </div>
          </div>`;
        return;
      }

      if (state.step === 1) {
        box.innerHTML = `
          <div style="margin-bottom:1.2rem">
            <h2 class="h2" style="font-size:1.4rem;margin:0 0 .3rem">1. Escolhe o Tipo de Corte</h2>
            <p class="muted" style="font-size:.85rem">Seleciona o serviço desejado com o Diogo Viegas.</p>
          </div>
          <div class="services-grid-flow">
            ${services.map((s) => `
              <div class="service-flow-card ${state.service?.id === s.id ? "selected" : ""}" data-srv="${s.id}">
                <div class="service-flow-info">
                  <h4>✂️ ${s.name}</h4>
                  ${s.description ? `<p class="service-flow-desc">${s.description}</p>` : ""}
                  <div class="service-flow-meta">
                    <span>⏱ ~${s.duration} minutos</span>
                    <span>•</span>
                    <span style="color:#22c55e">✓ Disponível</span>
                  </div>
                </div>
                <div class="service-flow-price-box">
                  <span class="service-flow-price">${Number(s.price).toFixed(2)}€</span>
                  <button class="brand-button service-select-btn">${state.service?.id === s.id ? "Selecionado" : "Escolher"}</button>
                </div>
              </div>`).join("")}
          </div>`;

        box.querySelectorAll("[data-srv]").forEach((card) => {
          card.onclick = () => {
            state.service = services.find((s) => s.id === card.dataset.srv);
            state.step = 2;
            draw();
          };
        });
      } else if (state.step === 2) {
        box.innerHTML = `
          <div style="margin-bottom:1.2rem">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
              <div>
                <h2 class="h2" style="font-size:1.4rem;margin:0 0 .3rem">2. Data e Preferências</h2>
                <p class="muted" style="font-size:.85rem">Serviço: <strong>${state.service.name}</strong> (${Number(state.service.price).toFixed(2)}€)</p>
              </div>
              <button class="btn-ghost btn" id="change-srv" style="font-size:.75rem;padding:.4rem .8rem">Alterar Serviço</button>
            </div>
          </div>

          <div class="stack" style="gap:1rem">
            <div>
              <label style="font-weight:700;display:flex;justify-content:space-between;align-items:center">
                <span>📅 Data do Corte</span>
                <span class="muted" style="font-size:.72rem">Seg — Sáb</span>
              </label>
              <input type="date" id="date" value="${state.date}" min="${todayStr}" style="padding:.9rem 1rem;font-size:1rem;font-weight:700">
            </div>

            <!-- Card Modo Silencioso -->
            <div class="extra-toggle-card ${state.silent ? "active" : ""}" id="toggle-silent">
              <div class="extra-toggle-left">
                <span class="extra-toggle-icon">🤫</span>
                <div class="extra-toggle-text">
                  <h4>Modo Silencioso</h4>
                  <p>Preferes um corte calmo e focado? O Diogo mantém o atendimento tranquilo e relaxante, sem conversa desnecessária.</p>
                </div>
              </div>
              <div class="switch-ui"></div>
            </div>

            <!-- Card Marcação Duo -->
            <div class="extra-toggle-card ${state.duo ? "active" : ""}" id="toggle-duo">
              <div class="extra-toggle-left">
                <span class="extra-toggle-icon">👥</span>
                <div class="extra-toggle-text">
                  <h4>Marcação Duo (2 Pessoas Seguidas)</h4>
                  <p>Marca dois cortes consecutivos no mesmo horário para ti e um amigo ou familiar.</p>
                </div>
              </div>
              <div class="switch-ui"></div>
            </div>

            <div id="companion-wrap" style="display:${state.duo ? "block" : "none"}">
              <label>Nome do Acompanhante</label>
              <input id="companion" placeholder="Ex: Gonçalo Silva" value="${state.companion}">
            </div>

            <div>
              <label>✂️ Referência de Corte (Opcional)</label>
              <input id="style" placeholder="Ex: Taper fade com textura no topo, Degradê médio..." value="${state.style}">
            </div>

            <div>
              <label>🎵 Pedido Musical no Salão (Opcional)</label>
              <input id="music" placeholder="Ex: Hip Hop 90s, Trap, Lo-fi, Rock clássico..." value="${state.music}">
            </div>

            <div class="row" style="margin-top:1rem">
              <button class="btn-ghost btn" id="back" style="padding:.8rem 1.4rem">Voltar</button>
              <button class="brand-button btn" id="next" style="padding:.8rem 1.8rem">Ver Horários Disponíveis →</button>
            </div>
          </div>`;

        document.getElementById("change-srv").onclick = () => {
          state.step = 1;
          draw();
        };

        const silentCard = document.getElementById("toggle-silent");
        silentCard.onclick = () => {
          state.silent = !state.silent;
          silentCard.classList.toggle("active", state.silent);
        };

        const duoCard = document.getElementById("toggle-duo");
        const compWrap = document.getElementById("companion-wrap");
        duoCard.onclick = () => {
          state.duo = !state.duo;
          duoCard.classList.toggle("active", state.duo);
          compWrap.style.display = state.duo ? "block" : "none";
        };

        document.getElementById("back").onclick = () => {
          state.step = 1;
          draw();
        };

        document.getElementById("next").onclick = () => {
          state.date = document.getElementById("date").value;
          state.companion = document.getElementById("companion")?.value || "";
          state.style = document.getElementById("style").value;
          state.music = document.getElementById("music").value;
          if (!state.date) return alert("Por favor escolhe uma data.");
          if (state.duo && !state.companion.trim()) return alert("Por favor indica o nome do teu acompanhante para a marcação Duo.");
          state.step = 3;
          draw();
        };
      } else if (state.step === 3) {
        box.innerHTML = `
          <div style="margin-bottom:1.2rem">
            <h2 class="h2" style="font-size:1.4rem;margin:0 0 .3rem">3. Escolhe a Hora</h2>
            <p class="muted" style="font-size:.85rem">Data: <strong>${state.date}</strong></p>
          </div>
          <div id="slots-area" style="min-height:12rem">
            <div style="text-align:center;padding:2.5rem 0"><p class="muted">A carregar horários disponíveis com o Diogo...</p></div>
          </div>
          <div class="row" style="margin-top:1.5rem">
            <button class="btn-ghost btn" id="back">Voltar</button>
            <button class="btn-ghost btn" id="wait" style="border-color:rgba(239,68,68,.3);color:var(--accent)">⚡ Entrar na Lista de Espera Flash</button>
          </div>`;

        document.getElementById("back").onclick = () => {
          state.step = 2;
          draw();
        };

        document.getElementById("wait").onclick = async () => {
          try {
            await api("/api/waitlist", { method: "POST", body: { date: state.date, serviceId: state.service.id, isDuo: state.duo } });
            alert("Entraste na lista de espera Flash para " + state.date + ". Serás notificado assim que abrir uma vaga!");
          } catch (err) {
            alert(err.message || "Não foi possível entrar na lista de espera.");
          }
        };

        try {
          const data = await api(`/api/appointments/availability?date=${state.date}&serviceId=${state.service.id}&duo=${state.duo}`);
          const times = data.availableTimes || [];
          const area = document.getElementById("slots-area");

          if (data.isNightBlocked) {
            area.innerHTML = `
              <div style="text-align:center;padding:2.5rem 1rem;background:rgba(234,179,8,.08);border-radius:.9rem;border:1px dashed rgba(234,179,8,.35)">
                <div style="font-size:2rem;margin-bottom:.5rem">🌙</div>
                <h4 style="margin:0 0 .4rem;font-size:1.1rem;color:#facc15">Marcações em Pausa Noturna (01:00 às 08:00)</h4>
                <p class="muted" style="font-size:.85rem;max-width:26rem;margin:0 auto 1.2rem;line-height:1.5">
                  Para mantermos a melhor organização na cadeira do Diogo, o agendamento encerra de madrugada e reabre às 08:00 da manhã.
                </p>
                <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
                  <a class="brand-button btn" href="/">Voltar à Página Principal</a>
                </div>
              </div>`;
            return;
          }

          if (!times.length) {
            area.innerHTML = `
              <div style="text-align:center;padding:2.5rem 1rem;background:rgba(239,68,68,.04);border-radius:.9rem;border:1px dashed var(--card-border)">
                <div style="font-size:2rem;margin-bottom:.5rem">⏰</div>
                <h4 style="margin:0 0 .4rem;font-size:1.1rem">Sem vagas disponíveis para este dia</h4>
                <p class="muted" style="font-size:.85rem;max-width:24rem;margin:0 auto 1.2rem">
                  ${data.message || "Todos os horários para este dia já se encontram preenchidos. Experimenta outro dia ou entra na lista de espera."}
                </p>
                <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap">
                  <button class="brand-button btn" id="change-date-btn">Mudar de Data</button>
                </div>
              </div>`;
            document.getElementById("change-date-btn")?.addEventListener("click", () => {
              state.step = 2;
              draw();
            });
            return;
          }

          const morning = times.filter((t) => Number(t.split(":")[0]) < 13);
          const afternoon = times.filter((t) => Number(t.split(":")[0]) >= 13);

          let html = "";
          if (morning.length) {
            html += `
              <div class="time-group-title">☀️ Manhã (${morning.length} vagas)</div>
              <div class="time-chips-grid">
                ${morning.map((t) => `<button class="time-chip-btn ${state.time === t ? "selected" : ""}" data-t="${t}"><span>${t}</span><span style="font-size:.65rem;font-weight:600;opacity:.7">Livre</span></button>`).join("")}
              </div>`;
          }
          if (afternoon.length) {
            html += `
              <div class="time-group-title">🌙 Tarde & Noite (${afternoon.length} vagas)</div>
              <div class="time-chips-grid">
                ${afternoon.map((t) => `<button class="time-chip-btn ${state.time === t ? "selected" : ""}" data-t="${t}"><span>${t}</span><span style="font-size:.65rem;font-weight:600;opacity:.7">Livre</span></button>`).join("")}
              </div>`;
          }

          area.innerHTML = html;
          area.querySelectorAll("[data-t]").forEach((btn) => {
            btn.onclick = () => {
              state.time = btn.dataset.t;
              state.step = 4;
              draw();
            };
          });
        } catch (e) {
          document.getElementById("slots-area").innerHTML = `
            <div class="alert" style="margin:1rem 0">${e.message || "Erro ao carregar horários."}</div>`;
        }
      } else {
        box.innerHTML = `
          <div style="margin-bottom:1.2rem">
            <h2 class="h2" style="font-size:1.4rem;margin:0 0 .3rem">4. Rever e Confirmar</h2>
            <p class="muted" style="font-size:.85rem">Confirma os detalhes da tua reserva antes de finalizar.</p>
          </div>

          <div class="receipt-ticket">
            <div class="receipt-row">
              <span class="receipt-label">Barbeiro</span>
              <span class="receipt-val">💈 Diogo Viegas</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">Serviço</span>
              <span class="receipt-val">${state.service.name} (~${state.service.duration * (state.duo ? 2 : 1)} min)</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">Data e Hora</span>
              <span class="receipt-val" style="color:var(--accent);font-size:.95rem">📅 ${state.date} às ${state.time}</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">Modo Silencioso</span>
              <span class="receipt-val">${state.silent ? "🤫 Ativado" : "💬 Normal"}</span>
            </div>
            ${state.duo ? `
              <div class="receipt-row">
                <span class="receipt-label">Marcação Duo</span>
                <span class="receipt-val">👥 Com ${state.companion}</span>
              </div>` : ""}
            ${state.style ? `
              <div class="receipt-row">
                <span class="receipt-label">Estilo Referência</span>
                <span class="receipt-val">${state.style}</span>
              </div>` : ""}
            ${state.music ? `
              <div class="receipt-row">
                <span class="receipt-label">Música</span>
                <span class="receipt-val">🎵 ${state.music}</span>
              </div>` : ""}
            <div class="receipt-row">
              <span class="receipt-label">Cliente</span>
              <span class="receipt-val">${user.name}</span>
            </div>
            <div class="receipt-row" style="margin-top:.4rem;padding-top:.8rem;border-top:1px solid var(--card-border)">
              <span class="receipt-label" style="font-size:1rem;color:var(--foreground)">Total a Pagar no Salão</span>
              <span class="receipt-val price" style="font-size:1.4rem">${(Number(state.service.price) * (state.duo ? 2 : 1)).toFixed(2)}€</span>
            </div>
          </div>

          <p class="alert" id="err" style="display:none"></p>

          <div class="row" style="margin-top:1.2rem">
            <button class="btn-ghost btn" id="back" style="padding:.9rem 1.4rem">Voltar</button>
            <button class="brand-button btn" id="ok" style="padding:.9rem 2rem;font-size:.95rem">
              ✨ Confirmar Marcação
            </button>
          </div>`;

        document.getElementById("back").onclick = () => {
          state.step = 3;
          draw();
        };

        const okBtn = document.getElementById("ok");
        okBtn.onclick = async () => {
          okBtn.disabled = true;
          okBtn.textContent = "A agendar com o Diogo...";
          try {
            const res = await api("/api/appointments", {
              method: "POST",
              body: {
                serviceId: state.service.id,
                date: state.date,
                startTime: state.time,
                styleReference: state.style,
                isSilent: state.silent,
                musicRequest: state.music,
                isDuo: state.duo,
                companionName: state.companion,
              },
            });
            state.whatsAppUrl = res.whatsAppUrl;
            state.done = true;
            draw();
          } catch (e) {
            okBtn.disabled = false;
            okBtn.textContent = "✨ Confirmar Marcação";
            const err = document.getElementById("err");
            err.style.display = "block";
            err.textContent = e.message;
          }
        };
      }
    };

    await draw();
  }

  function authShell(title, inner, extra) {
    document.getElementById("app").innerHTML = `
      <main class="auth-page">
        <section class="auth-card">
          <div class="row"><a href="/">← Voltar ao início</a><button class="icon-btn" data-theme>${theme === "dark" ? "☀️" : "🌙"}</button></div>
          <div style="text-align:center;margin:1.5rem 0">
            <a class="logo" href="/" style="display:inline-flex;flex-direction:column;align-items:center;gap:.6rem;text-decoration:none">
              <img src="/img/logo.png" alt="Viegas Barber" onerror="this.style.display='none'" style="width:4.5rem;height:4.5rem;border-radius:50%;object-fit:cover;box-shadow:0 0 15px rgba(220,38,38,0.4)">
              <span style="font-size:1.35rem;font-weight:800;letter-spacing:1px">VIEGAS<span class="dot">.</span><span class="badge">Barber</span></span>
            </a>
            <h1>${title}</h1>
          </div>
          ${inner}
          ${extra}
        </section>
      </main>`;
    bindChrome();
  }

  function pageLogin() {
    let method = "instagram";
    const render = () => {
      authShell(
        "Entrar na conta",
        `<div class="tabs"><button class="${method === "instagram" ? "active" : ""}" data-m="instagram">@ do Instagram</button><button class="${method === "gmail" ? "active" : ""}" data-m="gmail">Gmail / email</button></div>
         <p class="alert" id="err" style="display:none"></p>
         <form class="stack" id="form">
           ${method === "instagram" ? `<div><label>@ do Instagram</label><input name="handle" placeholder="@o_teu_utilizador" required><p class="muted">Acesso do barbeiro: escreve <strong>admin</strong>.</p></div>` : `<div><label>Gmail ou email</label><input type="email" name="email" required></div>`}
           <div><label>Palavra-passe da Viegas Barber</label><input type="password" name="password" required><p class="muted">Não é a palavra-passe do Instagram nem do Gmail.</p></div>
           <button class="brand-button btn" style="width:100%">Iniciar sessão</button>
         </form>`,
        `<p class="muted" style="text-align:center;margin-top:1rem">Ainda não tens conta? <a href="/register" style="color:var(--accent);font-weight:700">Criar conta</a></p>`
      );
      document.querySelectorAll("[data-m]").forEach((b) => {
        b.onclick = () => {
          method = b.dataset.m;
          render();
        };
      });
      document.getElementById("form").onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const identifier =
          method === "instagram"
            ? String(fd.get("handle") || "").replace(/^@/, "").toLowerCase().trim() === "admin"
              ? "admin"
              : `${String(fd.get("handle") || "").replace(/^@/, "").toLowerCase().trim()}@instagram.user`
            : String(fd.get("email") || "").toLowerCase().trim();
        try {
          const data = await api("/api/auth/login", { method: "POST", body: { email: identifier, password: fd.get("password") } });
          location.href = data.user.role === "ADMIN" || data.user.role === "BARBER" ? "/dashboard" : "/";
        } catch (err) {
          const box = document.getElementById("err");
          box.style.display = "block";
          box.textContent = err.message;
        }
      };
    };
    render();
  }

  function pageRegister() {
    let method = "instagram";
    const render = () => {
      authShell(
        "Criar conta",
        `<div class="tabs"><button class="${method === "instagram" ? "active" : ""}" data-m="instagram">@ do Instagram</button><button class="${method === "gmail" ? "active" : ""}" data-m="gmail">Gmail / email</button></div>
         <p class="alert" id="err" style="display:none"></p>
         <form class="stack" id="form">
           <div><label>Nome</label><input name="name" minlength="2" required></div>
           ${method === "instagram" ? `<div><label>@ do Instagram</label><input name="handle" required></div>` : `<div><label>Gmail ou email</label><input type="email" name="email" required></div>`}
           <div><label>Cria a tua palavra-passe Viegas Barber</label><input type="password" name="password" minlength="8" required></div>
           <button class="brand-button btn" style="width:100%">Criar conta</button>
         </form>`,
        `<p class="muted" style="text-align:center;margin-top:1rem">Já tens conta? <a href="/login" style="color:var(--accent);font-weight:700">Iniciar sessão</a></p>`
      );
      document.querySelectorAll("[data-m]").forEach((b) => {
        b.onclick = () => {
          method = b.dataset.m;
          render();
        };
      });
      document.getElementById("form").onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          const data = await api("/api/auth/register", {
            method: "POST",
            body: {
              name: fd.get("name"),
              loginMethod: method,
              instagramHandle: fd.get("handle"),
              email: fd.get("email"),
              password: fd.get("password"),
            },
          });
          location.href = data.user.role === "ADMIN" || data.user.role === "BARBER" ? "/dashboard" : "/";
        } catch (err) {
          const box = document.getElementById("err");
          box.style.display = "block";
          box.textContent = err.message;
        }
      };
    };
    render();
  }

  async function pageMarcacoes() {
    if (!user) return (location.href = "/login");
    const rows = await api("/api/appointments/mine");
    document.getElementById("app").innerHTML = `
      ${navHtml()}
      <main class="page-shell wrap section">
        <h1 class="h2">As minhas marcações</h1>
        ${rows.map((a) => `<article class="card row"><div><strong>${a.service_name}</strong><div class="muted">${a.date} ${a.start_time} · ${a.status}</div></div>${a.status === "SCHEDULED" ? `<button class="btn-ghost btn" data-cancel="${a.id}">Cancelar</button>` : ""}${a.status === "COMPLETED" && !a.review_id ? `<form data-rev="${a.id}" class="stack"><input name="rating" type="number" min="1" max="5" value="5"><input name="comment" placeholder="Comentário público"><input name="privateNotes" placeholder="Notas privadas para o Diogo"><button class="brand-button btn">Enviar feedback</button></form>` : ""}</article>`).join("") || "<p class='muted'>Ainda não tens marcações.</p>"}
      </main>${footerHtml()}`;
    document.querySelectorAll("[data-cancel]").forEach((b) => {
      b.onclick = async () => {
        await api(`/api/appointments/${b.dataset.cancel}/cancel`, { method: "POST" });
        pageMarcacoes();
      };
    });
    document.querySelectorAll("[data-rev]").forEach((f) => {
      f.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        await api("/api/reviews", {
          method: "POST",
          body: { appointmentId: f.dataset.rev, rating: fd.get("rating"), comment: fd.get("comment"), privateNotes: fd.get("privateNotes") },
        });
        pageMarcacoes();
      };
    });
  }

  async function pageCortes() {
    if (!user) return (location.href = "/login");
    const rows = await api("/api/hair-history");
    document.getElementById("app").innerHTML = `
      ${navHtml()}
      <main class="page-shell wrap section">
        <div class="eyebrow">O Teu Histórico</div>
        <h1 class="h2">Os Meus Cortes</h1>
        <p class="muted">Regista fotografias dos teus estilos na Viegas Barber para consultares ou pedires novamente ao Diogo.</p>
        
        <form class="card stack" id="new-cut-form" style="max-width:32rem;margin:1.5rem 0 2rem">
          <h4>Registar Novo Corte</h4>
          <input name="serviceName" placeholder="Serviço (ex: Low Fade, Barba)" required>
          <input name="style" placeholder="Referência de estilo (opcional)">
          <input name="photoUrl" placeholder="URL da fotografia (opcional)">
          <textarea name="notes" placeholder="Notas (ex: máquina 1 nas laterais, topo com tesoura)" rows="2"></textarea>
          <button class="brand-button btn">Guardar no Histórico</button>
        </form>

        <div class="grid-3">
          ${rows.length ? rows.map((r) => `
            <article class="card">
              ${r.photoUrl ? `<div class="thumb" style="height:12rem;margin-bottom:.8rem"><img src="${r.photoUrl}" alt="${r.style || r.service_name}"></div>` : ""}
              <strong>${r.style || r.service_name}</strong>
              <div class="muted">${r.service_name} · ${new Date(r.date).toLocaleDateString("pt-PT")}</div>
              ${r.notes ? `<p class="muted" style="margin:.5rem 0">${r.notes}</p>` : ""}
              <a class="brand-button btn" style="margin-top:.8rem" href="/marcar?ref=${encodeURIComponent(r.style || r.service_name)}">Quero novamente</a>
            </article>`).join("") : "<p class='muted'>Ainda sem cortes registados.</p>"}
        </div>
      </main>${footerHtml()}`;

    document.getElementById("new-cut-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api("/api/hair-history", {
        method: "POST",
        body: {
          serviceName: fd.get("serviceName"),
          style: fd.get("style"),
          photoUrl: fd.get("photoUrl"),
          notes: fd.get("notes"),
        },
      });
      pageCortes();
    });
  }

  async function pageEspera() {
    if (!user) return (location.href = "/login");
    const id = new URLSearchParams(location.search).get("id");
    document.getElementById("app").innerHTML = `
      ${navHtml()}
      <main class="page-shell wrap section"><div class="card"><h1>Vaga Flash</h1><p id="msg">A carregar...</p><button class="brand-button btn" id="accept">Aceitar vaga</button></div></main>${footerHtml()}`;
    try {
      const offer = await api(`/api/waitlist/${id}`);
      document.getElementById("msg").textContent = `${offer.service_name} · ${offer.date} ${offer.time_slot || ""}`;
    } catch (e) {
      document.getElementById("msg").textContent = e.message;
    }
    document.getElementById("accept").onclick = async () => {
      await api("/api/waitlist/accept", { method: "POST", body: { id } });
      location.href = "/minhas-marcacoes";
    };
  }

  async function pageDashboard() {
    if (!user || (user.role !== "ADMIN" && user.role !== "BARBER")) return (location.href = "/login");
    const todayIso = getLocalDateStr();
    const tab = new URLSearchParams(location.search).get("tab") || "hoje";
    const links = [
      ["hoje", "📅 Agenda Hoje"],
      ["agenda", "🗓️ Agenda Completa"],
      ["clientes", "🧑 Clientes"],
      ["compras", "🛍️ Reservas da Loja"],
      ["catalogo", "📦 Catálogo & Stock"],
      ["servicos", "✂️ Serviços & Preços"],
      ["heatmap", "🔥 Mapa de Horários"],
      ["definicoes", "⚙️ Definições"],
    ];
    let body = "";
    if (tab === "hoje" || tab === "agenda") {
      const urlDate = new URLSearchParams(location.search).get("date");
      let date = (tab === "hoje" && !urlDate) ? todayIso : (urlDate || todayIso);

      const data = (tab === "hoje" && !urlDate)
        ? await api("/api/admin/today")
        : await api(`/api/admin/appointments?date=${date}`);
      
      if (data.date && tab === "hoje" && !urlDate) {
        date = data.date;
      }

      const rows = data.appointments || (Array.isArray(data) ? data : []);

      // Calculate Day Statistics
      const scheduledCount = rows.filter((a) => a.status === "SCHEDULED").length;
      const completedCount = rows.filter((a) => a.status === "COMPLETED").length;
      const totalEstimated = rows
        .filter((a) => a.status !== "CANCELLED")
        .reduce((sum, a) => sum + (Number(a.price) || 12), 0);

      // Safe Prev/Next calculations
      const prevStr = shiftDateStr(date, -1);
      const nextStr = shiftDateStr(date, 1);

      const [y, m, dNum] = date.split("-").map(Number);
      const currD = new Date(y, m - 1, dNum, 12, 0, 0);
      const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
      const dayName = dayNames[currD.getDay()];
      const isToday = date === todayIso;

      body = `
        <div class="agenda-shell">
          <div class="agenda-header">
            <div class="agenda-title-box">
              <h2>${isToday ? "📅 Agenda de Hoje" : "🗓️ Agenda Diária"} ${isToday ? `<span class="radar-badge-live" style="font-size:.65rem;margin-left:.35rem">HOJE</span>` : ""}</h2>
              <p>${dayName}, ${date.split("-").reverse().join("/")}</p>
            </div>
            <div class="agenda-date-nav">
              <button type="button" class="agenda-date-btn" data-nav-date="${prevStr}" title="Dia anterior (${prevStr})">◀</button>
              <input type="date" id="d" value="${date}" title="Mudar dia da agenda">
              <button type="button" class="agenda-date-btn" data-nav-date="${nextStr}" title="Dia seguinte (${nextStr})">▶</button>
              ${!isToday ? `<button type="button" class="btn btn-ghost" data-nav-date="${todayIso}" style="padding:.25rem .6rem;font-size:.75rem;margin-left:.25rem">Ir para Hoje</button>` : ""}
            </div>
          </div>

          <div class="agenda-stats-bar">
            <div class="agenda-stat-card">
              <span class="agenda-stat-label">Total Agendados</span>
              <span class="agenda-stat-value" style="color:var(--accent)">${scheduledCount}</span>
            </div>
            <div class="agenda-stat-card">
              <span class="agenda-stat-label">Cortes Concluídos</span>
              <span class="agenda-stat-value" style="color:#22c55e">${completedCount}</span>
            </div>
            <div class="agenda-stat-card">
              <span class="agenda-stat-label">Total do Dia (~€)</span>
              <span class="agenda-stat-value">${totalEstimated.toFixed(2)}€</span>
            </div>
          </div>

          ${rows.length === 0 ? `
            <div class="agenda-empty-state">
              <span class="agenda-empty-icon">✂️</span>
              <div class="agenda-empty-title">Nenhum corte marcado para este dia</div>
              <div class="agenda-empty-sub">O horário está completamente livre ou ainda não há marcações registadas para ${date.split("-").reverse().join("/")}.</div>
            </div>
          ` : `
            <div class="agenda-timeline">
              ${rows.map((a) => {
                const st = (a.status || "SCHEDULED").toLowerCase();
                const statusBadge = 
                  a.status === "SCHEDULED" ? `<span class="agenda-status-badge badge-scheduled">⏳ Agendado</span>` :
                  a.status === "COMPLETED" ? `<span class="agenda-status-badge badge-completed">✅ Concluído</span>` :
                  a.status === "CANCELLED" ? `<span class="agenda-status-badge badge-cancelled">❌ Cancelado</span>` :
                  `<span class="agenda-status-badge badge-no_show">⚠️ Não compareceu</span>`;

                return `
                  <article class="agenda-card status-${st}">
                    <div class="agenda-card-time-col">
                      <div class="agenda-time-text">${a.start_time}</div>
                      <div class="agenda-duration-badge">~${a.duration || 45} min</div>
                    </div>

                    <div class="agenda-card-main-col">
                      <div class="agenda-client-name-row">
                        <span class="agenda-client-name">${escapeHtml(a.client_name)}</span>
                        ${statusBadge}
                      </div>

                      <div class="agenda-service-info">
                        <span class="agenda-service-tag">✂️ ${escapeHtml(a.service_name || "Corte")}</span>
                        ${a.is_silent ? `<span class="agenda-pref-pill">🤫 Silencioso</span>` : ""}
                        ${a.music_request ? `<span class="agenda-pref-pill">🎵 ${escapeHtml(a.music_request)}</span>` : ""}
                      </div>

                      <div class="agenda-contact-row">
                        ${a.phone ? `<span>📞 ${escapeHtml(a.phone)}</span>` : ""}
                        ${a.email && !a.email.includes("@instagram.user") ? `<span>✉️ ${escapeHtml(a.email)}</span>` : ""}
                        ${a.email && a.email.includes("@instagram.user") ? `<span>📸 @${escapeHtml(a.email.replace("@instagram.user", ""))}</span>` : ""}
                        ${a.whatsAppUrl ? `
                          <a href="${a.whatsAppUrl}" target="_blank" rel="noopener" class="agenda-wa-btn">
                            💬 Abrir WhatsApp
                          </a>` : ""}
                      </div>
                    </div>

                    <div class="agenda-card-actions-col">
                      ${a.status === "SCHEDULED" ? `
                        <button class="agenda-action-btn agenda-action-done" data-st="${a.id}:COMPLETED" title="Marcar como atendido e creditar fidelização">
                          ✓ Concluir
                        </button>
                        <button class="agenda-action-btn agenda-action-ghost" data-st="${a.id}:NO_SHOW" title="Marcar falta">
                          Falta
                        </button>
                        <button class="agenda-action-btn agenda-action-danger" data-st="${a.id}:CANCELLED" title="Cancelar corte">
                          ✕ Cancelar
                        </button>
                      ` : ""}

                      ${a.status === "CANCELLED" ? `
                        <button class="agenda-action-btn agenda-action-done" data-broadcast="${a.date}:${a.start_time}" title="Notificar lista de espera e utilizadores para esta vaga livre">
                          ⚡ Avisar Clientes da Vaga
                        </button>
                      ` : ""}
                    </div>
                  </article>
                `;
              }).join("")}
            </div>
          `}
        </div>`;
    } else if (tab === "clientes") {
      const rows = await api("/api/admin/clients");
      body = `<table class="table"><tr><th>Nome</th><th>Contacto</th><th>Nível</th><th>Visitas</th></tr>${rows.map((c) => `<tr><td>${c.name}</td><td>${c.email}</td><td>${c.tier}</td><td>${c.visits}</td></tr>`).join("")}</table>`;
    } else if (tab === "compras") {
      const rows = await api("/api/admin/orders");
      body = `
        <h2 class="h2">Reservas da Loja</h2>
        <div class="stack">
          ${rows.length ? rows.map((o) => `
            <article class="card row">
              <div>
                <strong>${o.client_name}</strong> · <span class="price" style="font-size:1.1rem">${Number(o.total).toFixed(2)}€</span> · Estado: <strong>${o.status}</strong>
                <div class="muted" style="margin:.3rem 0">${o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
                ${o.whatsAppUrl ? `<a class="btn-ghost btn" href="${o.whatsAppUrl}" target="_blank" rel="noopener" style="color:#22c55e;border-color:#22c55e;padding:.4rem .8rem;display:inline-flex;align-items:center;gap:.35rem;text-decoration:none">💬 WhatsApp Cliente</a>` : ""}
                ${o.status === "PENDING" ? `<button class="brand-button btn" data-or="${o.id}:ACCEPTED">Aceitar Encomenda</button> <button class="btn-ghost btn" data-or="${o.id}:PAID">Confirmar Pagamento</button> <button class="btn-ghost btn" data-or="${o.id}:CANCELLED" style="color:#ef4444">Cancelar</button>` : ""}
                ${o.status === "ACCEPTED" ? `<button class="brand-button btn" data-or="${o.id}:PAID">Confirmar Pagamento</button> <button class="btn-ghost btn" data-or="${o.id}:CANCELLED" style="color:#ef4444">Cancelar</button>` : ""}
                ${o.status === "PAID" ? `<span class="chip" style="position:static;background:#15803d;color:#fff">Pago</span>` : ""}
                ${o.status === "CANCELLED" ? `<span class="chip" style="position:static">Cancelada</span>` : ""}
              </div>
            </article>`).join("") : "<p class='muted'>Sem reservas de loja registadas.</p>"}
        </div>`;
    } else if (tab === "catalogo") {
      const data = await api("/api/admin/catalog");
      body = `
        <h2 class="h2">Catálogo & Stock</h2>
        <h3>Produtos da Loja</h3>
        <div class="grid-2">
          ${data.products.map((p) => `
            <div class="card row">
              <div style="display:flex;gap:1rem;align-items:center">
                ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:3.5rem;height:3.5rem;object-fit:cover;border-radius:.5rem">` : ""}
                <div>
                  <strong>${p.name}</strong>
                  <div class="muted">Stock: ${p.stock} · ${Number(p.price).toFixed(2)}€ · ${p.category}</div>
                </div>
              </div>
              <button class="btn-ghost btn" data-del-prod="${p.id}" style="color:#ef4444">Eliminar</button>
            </div>`).join("")}
        </div>
        <form class="stack card" id="np" style="margin-top:1.5rem">
          <h4>Adicionar Produto</h4>
          <input name="name" placeholder="Nome do produto" required>
          <input name="price" type="number" step="0.01" placeholder="Preço (€)" required>
          <input name="stock" type="number" placeholder="Stock inicial" value="10">
          <input name="category" placeholder="Categoria (ex: Ceras, Pomadas, Barba)">
          <input name="imageUrl" placeholder="URL da fotografia (opcional)">
          <button class="brand-button btn">Guardar Produto</button>
        </form>

        <h3 style="margin-top:2.5rem">Galeria de Cortes</h3>
        <div class="grid-2">
          ${data.styles.map((s) => `
            <div class="card row">
              <div style="display:flex;gap:1rem;align-items:center">
                ${s.imageUrl ? `<img src="${s.imageUrl}" style="width:3.5rem;height:3.5rem;object-fit:cover;border-radius:.5rem">` : ""}
                <div>
                  <strong>${s.title}</strong>
                  <div class="muted">${s.category} · ❤️ ${s.likes || 0}</div>
                </div>
              </div>
              <button class="btn-ghost btn" data-del-style="${s.id}" style="color:#ef4444">Eliminar</button>
            </div>`).join("")}
        </div>
        <form class="stack card" id="ns" style="margin-top:1.5rem">
          <h4>Adicionar Estilo à Galeria</h4>
          <input name="title" placeholder="Título (ex: Low Taper Fade)" required>
          <input name="category" placeholder="Categoria (ex: Taper Fade, Buzz Cut)" required>
          <input name="imageUrl" placeholder="URL da fotografia" required>
          <button class="brand-button btn">Guardar Estilo</button>
        </form>`;
    } else if (tab === "subs") {
      const rows = await api("/api/admin/subscriptions");
      body = `
        <h2 class="h2">Subscrições do Plano Mensal</h2>
        <div class="stack">
          ${rows.length ? rows.map((s) => `
            <article class="card row">
              <div>
                <strong>${s.client_name}</strong> <span class="muted">(${s.email})</span>
                <div class="muted">Estado: <strong>${s.status}</strong> · Cortes restantes: ${s.cuts_remaining} · Barbas: ${s.beards_remaining}</div>
              </div>
              ${s.status === "PENDING_CASH" ? `<button class="brand-button btn" data-sub="${s.id}">Confirmar Pagamento 40€</button>` : `<span class="chip" style="position:static">Ativo</span>`}
            </article>`).join("") : "<p class='muted'>Sem pedidos de plano mensal.</p>"}
        </div>`;
    } else if (tab === "servicos") {
      const rows = await api("/api/admin/services");
      body = `
        <h2 class="h2">Serviços & Preços</h2>
        <div class="stack">
          ${rows.map((s) => `
            <div class="card row">
              <div>
                <strong>${s.name}</strong>
                <div class="muted">${Number(s.price).toFixed(2)}€ · ⏱ ~${s.duration} min</div>
              </div>
            </div>`).join("")}
        </div>
        <form class="stack card" id="nsv" style="margin-top:1.5rem">
          <h4>Adicionar Novo Serviço</h4>
          <input name="name" placeholder="Nome do serviço" required>
          <input name="price" type="number" step="0.01" placeholder="Preço (€)" required>
          <input name="duration" type="number" placeholder="Duração em minutos" required>
          <button class="brand-button btn">Adicionar Serviço</button>
        </form>`;
    } else if (tab === "heatmap") {
      const rows = await api("/api/admin/heatmap");
      body = `
        <h2 class="h2">Mapa de Procura por Horário</h2>
        <p class="muted">Frequência acumulada de atendimentos marcados.</p>
        <div class="grid-3">
          ${rows.length ? rows.map((r) => `
            <div class="card row">
              <span>🕐 ${r.start_time}</span>
              <strong style="color:var(--accent)">${r.c} cortes</strong>
            </div>`).join("") : "<p class='muted'>Ainda sem histórico suficiente.</p>"}
        </div>

        <form class="stack card" id="block-time-form" style="max-width:32rem;margin-top:2rem">
          <h4>Bloquear Horário / Folga</h4>
          <label>Data</label>
          <input type="date" name="date" required>
          <label>Hora de início</label>
          <input type="time" name="startTime" required>
          <label>Hora de fim</label>
          <input type="time" name="endTime" required>
          <label>Motivo (opcional)</label>
          <input name="reason" placeholder="Ex: Formação, Assuntos pessoais">
          <button class="brand-button btn">Bloquear Horário</button>
        </form>`;
    } else {
      const s = await api("/api/admin/settings");
      body = `
        <h2 class="h2">Definições da Barbearia</h2>
        <form class="stack card" id="set" style="max-width:32rem">
          <label>Abertura</label><input name="openTime" value="${s.openTime}">
          <label>Fecho</label><input name="closeTime" value="${s.closeTime}">
          <label>Almoço início</label><input name="lunchStart" value="${s.lunchStart}">
          <label>Almoço fim</label><input name="lunchEnd" value="${s.lunchEnd}">
          <label>Antecedência mínima (horas)</label><input name="minAdvanceHours" type="number" value="${s.minAdvanceHours}">
          <label>Morada</label><input name="address" value="${s.address}">
          <label>Telefone</label><input name="phone" value="${s.phone}">
          <button class="brand-button btn">Guardar Definições</button>
        </form>`;
    }
    document.getElementById("app").innerHTML = `
      <div class="dashboard">
        <header class="dash-top-bar">
          <div style="display:flex;align-items:center;gap:.65rem">
            <img src="/img/logo.png" alt="Viegas Barber" style="width:2.2rem;height:2.2rem;border-radius:50%;object-fit:cover;box-shadow:0 0 8px rgba(220,38,38,0.4)">
            <div>
              <strong style="color:var(--accent);font-size:.95rem;display:block;line-height:1.2">Viegas Barber</strong>
              <div class="muted" style="font-size:.72rem">Área do Barbeiro</div>
            </div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center">
            <a class="btn btn-ghost" href="/" style="padding:.4rem .7rem;font-size:.78rem">Site público</a>
            <button class="btn-ghost btn" data-logout style="padding:.4rem .7rem;font-size:.78rem">Sair</button>
          </div>
        </header>
        <div class="dash-tabs-scroll">
          ${links.map(([id, label]) => `<a class="dash-tab-chip ${tab === id ? "active" : ""}" href="/dashboard?tab=${id}">${label}</a>`).join("")}
        </div>
        <div class="dash-content-wrap">
          <aside class="sidebar">
            <div>
              <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem">
                <img src="/img/logo.png" alt="Viegas Barber" onerror="this.style.display='none'" style="width:2.8rem;height:2.8rem;border-radius:50%;object-fit:cover;box-shadow:0 0 10px rgba(220,38,38,0.4)">
                <div>
                  <h1 style="color:var(--accent);font-size:1.15rem;margin:0;line-height:1.2">Viegas Barber</h1>
                  <p class="muted" style="margin:0;font-size:.8rem">Área do Barbeiro</p>
                </div>
              </div>
              <nav>${links.map(([id, label]) => `<a class="${tab === id ? "active" : ""}" href="/dashboard?tab=${id}">${label}</a>`).join("")}</nav>
            </div>
            <div><a class="btn btn-ghost" href="/">← Site público</a><p style="margin:.5rem 0">${user.name}<br><span class="chip" style="position:static">${user.role}</span></p><button class="btn-ghost btn" data-logout>Terminar sessão</button></div>
          </aside>
          <main class="dash-main">${body}</main>
        </div>
      </div>`;
    bindChrome();
    document.getElementById("d")?.addEventListener("change", (e) => {
      const val = e.target.value;
      if (!val) return;
      const tabTarget = val === todayIso ? "hoje" : "agenda";
      history.pushState(null, "", `/dashboard?tab=${tabTarget}&date=${val}`);
      pageDashboard();
    });
    document.querySelectorAll("[data-nav-date]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const targetDate = btn.dataset.navDate;
        if (!targetDate) return;
        const tabTarget = targetDate === todayIso ? "hoje" : "agenda";
        history.pushState(null, "", `/dashboard?tab=${tabTarget}&date=${targetDate}`);
        pageDashboard();
      });
    });
    if (!window.__dashPopstateBound) {
      window.__dashPopstateBound = true;
      window.addEventListener("popstate", () => {
        if (document.body.dataset.page === "dashboard") pageDashboard();
      });
    }
    document.querySelectorAll("[data-st]").forEach((b) => {
      b.onclick = async () => {
        const [id, status] = b.dataset.st.split(":");
        await api(`/api/admin/appointments/${id}`, { method: "PATCH", body: { status } });
        pageDashboard();
      };
    });
    document.querySelectorAll("[data-broadcast]").forEach((b) => {
      b.onclick = async () => {
        const [date, time] = b.dataset.broadcast.split(":");
        if (!confirm(`Desejas notificar todos os clientes registados e utilizadores com sininho ativado para a vaga das ${time} de ${date}?`)) return;
        b.disabled = true;
        b.textContent = "A enviar avisos...";
        try {
          const res = await api("/api/admin/broadcast-slot", {
            method: "POST",
            body: { date, time },
          });
          alert(`⚡ Notificações enviadas com sucesso para ${res.notifiedCount || "todos os"} clientes!`);
        } catch (err) {
          alert("Erro ao divulgar vaga: " + (err.message || "Tenta novamente"));
        } finally {
          b.disabled = false;
          b.textContent = "⚡ Avisar Clientes da Vaga";
        }
      };
    });
    document.querySelectorAll("[data-or]").forEach((b) => {
      b.onclick = async () => {
        const [id, status] = b.dataset.or.split(":");
        const res = await api(`/api/admin/orders/${id}`, { method: "PATCH", body: { status } });
        if (status === "ACCEPTED" && res?.whatsAppUrl) {
          if (confirm("Encomenda aceite! Desejas abrir o WhatsApp para avisar o cliente agora?")) {
            window.open(res.whatsAppUrl, "_blank");
          }
        }
        pageDashboard();
      };
    });
    document.querySelectorAll("[data-sub]").forEach((b) => {
      b.onclick = async () => {
        await api(`/api/admin/subscriptions/${b.dataset.sub}`, { method: "PATCH", body: { status: "ACTIVE" } });
        pageDashboard();
      };
    });
    document.getElementById("np")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api("/api/admin/products", { method: "POST", body: Object.fromEntries(fd) });
      pageDashboard();
    });
    document.getElementById("ns")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api("/api/admin/hair-styles", { method: "POST", body: Object.fromEntries(fd) });
      pageDashboard();
    });
    document.getElementById("nsv")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api("/api/admin/services", { method: "POST", body: Object.fromEntries(fd) });
      pageDashboard();
    });
    document.querySelectorAll("[data-del-prod]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("Tem a certeza que deseja eliminar ou desativar este produto?")) return;
        await api(`/api/admin/products/${b.dataset.delProd}`, { method: "DELETE" });
        pageDashboard();
      };
    });
    document.querySelectorAll("[data-del-style]").forEach((b) => {
      b.onclick = async () => {
        if (!confirm("Tem a certeza que deseja eliminar este corte da galeria?")) return;
        await api(`/api/admin/hair-styles/${b.dataset.delStyle}`, { method: "DELETE" });
        pageDashboard();
      };
    });
    document.getElementById("block-time-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api("/api/admin/blocked-times", { method: "POST", body: Object.fromEntries(fd) });
      alert("Horário bloqueado com sucesso.");
      pageDashboard();
    });
    document.getElementById("set")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await api("/api/admin/settings", { method: "PATCH", body: Object.fromEntries(fd) });
      alert("Definições guardadas");
    });
  }

  const pages = {
    home: pageHome,
    diogo: pageDiogo,
    galeria: pageGaleria,
    loja: pageLoja,
    fidelizacao: pageFidelizacao,
    plano: pagePlano,
    marcar: pageMarcar,
    login: pageLogin,
    register: pageRegister,
    marcacoes: pageMarcacoes,
    cortes: pageCortes,
    espera: pageEspera,
    dashboard: pageDashboard,
  };

  async function boot(page) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js?v=19").then((reg) => {
        reg.update();
      }).catch(() => {});
    }
    applyTheme();
    try {
      user = (await api("/api/me")).user;
    } catch {
      user = null;
    }
    if ("Notification" in window && Notification.permission === "granted") {
      registerWebPushSubscription();
    }
    if (user) {
      startNotificationPoller();
    }
    document.body.dataset.page = page;
    await pages[page]();
    if (page !== "login" && page !== "register" && page !== "dashboard" && page !== "marcar") bindChrome();
    if (page === "dashboard" || page === "marcar") return;
  }

  return { boot };
})();
