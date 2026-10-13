require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { initDb, db } = require("./db");
const { seed } = require("./seed");
const {
  id,
  normalizeInstagramHandle,
  instagramLoginEmail,
  loyaltyTierForVisits,
  todayDate,
  maxBookableDate,
  isDateWithinBookingWindow,
  bookingWindowMessage,
  isNighttimeBlocked,
  NIGHTTIME_BLOCK_MESSAGE,
  timeToMinutes,
  minutesToTime,
  normalizeText,
  isStaff,
  mediaUrl,
  getDaySchedule,
  WEEK_SCHEDULE,
  buildWhatsAppLink,
  formatBookingNotification,
  formatOrderNotification,
  formatWaitlistNotification,
  formatOrderAcceptedNotification,
} = require("./lib");
const { sendWhatsAppMessage } = require("./whatsapp");
const webpush = require("web-push");
const NoSQLSessionStore = require("./session-store");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BEvtzUzhSofKx53OVg2gTvRYsdm_5E_xuUYB0VsoHedPcWBVVi13jgCenuiZU4NdXsDudtp9UH691RhiHCMuM3Q";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "movji9uI68Tl1U1NKDbtTPRiQwTFgxCkSMkBCAc2SWY";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:suporte@viegasbarber.pt";

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const app = express();
app.set("trust proxy", 1);
const SESSION_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 ano inteiro de persistência contínua
const www = path.join(__dirname, "..", "www");

app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ extended: true, limit: "16mb" }));
const crypto = require("crypto");
const AUTH_SECRET = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "viegas-barber-secret-2026";

function createAuthToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      t: Date.now(),
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  if (signature !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data;
  } catch {
    return null;
  }
}

function getCookieValue(req, name) {
  const header = req.headers.cookie || "";
  const match = header.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

const isProduction = process.env.NODE_ENV === "production" || !!process.env.RENDER;

app.use(
  session({
    name: "viegas.sid",
    secret: AUTH_SECRET,
    store: new NoSQLSessionStore({ ttl: SESSION_MAX_AGE }),
    resave: false,
    saveUninitialized: false,
    rolling: true, // Renova o prazo a cada visita do Viegas
    cookie: {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction ? true : "auto",
    },
  })
);

// Middleware de Autenticação Permanente por Token (Garante que no iPhone / PWA o Viegas NUNCA perde a sessão)
app.use((req, res, next) => {
  if (req.session && req.session.user) return next();

  const authHeader = req.headers.authorization || "";
  let token = null;
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (req.headers["x-auth-token"]) {
    token = req.headers["x-auth-token"];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else {
    token = getCookieValue(req, "vb_token");
  }

  if (token) {
    const verified = verifyAuthToken(token);
    if (verified && verified.id) {
      req.session.user = {
        id: verified.id,
        name: verified.name,
        email: verified.email,
        role: verified.role,
      };
    }
  }
  next();
});

app.use(
  express.static(www, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css") || filePath.endsWith("sw.js")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  })
);
app.use(express.static(path.join(__dirname, "..", "public")));

function currentUser(req) {
  return req.session.user || null;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Inicia sessão." });
  next();
}

function requireStaff(req, res, next) {
  if (!isStaff(req.session.user)) return res.status(403).json({ error: "Acesso reservado ao barbeiro." });
  next();
}

async function getSettings() {
  const settings = await db.settings().findOne({ id: "default" });
  return {
    minAdvanceHours: typeof settings?.minAdvanceHours === "number" ? settings.minAdvanceHours : 4,
    lunchStart: settings?.lunchStart || "13:00",
    lunchEnd: settings?.lunchEnd || "13:30",
    barberName: settings?.barberName || "Diogo Viegas",
    shopName: settings?.shopName || "Viegas Barber",
    address: settings?.address || "Centro comercial São Julião , Setúbal",
    phone: settings?.phone || "+351 939 504 261",
    whatsapp: settings?.whatsapp || "+351 939 504 261",
    instagram: settings?.instagram || "v_barber8",
    schedule: settings?.schedule || WEEK_SCHEDULE,
    openTime: settings?.openTime || "09:00",
    closeTime: settings?.closeTime || "19:00",
  };
}

async function userVisits(userId) {
  const loyalty = await db.loyalty().findOne({ user_id: userId });
  return loyalty?.visits || 0;
}

async function sendPushToUser(userId, payload) {
  try {
    const subs = await db.push_subscriptions().find({ user_id: userId }).toArray();
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or unregistered by browser
          await db.push_subscriptions().deleteOne({ id: sub.id });
        } else {
          console.error("Erro ao enviar push:", err.message);
        }
      }
    }
  } catch (error) {
    console.error("Erro ao procurar subscrições de push:", error.message);
  }
}

async function broadcastPush(payload, excludeUserId = null) {
  try {
    const filter = excludeUserId ? { user_id: { $ne: excludeUserId } } : {};
    const subs = await db.push_subscriptions().find(filter).toArray();
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.push_subscriptions().deleteOne({ id: sub.id });
        }
      }
    }
  } catch (error) {
    console.error("Erro ao enviar broadcast push:", error.message);
  }
}

async function notify(userId, title, message, type = "INFO", actionUrl = null, dedupeKey = null) {
  try {
    if (dedupeKey) {
      const existing = await db.notifications().findOne({ dedupe_key: dedupeKey });
      if (existing) return;
    }
    await db.notifications().insertOne({
      id: id(),
      user_id: userId,
      title,
      message,
      type,
      action_url: actionUrl,
      dedupe_key: dedupeKey,
      read: false,
      created_at: new Date().toISOString(),
    });

    // Enviar notificação Web Push direta (mesmo com PWA fechada ou ecrã bloqueado)
    await sendPushToUser(userId, {
      title,
      message,
      body: message,
      url: actionUrl || "/",
      type,
    });
  } catch (error) {
    console.error("Erro ao criar notificação:", error.message);
  }
}

async function checkAndNotifyFullDay(date) {
  try {
    const sched = getDaySchedule(date);
    if (sched.closed) return;

    const settings = await getSettings();
    const openMin = timeToMinutes(sched.open);
    const closeMin = timeToMinutes(sched.close);
    const lunchStart = timeToMinutes(settings.lunchStart);
    const lunchEnd = timeToMinutes(settings.lunchEnd);

    const appts = await db.appointments().find({ date, status: "SCHEDULED" }).toArray();
    const blocked = await db.blocked_times().find({ date }).toArray();

    let freeCount = 0;
    for (let mins = openMin; mins + 50 <= closeMin; mins += 60) {
      const end = mins + 50;
      if (closeMin > lunchEnd && overlaps(mins, end, lunchStart, lunchEnd)) continue;
      const timeStr = minutesToTime(mins);
      if (new Date(`${date}T${timeStr}:00`).getTime() < Date.now()) continue;

      const busy =
        appts.some((a) => overlaps(mins, end, timeToMinutes(a.start_time), timeToMinutes(a.end_time))) ||
        blocked.some((b) => overlaps(mins, end, timeToMinutes(b.start_time), timeToMinutes(b.end_time)));
      if (!busy) freeCount++;
    }

    // Se não houver vagas livres restantes e tiver agendamentos marcados
    if (freeCount === 0 && appts.length > 0) {
      const dateObj = new Date(`${date}T12:00:00`);
      const formattedDate = dateObj.toLocaleDateString("pt-PT", { day: "numeric", month: "long" });
      const dedupeKey = `full_day_${date}`;

      const staffMembers = await db.users().find({ role: { $in: ["ADMIN", "BARBER"] } }).toArray();
      for (const staff of staffMembers) {
        await notify(
          staff.id,
          "🔥 Agenda Lotada!",
          `No dia ${formattedDate} já tens a agenda cheia! Todas as vagas do dia estão reservadas.`,
          "AGENDA_FULL",
          `/dashboard?tab=agenda&date=${date}`,
          dedupeKey
        );
      }
    }
  } catch (err) {
    console.error("Erro ao verificar agenda cheia:", err);
  }
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function offerNextWaitlistEntry(date, startTime) {
  const startMinutes = timeToMinutes(startTime);
  const slotDate = new Date(`${date}T${startTime}:00`);
  if (!Number.isFinite(slotDate.getTime()) || slotDate <= new Date()) return null;

  const daySched = getDaySchedule(date);
  if (daySched.closed) return null;

  const settings = await getSettings();
  const closeMinutes = timeToMinutes(daySched.close);
  const lunchStart = timeToMinutes(settings.lunchStart);
  const lunchEnd = timeToMinutes(settings.lunchEnd);

  // Check if an active offer already exists for this slot
  const nowIso = new Date().toISOString();
  const activeOffer = await db.waitlist().findOne({
    date,
    time_slot: startTime,
    notified: true,
    offer_expires_at: { $gt: nowIso },
  });
  if (activeOffer) return null;

  const appointments = await db.appointments().find({ date, status: "SCHEDULED" }).toArray();
  const blocked = await db.blocked_times().find({ date }).toArray();

  const allCandidates = await db.waitlist().find({
    date,
    notified: false,
    $or: [{ time_slot: null }, { time_slot: startTime }],
  }).toArray();

  if (!allCandidates.length) return null;

  // Enrich candidates with service and loyalty tier
  for (const candidate of allCandidates) {
    if (candidate.service_id) {
      const s = await db.services().findOne({ id: candidate.service_id });
      candidate.service_name = s?.name || "Corte";
      candidate.duration = s?.duration || 30;
    }
    const l = await db.loyalty().findOne({ user_id: candidate.user_id });
    candidate.tier = l?.tier || "Bronze";
  }

  const tierPriority = { VIP: 0, Ouro: 1, Prata: 2, Bronze: 3 };
  allCandidates.sort((a, b) => {
    const diff = (tierPriority[a.tier] ?? 3) - (tierPriority[b.tier] ?? 3);
    if (diff !== 0) return diff;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

  for (const candidate of allCandidates) {
    if (!candidate.service_id || !candidate.duration) continue;
    const endMinutes = startMinutes + candidate.duration * (candidate.is_duo ? 2 : 1);
    const conflictAppt = appointments.some((a) =>
      overlaps(startMinutes, endMinutes, timeToMinutes(a.start_time), timeToMinutes(a.end_time))
    );
    const conflictBlock = blocked.some((b) =>
      overlaps(startMinutes, endMinutes, timeToMinutes(b.start_time), timeToMinutes(b.end_time))
    );
    const conflictLunch = closeMinutes > lunchEnd && overlaps(startMinutes, endMinutes, lunchStart, lunchEnd);
    if (conflictAppt || conflictBlock || endMinutes > closeMinutes || conflictLunch) {
      continue;
    }

    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await db.waitlist().updateOne(
      { id: candidate.id, notified: false },
      { $set: { notified: true, time_slot: startTime, offer_expires_at: expires } }
    );

    await notify(
      candidate.user_id,
      "⚡ Vaga Flash disponível!",
      `O corte anterior foi cancelado! Surgiu uma vaga para ${candidate.service_name} no dia ${new Date(date).toLocaleDateString("pt-PT")} às ${startTime}. Queres vir? Tens 10 minutos para a aceitar.`,
      "VACANCY",
      `/espera.html?id=${candidate.id}`
    );

    const candUser = await db.users().findOne({ id: candidate.user_id });
    if (candUser?.phone) {
      const waMsg = formatWaitlistNotification({
        serviceName: candidate.service_name,
        date: new Date(date).toLocaleDateString("pt-PT"),
        timeSlot: startTime,
      });
      await sendWhatsAppMessage(candUser.phone, waMsg);
    }
    return candidate.id;
  }
  return null;
}

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  if (user) {
    const token = createAuthToken(user);
    return res.json({ user, token });
  }
  res.json({ user: null });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    if (!identifier || !password) return res.status(400).json({ error: "Utilizador ou palavra-passe incorretos." });

    let user;
    if (identifier === "admin") {
      user = await db.users().findOne({ role: "ADMIN" });
    } else {
      user = await db.users().findOne({ email: identifier });
    }

    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Utilizador ou palavra-passe da Viegas Barber incorretos." });
    }

    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = createAuthToken(user);
    res.cookie("vb_token", token, {
      maxAge: SESSION_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
      httpOnly: false,
    });
    res.cookie("vb_user", JSON.stringify(req.session.user), {
      maxAge: SESSION_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
      httpOnly: false,
    });
    res.json({ user: req.session.user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Não foi possível iniciar sessão." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("vb_token", { path: "/" });
  res.clearCookie("vb_user", { path: "/" });
  res.clearCookie("viegas.sid", { path: "/" });
  req.session.destroy(() => res.json({ ok: true }));
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const loginMethod = req.body.loginMethod;
    const rawEmail = String(req.body.email || "").trim().toLowerCase();
    const rawHandle = String(req.body.instagramHandle || "");
    const password = String(req.body.password || "");

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ message: "O nome deve ter entre 2 e 80 caracteres" });
    }

    let email;
    if (loginMethod === "instagram") {
      const handle = normalizeInstagramHandle(rawHandle);
      if (!handle) return res.status(400).json({ message: "Introduz um @ de Instagram válido" });
      if (handle === "admin") return res.status(409).json({ message: "Este utilizador está reservado para a conta do barbeiro" });
      email = instagramLoginEmail(handle);
    } else if (loginMethod === "gmail") {
      if (rawEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        return res.status(400).json({ message: "Introduz um endereço de email válido" });
      }
      email = rawEmail;
    } else {
      return res.status(400).json({ message: "Escolhe entrar com Instagram ou email" });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: "A palavra-passe deve ter entre 8 e 128 caracteres" });
    }

    const existing = await db.users().findOne({ email });
    if (existing) {
      return res.status(409).json({
        message:
          loginMethod === "instagram"
            ? "Este @ já tem uma conta Viegas Barber. Inicia sessão ou contacta a barbearia para recuperar o acesso."
            : "Este email já está registado",
      });
    }

    const hashed = await bcrypt.hash(password, 12);
    const userId = id();
    await db.users().insertOne({
      id: userId,
      name,
      email,
      password: hashed,
      role: "CLIENT",
      has_subscription: false,
      created_at: new Date().toISOString(),
    });

    req.session.user = { id: userId, name, email, role: "CLIENT" };
    const token = createAuthToken(req.session.user);
    res.cookie("vb_token", token, {
      maxAge: SESSION_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
      httpOnly: false,
    });
    res.cookie("vb_user", JSON.stringify(req.session.user), {
      maxAge: SESSION_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: isProduction,
      httpOnly: false,
    });
    res.status(201).json({ message: "Conta criada com sucesso", user: req.session.user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Ocorreu um erro ao criar a conta" });
  }
});

// -------------------------------------------------------------
// Public & Client Endpoints
// -------------------------------------------------------------

app.get("/api/home", async (_req, res) => {
  const [services, styles, products, settings, allReviews] = await Promise.all([
    db.services().find({ isActive: true }).sort({ price: 1 }).toArray(),
    db.hair_styles().find({}).sort({ likes: -1 }).limit(8).toArray(),
    db.products().find({}).limit(3).toArray(),
    getSettings(),
    db.reviews().find({ is_private: { $ne: true } }).sort({ created_at: -1 }).limit(6).toArray(),
  ]);

  // Enrich reviews with user name and service name
  const reviews = [];
  for (const r of allReviews) {
    const u = await db.users().findOne({ id: r.user_id });
    const appt = await db.appointments().findOne({ id: r.appointment_id });
    const s = appt ? await db.services().findOne({ id: appt.service_id }) : null;
    reviews.push({
      rating: r.rating,
      comment: r.comment,
      user_name: u?.name || "Cliente",
      service_name: s?.name || "Corte",
    });
  }

  res.json({
    services,
    styles: styles.map((s) => ({ ...s, imageUrl: mediaUrl(s.imageUrl || s.image_url) })),
    products: products.map((p) => ({ ...p, imageUrl: mediaUrl(p.imageUrl || p.image_url) })),
    settings,
    reviews,
  });
});

app.get("/api/services", async (_req, res) => {
  const services = await db.services().find({ isActive: true }).sort({ price: 1 }).toArray();
  res.json(services);
});

app.get("/api/gallery", async (_req, res) => {
  const styles = await db.hair_styles().find({}).sort({ likes: -1 }).toArray();
  res.json(styles.map((s) => ({ ...s, imageUrl: mediaUrl(s.imageUrl || s.image_url) })));
});

app.post("/api/gallery/:id/like", async (req, res) => {
  await db.hair_styles().updateOne({ id: req.params.id }, { $inc: { likes: 1 } });
  const updated = await db.hair_styles().findOne({ id: req.params.id });
  res.json({ likes: updated?.likes || 0 });
});

app.get("/api/products", async (_req, res) => {
  const products = await db.products().find({}).sort({ created_at: -1 }).toArray();
  res.json(products.map((p) => ({ ...p, imageUrl: mediaUrl(p.imageUrl || p.image_url) })));
});

app.get("/api/rewards", async (_req, res) => {
  const rewards = await db.rewards().find({ isActive: true }).sort({ pointsCost: 1 }).toArray();
  res.json(rewards);
});

app.get("/api/loyalty", requireAuth, async (req, res) => {
  const loyalty = (await db.loyalty().findOne({ user_id: req.session.user.id })) || { points: 0, visits: 0, tier: "Bronze" };
  loyalty.tier = loyaltyTierForVisits(loyalty.visits || 0);
  res.json(loyalty);
});

app.get("/api/appointments/availability", async (req, res) => {
  try {
    const dateStr = String(req.query.date || "");
    const serviceId = String(req.query.serviceId || "");
    const isDuo = req.query.duo === "true";

    if (!dateStr || !serviceId) return res.status(400).json({ error: "Data e serviço são obrigatórios" });

    const daySched = getDaySchedule(dateStr);
    if (daySched.closed) {
      return res.json({ availableTimes: [], maxDate: maxBookableDate(false), today: todayDate(), message: "A barbearia está encerrada aos domingos." });
    }

    const service = await db.services().findOne({ id: serviceId });
    if (!service) return res.status(404).json({ error: "Serviço não encontrado" });

    const visits = req.session.user ? await userVisits(req.session.user.id) : 0;
    const isVip = loyaltyTierForVisits(visits) === "VIP";
    const isBairro = req.query.bairro === "true";
    if (!isBairro && !isDateWithinBookingWindow(dateStr, isVip)) {
      return res.status(400).json({ error: bookingWindowMessage() });
    }
    if (isBairro && dateStr < todayDate()) {
      return res.status(400).json({ error: "A data selecionada já passou." });
    }

    const settings = await getSettings();
    const openMinutes = timeToMinutes(daySched.open);
    const closeMinutes = timeToMinutes(daySched.close);
    const lunchStart = timeToMinutes(settings.lunchStart);
    const lunchEnd = timeToMinutes(settings.lunchEnd);
    const earliest = Date.now();
    const isNight = isNighttimeBlocked();

    const appointments = await db.appointments().find({ date: dateStr, status: "SCHEDULED" }).toArray();
    const blocked = await db.blocked_times().find({ date: dateStr }).toArray();
    const slotDuration = 50 * (isDuo ? 2 : 1);

    const availableTimes = [];
    // Vagas de 1 em 1 hora (passo de 60 min: 09:00, 10:00, 11:00, 12:00, 14:00, 15:00, 16:00, 17:00, 18:00)
    for (let mins = openMinutes; mins + slotDuration <= closeMinutes; mins += 60) {
      const end = mins + slotDuration;
      // Salta se colidir com o almoço (13:00 - 13:30)
      if (closeMinutes > lunchEnd && overlaps(mins, end, lunchStart, lunchEnd)) continue;
      const startStr = minutesToTime(mins);
      if (new Date(`${dateStr}T${startStr}:00`).getTime() < earliest) continue;
      const busy =
        appointments.some((a) => overlaps(mins, end, timeToMinutes(a.start_time), timeToMinutes(a.end_time))) ||
        blocked.some((b) => overlaps(mins, end, timeToMinutes(b.start_time), timeToMinutes(b.end_time)));
      if (!busy) availableTimes.push(startStr);
    }

    res.json({
      availableTimes: isNight ? [] : availableTimes,
      isNightBlocked: isNight,
      nightMessage: isNight ? NIGHTTIME_BLOCK_MESSAGE : null,
      maxDate: maxBookableDate(isVip),
      today: todayDate(),
      schedule: daySched,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar horários" });
  }
});

app.post("/api/appointments", async (req, res) => {
  try {
    if (isNighttimeBlocked()) {
      return res.status(400).json({ error: NIGHTTIME_BLOCK_MESSAGE });
    }

    const body = req.body || {};
    const serviceId = body.serviceId;
    const date = body.date;
    const startTime = body.startTime;
    const isDuo = body.isDuo === true;
    const companionName = typeof body.companionName === "string" ? body.companionName.trim().slice(0, 100) : "";
    const styleRef = body.styleRef || body.styleReference;
    const isSilent = body.isSilent === true;
    const musicRequest = typeof body.musicRequest === "string" ? body.musicRequest.trim().slice(0, 160) : "";
    const clientName = body.clientName || body.guestName || body.name || req.session.user?.name;
    const clientEmail = (body.clientEmail || body.guestEmail || body.email || req.session.user?.email || "").toLowerCase().trim();
    const clientPhone = body.clientPhone || body.guestPhone || body.phone;

    if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime || "")) {
      return res.status(400).json({ error: "Serviço, data ou hora inválidos" });
    }
    if (isDuo && !companionName) {
      return res.status(400).json({ error: "Indica o nome da segunda pessoa para a marcação Duo." });
    }

    const daySched = getDaySchedule(date);
    if (daySched.closed) {
      return res.status(400).json({ error: "A barbearia está encerrada aos domingos." });
    }

    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({ error: "Precisas de ter sessão iniciada para marcar um corte. Inicia sessão ou cria a tua conta." });
    }
    const targetUserId = req.session.user.id;

    const service = await db.services().findOne({ id: serviceId, isActive: true });
    if (!service) return res.status(404).json({ error: "Serviço não encontrado ou indisponível" });

    const visits = await userVisits(targetUserId);
    if (!isDateWithinBookingWindow(date, loyaltyTierForVisits(visits) === "VIP")) {
      return res.status(400).json({ error: bookingWindowMessage() });
    }

    const startMins = timeToMinutes(startTime);
    const slotDurationPerPerson = 50;
    const totalSlotDuration = slotDurationPerPerson * (isDuo ? 2 : 1);
    const endMins = startMins + totalSlotDuration;
    const endTime = minutesToTime(endMins);
    const settings = await getSettings();
    const slotMs = new Date(`${date}T${startTime}:00`).getTime();

    const openMinutes = timeToMinutes(daySched.open);
    const closeMinutes = timeToMinutes(daySched.close);
    const lunchEnd = timeToMinutes(settings.lunchEnd);

    if (
      startMins < openMinutes ||
      endMins > closeMinutes ||
      (closeMinutes > lunchEnd && overlaps(startMins, endMins, timeToMinutes(settings.lunchStart), lunchEnd))
    ) {
      return res.status(400).json({ error: `Horário indisponível. Horário à ${daySched.label}: ${daySched.open} às ${daySched.close}.` });
    }

    if (slotMs < Date.now()) {
      return res.status(400).json({ error: "Este horário já passou. Por favor escolhe um horário futuro." });
    }

    // Check collision with existing appointments or blocked times
    const appts = await db.appointments().find({ date, status: "SCHEDULED" }).toArray();
    const blocked = await db.blocked_times().find({ date }).toArray();
    if (
      appts.some((a) => overlaps(startMins, endMins, timeToMinutes(a.start_time), timeToMinutes(a.end_time))) ||
      blocked.some((b) => overlaps(startMins, endMins, timeToMinutes(b.start_time), timeToMinutes(b.end_time)))
    ) {
      return res.status(409).json({ error: "Este horário acabou de ser reservado por outro cliente. Por favor escolhe outra hora." });
    }

    let subscriptionId = null;
    if (req.session.user?.id === targetUserId) {
      const serviceName = service.name.toLocaleLowerCase("pt-PT");
      const isBeard = serviceName.includes("barba");
      const isHair = /corte|cabelo|fade|buzz|tesoura/.test(serviceName);
      if (isBeard || isHair) {
        const sub = await db.subscriptions().findOne({
          user_id: targetUserId,
          status: "ACTIVE",
          ends_at: { $gt: new Date().toISOString() },
        });
        const credits = isDuo ? 2 : 1;
        const hasCredits =
          sub && (!isBeard || sub.beards_remaining >= credits) && (!isHair || sub.cuts_remaining >= credits);
        if (sub && hasCredits) {
          await db.subscriptions().updateOne(
            { id: sub.id },
            {
              $inc: {
                cuts_remaining: isHair ? -credits : 0,
                beards_remaining: isBeard ? -credits : 0,
              },
            }
          );
          subscriptionId = sub.id;
        }
      }
    }

    const firstId = id();
    const firstEnd = minutesToTime(startMins + slotDurationPerPerson);
    const duoGroupId = isDuo ? id() : null;

    await db.appointments().insertOne({
      id: firstId,
      user_id: targetUserId,
      service_id: service.id,
      date,
      start_time: startTime,
      end_time: firstEnd,
      status: "SCHEDULED",
      style_ref: styleRef || null,
      is_silent: isSilent,
      music_request: musicRequest || null,
      companion_name: isDuo ? companionName : null,
      duo_group_id: duoGroupId,
      subscription_id: subscriptionId,
      loyalty_awarded: false,
      created_at: new Date().toISOString(),
    });

    if (isDuo) {
      const secondId = id();
      const secondStart = firstEnd;
      await db.appointments().insertOne({
        id: secondId,
        user_id: targetUserId,
        service_id: service.id,
        date,
        start_time: secondStart,
        end_time: endTime,
        status: "SCHEDULED",
        style_ref: styleRef || null,
        is_silent: isSilent,
        music_request: musicRequest || null,
        companion_name: clientName?.trim() || req.session.user?.name || "Acompanhante",
        companion_id: firstId,
        duo_group_id: duoGroupId,
        subscription_id: subscriptionId,
        loyalty_awarded: false,
        created_at: new Date().toISOString(),
      });
      await db.appointments().updateOne({ id: firstId }, { $set: { companion_id: secondId } });
      await notify(
        targetUserId,
        "Marcação Duo Confirmada! ✂️",
        `Duas sessões de ${service.name} estão confirmadas para ${new Date(date).toLocaleDateString("pt-PT")} às ${startTime}. O Diogo estará à tua espera!`,
        "BOOKING"
      );
    } else {
      await notify(
        targetUserId,
        "Marcação Confirmada! ✂️",
        `O teu corte (${service.name}) está confirmado para ${new Date(date).toLocaleDateString("pt-PT")} às ${startTime}. O Diogo estará à tua espera!`,
        "BOOKING"
      );
    }

    const targetUser = await db.users().findOne({ id: targetUserId });
    const barberUser = await db.users().findOne({ role: "ADMIN" });
    const waMessage = formatBookingNotification({
      clientName: targetUser?.name || clientName,
      clientPhone: targetUser?.phone || clientPhone,
      serviceName: service.name,
      date,
      startTime,
      isSilent,
      musicRequest,
      isDuo,
      companionName,
    });
    const barberPhone = settings.whatsapp || settings.phone || "939504261";
    const whatsAppUrl = buildWhatsAppLink(barberPhone, waMessage);

    const staffMembers = await db.users().find({ role: { $in: ["ADMIN", "BARBER"] } }).toArray();
    for (const staff of staffMembers) {
      await notify(
        staff.id,
        "✂️ Nova Marcação Recebida!",
        `${targetUser?.name || "Cliente"} agendou ${service.name} para ${date} às ${startTime}.${isSilent ? " (Modo Silencioso 🤫)" : ""}`,
        "BOOKING",
        `/dashboard?tab=agenda&date=${date}`
      );
    }

    // Verificar se o dia ficou lotado
    await checkAndNotifyFullDay(date);

    // Disparo automático WhatsApp (se API configurada em .env)
    await sendWhatsAppMessage(barberPhone, waMessage);
    const clientTel = targetUser?.phone || clientPhone;
    if (clientTel) {
      const clientConfirm = `✂️ *Viegas Barber - Marcação Confirmada!*\n\nOlá ${targetUser?.name || clientName}! O teu corte (*${service.name}*) está confirmado para *${new Date(date).toLocaleDateString("pt-PT")}* às *${startTime}* com o Diogo Viegas.\n\nMorada: ${settings.address || "Centro comercial São Julião, Setúbal"}\nAté já!`;
      await sendWhatsAppMessage(clientTel, clientConfirm);
    }

    res.json({ success: true, subscriptionId, whatsAppUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao efetuar marcação" });
  }
});

app.get("/api/appointments/mine", requireAuth, async (req, res) => {
  const rows = await db.appointments().find({ user_id: req.session.user.id }).sort({ date: -1, start_time: -1 }).toArray();
  for (const a of rows) {
    const s = await db.services().findOne({ id: a.service_id });
    const r = await db.reviews().findOne({ appointment_id: a.id });
    a.service_name = s?.name || "Corte";
    a.price = s?.price || 0;
    a.duration = s?.duration || 30;
    a.review_id = r?.id || null;
    a.rating = r?.rating || null;
  }
  res.json(rows);
});

app.post("/api/appointments/:id/cancel", requireAuth, async (req, res) => {
  const appt = await db.appointments().findOne({ id: req.params.id, user_id: req.session.user.id });
  if (!appt) return res.status(404).json({ error: "Marcação não encontrada" });
  if (appt.status !== "SCHEDULED") return res.status(400).json({ error: "Esta marcação já não pode ser cancelada." });

  await db.appointments().updateOne({ id: appt.id }, { $set: { status: "CANCELLED" } });
  if (appt.duo_group_id) {
    await db.appointments().updateMany({ duo_group_id: appt.duo_group_id, status: "SCHEDULED" }, { $set: { status: "CANCELLED" } });
  }

  const clientUser = await db.users().findOne({ id: req.session.user.id });
  const staffMembers = await db.users().find({ role: { $in: ["ADMIN", "BARBER"] } }).toArray();
  for (const staff of staffMembers) {
    await notify(
      staff.id,
      "⚠️ Marcação Cancelada",
      `${clientUser?.name || "Cliente"} cancelou o corte de ${appt.date} às ${appt.start_time}. A vaga foi libertada!`,
      "CANCELLATION",
      `/dashboard?tab=agenda&date=${appt.date}`
    );
  }
  await notify(
    req.session.user.id,
    "Marcação Cancelada",
    `A tua marcação para ${appt.date} às ${appt.start_time} foi cancelada com sucesso.`,
    "CANCELLATION"
  );

  await offerNextWaitlistEntry(appt.date, appt.start_time);
  res.json({ ok: true });
});

app.post("/api/waitlist", requireAuth, async (req, res) => {
  const date = req.body.date;
  const serviceId = req.body.serviceId;
  const isDuo = req.body.isDuo === true;
  if (!date || !serviceId) return res.status(400).json({ error: "Data e serviço são obrigatórios." });

  await db.waitlist().insertOne({
    id: id(),
    user_id: req.session.user.id,
    service_id: serviceId,
    date,
    is_duo: isDuo,
    notified: false,
    created_at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

app.get("/api/waitlist/:id", requireAuth, async (req, res) => {
  const offer = await db.waitlist().findOne({ id: req.params.id, user_id: req.session.user.id });
  if (!offer) return res.status(404).json({ error: "Oferta não encontrada" });
  const s = await db.services().findOne({ id: offer.service_id });
  offer.service_name = s?.name || "Corte";
  res.json(offer);
});

app.post("/api/waitlist/accept", requireAuth, async (req, res) => {
  const waitId = req.body.id;
  const offer = await db.waitlist().findOne({ id: waitId, user_id: req.session.user.id });
  if (!offer) return res.status(404).json({ error: "Oferta não encontrada" });
  if (!offer.notified || !offer.time_slot || !offer.offer_expires_at || new Date(offer.offer_expires_at) < new Date()) {
    return res.status(400).json({ error: "Esta oferta já expirou." });
  }

  await db.waitlist().deleteOne({ id: waitId });
  req.body.serviceId = offer.service_id;
  req.body.date = offer.date;
  req.body.startTime = offer.time_slot;
  req.body.isDuo = Boolean(offer.is_duo);
  req.url = "/api/appointments";
  req.method = "POST";
  return app.handle(req, res);
});

app.post("/api/reviews", requireAuth, async (req, res) => {
  const { appointmentId, rating, comment, privateNotes, topLengthFeedback, beardLineFeedback } = req.body;
  const appt = await db.appointments().findOne({ id: appointmentId, user_id: req.session.user.id });
  if (!appt) return res.status(404).json({ error: "Marcação não encontrada" });
  if (appt.status !== "COMPLETED") return res.status(400).json({ error: "Só podes avaliar um serviço concluído." });
  if (appt.review_available_at && new Date(appt.review_available_at) > new Date()) {
    return res.status(400).json({ error: "O feedback fica disponível 24 horas depois do serviço." });
  }

  await db.reviews().updateOne(
    { appointment_id: appointmentId },
    {
      $set: {
        appointment_id: appointmentId,
        user_id: req.session.user.id,
        rating: Number(rating) || 5,
        comment: comment || null,
        private_notes: privateNotes || null,
        top_length_feedback: topLengthFeedback || null,
        beard_line_feedback: beardLineFeedback || null,
        is_private: true,
      },
    },
    { upsert: true }
  );

  const loyalty = await db.loyalty().findOne({ user_id: req.session.user.id });
  if (loyalty) {
    await db.loyalty().updateOne({ user_id: req.session.user.id }, { $inc: { points: 20 } });
  } else {
    await db.loyalty().insertOne({
      id: id(),
      user_id: req.session.user.id,
      points: 20,
      visits: 0,
      tier: "Bronze",
    });
  }
  res.json({ ok: true });
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Escolhe pelo menos um produto." });
  try {
    let total = 0;
    const resolved = [];
    for (const item of items) {
      const product = await db.products().findOne({ id: item.productId });
      if (!product) throw new Error("Produto inválido");
      const qty = Math.max(1, Number(item.quantity) || 1);
      if (product.stock < qty) throw new Error(`Stock insuficiente para ${product.name}`);
      total += Number(product.price) * qty;
      resolved.push({ product, qty });
    }

    const oid = id();
    const orderItems = [];
    for (const { product, qty } of resolved) {
      orderItems.push({
        id: id(),
        product_id: product.id,
        name: product.name,
        quantity: qty,
        price: product.price,
      });
      await db.products().updateOne({ id: product.id }, { $inc: { stock: -qty } });
    }

    await db.orders().insertOne({
      id: oid,
      user_id: req.session.user.id,
      total,
      status: "PENDING",
      items: orderItems,
      created_at: new Date().toISOString(),
    });

    const clientUser = await db.users().findOne({ id: req.session.user.id });
    const barberUser = await db.users().findOne({ role: "ADMIN" });
    const settings = await getSettings();
    const waOrderMsg = formatOrderNotification({
      clientName: clientUser?.name || "Cliente",
      clientPhone: clientUser?.phone || null,
      items: orderItems,
      total,
    });
    const barberPhone = settings.whatsapp || settings.phone || "939504261";
    const whatsAppUrl = buildWhatsAppLink(barberPhone, waOrderMsg);

    const staffMembers = await db.users().find({ role: { $in: ["ADMIN", "BARBER"] } }).toArray();
    for (const staff of staffMembers) {
      await notify(
        staff.id,
        "🛍️ Nova Reserva na Loja!",
        `${clientUser?.name || "Cliente"} reservou ${orderItems.length} produto(s) no total de ${Number(total).toFixed(2)}€. Paga no balcão.`,
        "ORDER",
        "/dashboard?tab=compras"
      );
    }
    await notify(
      req.session.user.id,
      "🛍️ Reserva Efetuada com Sucesso",
      `A tua reserva de ${orderItems.length} produto(s) no total de ${Number(total).toFixed(2)}€ foi registada. Levantamento e pagamento no balcão com o Diogo.`,
      "ORDER",
      "/loja"
    );

    // Disparo automático WhatsApp (se API configurada em .env)
    await sendWhatsAppMessage(barberPhone, waOrderMsg);

    res.json({ ok: true, orderId: oid, whatsAppUrl });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/subscriptions", requireAuth, async (req, res) => {
  const existing = await db.subscriptions().findOne({
    user_id: req.session.user.id,
    status: { $in: ["PENDING_CASH", "ACTIVE"] },
  });
  if (existing) return res.status(409).json({ error: "Já tens um plano pendente ou ativo." });

  const subId = id();
  await db.subscriptions().insertOne({
    id: subId,
    user_id: req.session.user.id,
    plan: "2 cortes + 2 barbas",
    price: 40,
    cuts_remaining: 2,
    beards_remaining: 2,
    status: "PENDING_CASH",
    created_at: new Date().toISOString(),
  });
  res.json({ ok: true, id: subId });
});

app.get("/api/subscriptions/mine", requireAuth, async (req, res) => {
  const subs = await db.subscriptions().find({ user_id: req.session.user.id }).sort({ created_at: -1 }).toArray();
  res.json(subs);
});

app.get("/api/hair-history", requireAuth, async (req, res) => {
  const rows = await db.client_hair_history().find({ user_id: req.session.user.id }).sort({ date: -1 }).toArray();
  res.json(rows.map((r) => ({ ...r, photoUrl: mediaUrl(r.photo_url || r.photoUrl) })));
});

app.post("/api/hair-history", requireAuth, async (req, res) => {
  await db.client_hair_history().insertOne({
    id: id(),
    user_id: req.session.user.id,
    service_name: req.body.serviceName || "Corte",
    style: req.body.style || null,
    photo_url: req.body.photoUrl || "",
    notes: req.body.notes || null,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  const rows = await db.notifications().find({ user_id: req.session.user.id }).sort({ created_at: -1 }).limit(30).toArray();
  res.json(rows);
});

app.get("/api/notifications/unread", requireAuth, async (req, res) => {
  const unread = await db.notifications().find({ user_id: req.session.user.id, read: false }).sort({ created_at: -1 }).limit(10).toArray();
  res.json({ unread, count: unread.length });
});

app.post("/api/notifications/read", requireAuth, async (req, res) => {
  await db.notifications().updateMany({ user_id: req.session.user.id }, { $set: { read: true } });
  res.json({ ok: true });
});

app.get("/api/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { subscription } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Subscrição inválida." });
    }
    let userId = req.session.user?.id || req.body?.userId || null;
    if (!userId && req.body?.isAdmin) {
      const adminUser = await db.users().findOne({ role: "ADMIN" });
      if (adminUser) userId = adminUser.id;
    }
    const endpoint = subscription.endpoint;

    await db.push_subscriptions().updateOne(
      { endpoint },
      {
        $set: {
          id: id(),
          endpoint,
          user_id: userId,
          subscription,
          updated_at: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao guardar subscrição push:", error.message);
    res.status(500).json({ error: "Erro ao registar subscrição." });
  }
});

app.post("/api/admin/broadcast-slot", requireStaff, async (req, res) => {
  try {
    const { date, time } = req.body || {};
    if (!date || !time) {
      return res.status(400).json({ error: "Data e hora são obrigatórias." });
    }

    const formattedDate = new Date(date).toLocaleDateString("pt-PT");
    const pushTitle = "⚡ Vaga Aberta na Barbearia!";
    const pushMessage = `Surgiu uma vaga para corte hoje (${formattedDate}) às ${time} com o Diogo Viegas. Clica para reservar antes que esgote!`;

    // 1. Criar notificação para todos os clientes registados na base de dados
    const clients = await db.users().find({ role: "CLIENT" }).toArray();
    for (const client of clients) {
      await notify(
        client.id,
        pushTitle,
        pushMessage,
        "FLASH_SLOT",
        `/marcar?date=${date}&time=${time}`,
        `slot:${date}:${time}:${client.id}`
      );
    }

    // 2. Notificar prioritariamente qualquer pessoa em lista de espera para essa data
    const waitlist = await db.waitlist().find({ date, notified: false }).toArray();
    for (const w of waitlist) {
      await notify(
        w.user_id,
        "⚡ Vaga Disponível para a tua data!",
        `Ficou disponível a vaga às ${time} na data que pretendias (${formattedDate}). Marca já!`,
        "WAITLIST",
        `/marcar?date=${date}&time=${time}`,
        `waitlist-slot:${w.id}`
      );
    }

    // 3. Emitir broadcast Web Push direto a todos os telemóveis/dispositivos com sininho ativado
    await broadcastPush({
      title: pushTitle,
      body: pushMessage,
      message: pushMessage,
      url: `/marcar?date=${date}&time=${time}`,
      tag: `flash-slot-${date}-${time}`,
    }, req.session.user?.id);

    res.json({ ok: true, notifiedCount: clients.length });
  } catch (error) {
    console.error("Erro ao divulgar vaga:", error.message);
    res.status(500).json({ error: "Erro ao divulgar vaga aos clientes." });
  }
});

app.get("/api/media/:id", async (req, res) => {
  const item = await db.media_assets().findOne({ id: req.params.id });
  if (!item) return res.status(404).end();
  res.set("Content-Type", item.mime || "image/webp");
  const buffer = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data, "base64");
  res.send(buffer);
});

app.post("/api/assistant", async (req, res) => {
  const message = req.body.message;
  if (!message || typeof message !== "string") {
    return res.json({ reply: "Olá! Sou o assistente oficial da Viegas Barber. Como te posso ajudar hoje?" });
  }
  const norm = normalizeText(message);
  const settings = await getSettings();

  if (norm.includes("ola") || norm.includes("boas") || norm === "oi" || norm.includes("bom dia") || norm.includes("boa tarde") || norm.includes("boa noite")) {
    return res.json({
      reply: `Olá! 👋 Sou o assistente virtual da **Viegas Barber**.\n\nPosso ajudar-te com informações sobre o preçário, horários, localização, lista de espera ou marcações com o Diogo. O que gostarias de saber?`,
    });
  }

  if (norm.includes("fideliz") || norm.includes("ponto") || norm.includes("recompensa") || norm.includes("cartao") || norm.includes("desconto")) {
    return res.json({
      reply: `🎁 **Programa de Fidelização Viegas Barber:**\n\nAo fim de **5 cortes** realizados com o Diogo, ganhas direito a uma destas vantagens à tua escolha:\n• **3€ de Desconto** no teu próximo corte de cabelo ✂️\n• **OU 4€ de Desconto** na compra de qualquer cera para cabelo da loja 💈\n\nPodes acompanhar o teu número de cortes e progresso diretamente no separador **Fidelização** no menu!`,
    });
  }

  if (norm.includes("prec") || norm.includes("custa") || norm.includes("servico") || norm.includes("valor") || norm.includes("tabela")) {
    const services = await db.services().find({ isActive: true }).sort({ price: 1 }).toArray();
    const list = services.map((s) => `• **${s.name}**: ${Number(s.price).toFixed(2)}€ (~${s.duration} min)`).join("\n");
    return res.json({
      reply: `✂️ **Preçário Oficial Viegas Barber:**\n\n${list}\n\n👉 Podes agendar diretamente clicando em **"Marcar Agora"** no topo da página!`,
    });
  }

  if (norm.includes("hora") || norm.includes("horario") || norm.includes("abre") || norm.includes("fecha") || norm.includes("almoco") || /\b(que horas|horarios)\b/.test(norm)) {
    return res.json({
      reply: `🕒 **Horário de Funcionamento:**\n\n• **Segunda-feira**: 09:00 — 19:00\n• **Terça-feira**: 09:00 — 20:00\n• **Quarta-feira**: 09:00 — 19:00\n• **Quinta-feira**: 09:00 — 19:00\n• **Sexta-feira**: 09:00 — 20:00\n• **Sábado**: 09:00 — 12:00\n• **Domingo**: Encerrado\n\n🥪 *Pausa de Almoço*: 13:00 — 13:30`,
    });
  }

  if (norm.includes("morada") || norm.includes("localizacao") || norm.includes("onde") || norm.includes("contacto") || norm.includes("fica") || norm.includes("rua") || norm.includes("setubal") || norm.includes("instagram")) {
    return res.json({
      reply: `📍 **Localização & Contactos:**\n\n• **Morada**: ${settings.address || "Centro comercial São Julião, Setúbal"}\n• **WhatsApp**: ${settings.whatsapp || settings.phone || "+351 939 504 261"}\n• **Instagram**: @v_barber8\n\nAtendimento exclusivo e individual com o Diogo Viegas em Setúbal.`,
    });
  }

  if (norm.includes("marcar") || norm.includes("agendar") || norm.includes("marca") || norm.includes("como marcar")) {
    return res.json({
      reply: `📅 **Como fazer a tua marcação:**\n\n1. Clica no botão **"MARCAR AGORA"** no topo do site.\n2. Escolhe o serviço pretendido.\n3. Seleciona o dia e o horário livre que preferires.\n4. Confirma os teus dados.\n\nRecebes confirmação imediata e podes notificar o Diogo pelo WhatsApp!`,
    });
  }

  if (norm.includes("whatsapp") || norm.includes("whats") || norm.includes("mensagem") || norm.includes("zap")) {
    return res.json({
      reply: `💬 **WhatsApp da Barbearia:**\n\nPodes falar diretamente connosco pelo WhatsApp: **${settings.whatsapp || settings.phone || "+351 939 504 261"}**.\n\nAlém disso, quando fazes uma marcação no site, podes avisar o Diogo num só clique!`,
    });
  }

  if (norm.includes("avali") || norm.includes("feedback") || norm.includes("estrela")) {
    return res.json({
      reply: `⭐ **Avaliações dos Clientes:**\n\nTodas as nossas avaliações são 100% verificadas e deixadas exclusivamente por clientes reais após o corte. Podes consultar o feedback na secção da página inicial.`,
    });
  }

  if (norm.includes("diogo") || norm.includes("barbeiro") || norm.includes("quem e")) {
    return res.json({
      reply: `💈 **Diogo Viegas** é o fundador e barbeiro exclusivo da Viegas Barber.\n\nEspecialista em degradês milimétricos (fades), barboterapia, cortes à tesoura e styling. Todo o atendimento é individual e sem pressas.`,
    });
  }

  if (norm.includes("loja") || norm.includes("produto") || norm.includes("cera") || norm.includes("pomada")) {
    const products = await db.products().find({}).limit(4).toArray();
    const list = products.map((p) => `• **${p.name}** (${Number(p.price).toFixed(2)}€)`).join("\n");
    return res.json({
      reply: `🛍️ **Loja de Produtos:**\n\n${list}\n\nPodes reservar diretamente na página da Loja e levantar e pagar ao balcão com o Diogo.`,
    });
  }

  res.json({
    reply: `Posso ajudar-te com informações sobre o preçário, horários, localização, marcações ou produtos da loja. Como posso ajudar?`,
  });
});

// -------------------------------------------------------------
// Admin / Barber Dashboard Endpoints
// -------------------------------------------------------------

app.get("/api/admin/today", requireStaff, async (req, res) => {
  const date = todayDate();
  const rows = await db.appointments().find({ date }).sort({ start_time: 1 }).toArray();
  for (const a of rows) {
    const s = await db.services().findOne({ id: a.service_id });
    const u = await db.users().findOne({ id: a.user_id });
    a.service_name = s?.name || "Corte";
    a.price = Number(s?.price) || 12;
    a.duration = Number(s?.duration_minutes) || 45;
    a.client_name = a.client_name || u?.name || "Cliente";
    a.phone = a.client_phone || u?.phone || "";
    a.email = u?.email || "";
    if (a.phone) {
      const waMsg = `✂️ *Viegas Barber*\n\nOlá ${a.client_name}! A confirmar o teu corte (${a.service_name}) para hoje às *${a.start_time}* com o Diogo. Contamos contigo!`;
      a.whatsAppUrl = buildWhatsAppLink(a.phone, waMsg);
    }
  }
  res.json({ date, appointments: rows });
});

app.get("/api/admin/appointments", requireStaff, async (req, res) => {
  const date = String(req.query.date || todayDate());
  const rows = await db.appointments().find({ date }).sort({ start_time: 1 }).toArray();
  for (const a of rows) {
    const s = await db.services().findOne({ id: a.service_id });
    const u = await db.users().findOne({ id: a.user_id });
    a.service_name = s?.name || "Corte";
    a.price = Number(s?.price) || 12;
    a.duration = Number(s?.duration_minutes) || 45;
    a.client_name = a.client_name || u?.name || "Cliente";
    a.phone = a.client_phone || u?.phone || "";
    a.email = u?.email || "";
    if (a.phone) {
      const waMsg = `✂️ *Viegas Barber*\n\nOlá ${a.client_name}! A confirmar a tua marcação (${a.service_name}) para ${a.date} às *${a.start_time}* com o Diogo. Contamos contigo!`;
      a.whatsAppUrl = buildWhatsAppLink(a.phone, waMsg);
    }
  }
  res.json(rows);
});

app.patch("/api/admin/appointments/:id", requireStaff, async (req, res) => {
  const status = req.body.status;
  const appt = await db.appointments().findOne({ id: req.params.id });
  if (!appt) return res.status(404).json({ error: "Não encontrada" });

  await db.appointments().updateOne({ id: appt.id }, { $set: { status } });

  if (status === "COMPLETED" && !appt.loyalty_awarded) {
    const revTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db.appointments().updateOne({ id: appt.id }, { $set: { loyalty_awarded: true, review_available_at: revTime } });

    const loyalty = await db.loyalty().findOne({ user_id: appt.user_id });
    if (loyalty) {
      const visits = (loyalty.visits || 0) + 1;
      await db.loyalty().updateOne(
        { user_id: appt.user_id },
        {
          $set: { visits, tier: loyaltyTierForVisits(visits) },
          $inc: { points: 15 },
        }
      );
    } else {
      await db.loyalty().insertOne({
        id: id(),
        user_id: appt.user_id,
        points: 15,
        visits: 1,
        tier: "Bronze",
      });
    }
  }

  if (status === "CANCELLED") {
    await offerNextWaitlistEntry(appt.date, appt.start_time);
  }
  res.json({ ok: true });
});

app.post("/api/admin/appointments", requireStaff, async (req, res) => {
  try {
    const { clientName, clientPhone, serviceId, date, startTime, notes } = req.body || {};
    if (!clientName || !date || !startTime) {
      return res.status(400).json({ error: "Nome, data e hora são obrigatórios." });
    }

    const service = await db.services().findOne({ id: serviceId || "srv-corte-12" });
    const sId = service?.id || "srv-corte-12";
    const startMins = timeToMinutes(startTime);
    const endMins = startMins + 50;
    const endTime = minutesToTime(endMins);

    let user = null;
    if (clientPhone) {
      user = await db.users().findOne({ phone: clientPhone });
    }
    if (!user) {
      const cleanPhone = (clientPhone || "").replace(/\D/g, "");
      const guestEmail = cleanPhone ? `manual_${cleanPhone}@viegasbarber.pt` : `manual_${id().slice(0, 8)}@viegasbarber.pt`;
      user = {
        id: id(),
        name: clientName.trim(),
        phone: clientPhone || null,
        email: guestEmail,
        role: "CLIENT",
        created_at: new Date().toISOString(),
      };
      await db.users().insertOne(user);
    }

    const newAppt = {
      id: id(),
      user_id: user.id,
      client_name: clientName.trim(),
      client_phone: clientPhone || null,
      service_id: sId,
      date,
      start_time: startTime,
      end_time: endTime,
      status: "SCHEDULED",
      notes: notes || null,
      created_via: "ADMIN_MANUAL",
      loyalty_awarded: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.appointments().insertOne(newAppt);
    res.json({ ok: true, appointment: newAppt });
  } catch (error) {
    console.error("Erro ao criar marcação manual:", error);
    res.status(500).json({ error: "Erro ao criar marcação manual." });
  }
});

app.delete("/api/admin/blocked-times/:id", requireStaff, async (req, res) => {
  try {
    await db.blocked_times().deleteOne({ id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover bloqueio." });
  }
});

app.get("/api/admin/clients", requireStaff, async (_req, res) => {
  const users = await db.users().find({ role: "CLIENT" }).sort({ created_at: -1 }).toArray();
  const result = [];
  for (const u of users) {
    const l = await db.loyalty().findOne({ user_id: u.id });
    result.push({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      visits: l?.visits || 0,
      tier: l?.tier || "Bronze",
      points: l?.points || 0,
    });
  }
  res.json(result);
});

app.get("/api/admin/orders", requireStaff, async (_req, res) => {
  const orders = await db.orders().find({}).sort({ created_at: -1 }).toArray();
  for (const o of orders) {
    const u = await db.users().findOne({ id: o.user_id });
    o.client_name = u?.name || "Cliente";
    o.email = u?.email || "";
    o.phone = u?.phone || "";
    o.items = o.items || [];
    if (o.phone) {
      const waMsg = `🛍️ *Viegas Barber - Reserva na Loja*\n\nOlá ${o.client_name}! A tua encomenda de produtos no valor de *${Number(o.total).toFixed(2)}€* foi confirmada pelo Diogo e está pronta para levantamento no balcão da barbearia.\n\nObrigado!`;
      o.whatsAppUrl = buildWhatsAppLink(o.phone, waMsg);
    }
  }
  res.json(orders);
});

app.patch("/api/admin/orders/:id", requireStaff, async (req, res) => {
  const status = req.body.status;
  const order = await db.orders().findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ error: "Não encontrada" });

  if (status === "CANCELLED" && order.status === "PENDING") {
    for (const item of order.items || []) {
      await db.products().updateOne({ id: item.product_id }, { $inc: { stock: item.quantity } });
    }
  }
  await db.orders().updateOne({ id: order.id }, { $set: { status } });

  let whatsAppUrl = null;
  const clientUser = await db.users().findOne({ id: order.user_id });

  if (status === "ACCEPTED" || status === "PAID") {
    const waMsg = `🛍️ *Viegas Barber - Encomenda Aceite!*\n\nOlá ${clientUser?.name || "Cliente"}! A tua encomenda de produtos no valor de *${Number(order.total).toFixed(2)}€* foi confirmada pelo Diogo e está pronta para levantamento e pagamento no balcão da barbearia.\n\nObrigado pela preferência!`;
    if (clientUser?.phone) {
      whatsAppUrl = buildWhatsAppLink(clientUser.phone, waMsg);
      await sendWhatsAppMessage(clientUser.phone, waMsg);
    }

    await notify(
      order.user_id,
      "🛍️ A sua encomenda foi aceite!",
      `A tua encomenda de produtos (${Number(order.total).toFixed(2)}€) foi aceite pelo Diogo e está pronta para levantamento e pagamento no balcão da barbearia.`,
      "ORDER",
      "/minhas-marcacoes"
    );
  } else if (status === "CANCELLED") {
    await notify(
      order.user_id,
      "🛍️ Encomenda Cancelada",
      `A tua encomenda no valor de ${Number(order.total).toFixed(2)}€ foi cancelada.`,
      "ORDER",
      "/minhas-marcacoes"
    );
  }

  res.json({ ok: true, whatsAppUrl });
});

app.get("/api/admin/catalog", requireStaff, async (_req, res) => {
  const [products, styles] = await Promise.all([
    db.products().find({}).sort({ created_at: -1 }).toArray(),
    db.hair_styles().find({}).sort({ created_at: -1 }).toArray(),
  ]);
  res.json({
    products: products.map((p) => ({ ...p, imageUrl: mediaUrl(p.imageUrl || p.image_url) })),
    styles: styles.map((s) => ({ ...s, imageUrl: mediaUrl(s.imageUrl || s.image_url) })),
  });
});

async function saveDataUrl(dataUrl) {
  if (!dataUrl || !String(dataUrl).startsWith("data:")) return dataUrl;
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return dataUrl;
  const mediaId = id();
  await db.media_assets().insertOne({
    id: mediaId,
    data: match[2],
    mime: match[1],
    created_at: new Date().toISOString(),
  });
  return `media:${mediaId}`;
}

app.post("/api/admin/products", requireStaff, async (req, res) => {
  const imageUrl = await saveDataUrl(req.body.imageUrl);
  const productId = id();
  await db.products().insertOne({
    id: productId,
    name: req.body.name,
    description: req.body.description || null,
    price: Number(req.body.price) || 0,
    stock: Number(req.body.stock) || 0,
    category: req.body.category || "Geral",
    imageUrl: imageUrl || null,
    created_at: new Date().toISOString(),
  });
  res.json({ id: productId });
});

app.patch("/api/admin/products/:id", requireStaff, async (req, res) => {
  const update = {};
  if (req.body.name !== undefined) update.name = req.body.name;
  if (req.body.description !== undefined) update.description = req.body.description;
  if (req.body.price !== undefined) update.price = Number(req.body.price);
  if (req.body.stock !== undefined) update.stock = Number(req.body.stock);
  if (req.body.category !== undefined) update.category = req.body.category;
  if (req.body.imageUrl !== undefined) update.imageUrl = await saveDataUrl(req.body.imageUrl);

  await db.products().updateOne({ id: req.params.id }, { $set: update });
  res.json({ ok: true });
});

app.delete("/api/admin/products/:id", requireStaff, async (req, res) => {
  // Check if product was used in any order
  const orders = await db.orders().find({}).toArray();
  const used = orders.some((o) => (o.items || []).some((i) => i.product_id === req.params.id));
  if (used) {
    await db.products().updateOne({ id: req.params.id }, { $set: { stock: 0 } });
    return res.json({ ok: true, kept: true });
  }
  await db.products().deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

app.post("/api/admin/hair-styles", requireStaff, async (req, res) => {
  const imageUrl = await saveDataUrl(req.body.imageUrl || req.body.image_url);
  const styleId = id();
  await db.hair_styles().insertOne({
    id: styleId,
    title: req.body.title,
    category: req.body.category,
    description: req.body.description || null,
    imageUrl,
    likes: 0,
    created_at: new Date().toISOString(),
  });
  res.json({ id: styleId });
});

app.patch("/api/admin/hair-styles/:id", requireStaff, async (req, res) => {
  const update = {};
  if (req.body.title !== undefined) update.title = req.body.title;
  if (req.body.category !== undefined) update.category = req.body.category;
  if (req.body.description !== undefined) update.description = req.body.description;
  if (req.body.imageUrl !== undefined) update.imageUrl = await saveDataUrl(req.body.imageUrl);

  await db.hair_styles().updateOne({ id: req.params.id }, { $set: update });
  res.json({ ok: true });
});

app.delete("/api/admin/hair-styles/:id", requireStaff, async (req, res) => {
  await db.hair_styles().deleteOne({ id: req.params.id });
  res.json({ ok: true });
});

app.get("/api/admin/services", requireStaff, async (_req, res) => {
  const services = await db.services().find({}).sort({ price: 1 }).toArray();
  res.json(services);
});

app.post("/api/admin/services", requireStaff, async (req, res) => {
  const sid = id();
  await db.services().insertOne({
    id: sid,
    name: req.body.name,
    description: req.body.description || null,
    price: Number(req.body.price) || 0,
    duration: Number(req.body.duration) || 30,
    isActive: true,
    created_at: new Date().toISOString(),
  });
  res.json({ id: sid });
});

app.patch("/api/admin/services/:id", requireStaff, async (req, res) => {
  const update = {};
  if (req.body.name !== undefined) update.name = req.body.name;
  if (req.body.description !== undefined) update.description = req.body.description;
  if (req.body.price !== undefined) update.price = Number(req.body.price);
  if (req.body.duration !== undefined) update.duration = Number(req.body.duration);
  if (req.body.isActive !== undefined) update.isActive = Boolean(req.body.isActive);

  await db.services().updateOne({ id: req.params.id }, { $set: update });
  res.json({ ok: true });
});

app.get("/api/admin/subscriptions", requireStaff, async (_req, res) => {
  const subs = await db.subscriptions().find({}).sort({ created_at: -1 }).toArray();
  for (const s of subs) {
    const u = await db.users().findOne({ id: s.user_id });
    s.client_name = u?.name || "Cliente";
    s.email = u?.email || "";
  }
  res.json(subs);
});

app.patch("/api/admin/subscriptions/:id", requireStaff, async (req, res) => {
  const status = req.body.status;
  if (status === "ACTIVE") {
    const now = new Date();
    const ends = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await db.subscriptions().updateOne(
      { id: req.params.id },
      {
        $set: {
          status: "ACTIVE",
          paid_at: now.toISOString(),
          starts_at: now.toISOString(),
          ends_at: ends.toISOString(),
          cuts_remaining: 2,
          beards_remaining: 2,
        },
      }
    );
  } else {
    await db.subscriptions().updateOne({ id: req.params.id }, { $set: { status } });
  }
  res.json({ ok: true });
});

app.get("/api/admin/settings", requireStaff, async (_req, res) => {
  res.json(await getSettings());
});

app.patch("/api/admin/settings", requireStaff, async (req, res) => {
  const update = {};
  if (req.body.minAdvanceHours !== undefined) update.minAdvanceHours = Number(req.body.minAdvanceHours);
  if (req.body.openTime !== undefined) update.openTime = req.body.openTime;
  if (req.body.closeTime !== undefined) update.closeTime = req.body.closeTime;
  if (req.body.lunchStart !== undefined) update.lunchStart = req.body.lunchStart;
  if (req.body.lunchEnd !== undefined) update.lunchEnd = req.body.lunchEnd;
  if (req.body.address !== undefined) update.address = req.body.address;
  if (req.body.phone !== undefined) update.phone = req.body.phone;

  await db.settings().updateOne({ id: "default" }, { $set: update }, { upsert: true });
  res.json(await getSettings());
});

app.get("/api/admin/heatmap", requireStaff, async (_req, res) => {
  const appts = await db.appointments().find({ status: { $in: ["SCHEDULED", "COMPLETED"] } }).toArray();
  const counts = {};
  for (const a of appts) {
    counts[a.start_time] = (counts[a.start_time] || 0) + 1;
  }
  const rows = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start_time, c]) => ({ start_time, c }));
  res.json(rows);
});

app.post("/api/admin/blocked-times", requireStaff, async (req, res) => {
  await db.blocked_times().insertOne({
    id: id(),
    date: req.body.date,
    start_time: req.body.startTime,
    end_time: req.body.endTime,
    reason: req.body.reason || null,
    created_at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

app.get("/api/cron/notifications", async (req, res) => {
  const auth = req.headers.authorization || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const nowIso = new Date().toISOString();
  const expiredOffers = await db.waitlist().find({
    notified: true,
    offer_expires_at: { $lte: nowIso },
  }).toArray();

  const seen = new Set();
  for (const offer of expiredOffers) {
    if (!offer.time_slot) continue;
    const key = `${offer.date}:${offer.time_slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await offerNextWaitlistEntry(offer.date, offer.time_slot);
  }

  await db.subscriptions().updateMany(
    { status: "ACTIVE", ends_at: { $lt: nowIso } },
    { $set: { status: "EXPIRED" } }
  );

  res.json({ ok: true });
});

// -------------------------------------------------------------
// Endpoints Modo Bairro (Marcações sem registo obrigatório)
// -------------------------------------------------------------

app.post("/api/bairro/book", async (req, res) => {
  try {
    if (isNighttimeBlocked()) {
      return res.status(400).json({ error: NIGHTTIME_BLOCK_MESSAGE });
    }

    const body = req.body || {};
    const serviceId = body.serviceId;
    const date = body.date;
    const startTime = body.startTime;
    const clientName = (body.clientName || "").trim();
    const clientPhone = (body.clientPhone || "").trim();
    const clientInstagram = (body.clientInstagram || body.instagram || "").trim();
    const notes = (body.notes || "").trim();

    if (!clientName || clientName.length < 2) {
      return res.status(400).json({ error: "Por favor indica o teu nome." });
    }
    if (!clientPhone || clientPhone.replace(/\D/g, "").length < 9) {
      return res.status(400).json({ error: "Por favor indica um número de telemóvel válido (mínimo 9 dígitos)." });
    }
    if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime || "")) {
      return res.status(400).json({ error: "Serviço, data ou horário inválidos." });
    }

    const daySched = getDaySchedule(date);
    if (daySched.closed) {
      return res.status(400).json({ error: "A barbearia está encerrada aos domingos." });
    }

    const service = await db.services().findOne({ id: serviceId, isActive: true });
    if (!service) return res.status(404).json({ error: "Serviço não encontrado ou indisponível" });

    if (date < todayDate()) {
      return res.status(400).json({ error: "A data selecionada já passou." });
    }

    const startMins = timeToMinutes(startTime);
    const slotDuration = 50;
    const endMins = startMins + slotDuration;
    const endTime = minutesToTime(endMins);
    const settings = await getSettings();
    const slotMs = new Date(`${date}T${startTime}:00`).getTime();

    const openMinutes = timeToMinutes(daySched.open);
    const closeMinutes = timeToMinutes(daySched.close);
    const lunchEnd = timeToMinutes(settings.lunchEnd);

    if (
      startMins < openMinutes ||
      endMins > closeMinutes ||
      (closeMinutes > lunchEnd && overlaps(startMins, endMins, timeToMinutes(settings.lunchStart), lunchEnd))
    ) {
      return res.status(400).json({ error: `Horário indisponível. Horário à ${daySched.label}: ${daySched.open} às ${daySched.close}.` });
    }

    if (slotMs < Date.now()) {
      return res.status(400).json({ error: "Este horário já passou. Por favor escolhe um horário futuro." });
    }

    const appts = await db.appointments().find({ date, status: "SCHEDULED" }).toArray();
    const blocked = await db.blocked_times().find({ date }).toArray();
    if (
      appts.some((a) => overlaps(startMins, endMins, timeToMinutes(a.start_time), timeToMinutes(a.end_time))) ||
      blocked.some((b) => overlaps(startMins, endMins, timeToMinutes(b.start_time), timeToMinutes(b.end_time)))
    ) {
      return res.status(409).json({ error: "Este horário acabou de ser reservado por outro cliente. Por favor escolhe outro." });
    }

    let user = await db.users().findOne({ phone: clientPhone });
    if (!user) {
      const cleanPhone = clientPhone.replace(/\D/g, "");
      const guestEmail = `bairro_${cleanPhone}@bairro.viegasbarber.pt`;
      user = await db.users().findOne({ email: guestEmail });
      if (!user) {
        user = {
          id: id(),
          name: clientName,
          phone: clientPhone,
          instagram: clientInstagram || null,
          email: guestEmail,
          role: "CLIENT",
          created_at: new Date().toISOString(),
        };
        await db.users().insertOne(user);
      }
    } else {
      const userUpdates = {};
      if (clientName && (!user.name || user.name.startsWith("Cliente"))) userUpdates.name = clientName;
      if (clientInstagram && !user.instagram) userUpdates.instagram = clientInstagram;
      if (Object.keys(userUpdates).length > 0) {
        await db.users().updateOne({ id: user.id }, { $set: userUpdates });
      }
    }

    const apptId = id();
    console.log(`[NOVA_MARCAÇÃO] ${clientName} (${clientPhone}) marcou ${service.name} para ${date} às ${startTime}`);
    await db.appointments().insertOne({
      id: apptId,
      user_id: user.id,
      client_name: clientName,
      client_phone: clientPhone,
      client_instagram: clientInstagram || null,
      service_id: service.id,
      date,
      start_time: startTime,
      end_time: endTime,
      status: "SCHEDULED",
      notes: notes || null,
      created_via: "BAIRRO",
      loyalty_awarded: false,
      created_at: new Date().toISOString(),
    });

    const staffMembers = await db.users().find({ role: { $in: ["ADMIN", "BARBER"] } }).toArray();
    for (const staff of staffMembers) {
      await notify(
        staff.id,
        "✂️ Nova Marcação no Site!",
        `${clientName} (${clientPhone}${clientInstagram ? ` • ${clientInstagram}` : ""}) marcou ${service.name} para ${date} às ${startTime}.`,
        "BOOKING",
        `/dashboard?tab=agenda&date=${date}`
      );
    }

    // Verificar se o dia ficou com a agenda cheia
    await checkAndNotifyFullDay(date);

    res.json({
      success: true,
      appointment: {
        id: apptId,
        clientName,
        clientPhone,
        clientInstagram: clientInstagram || null,
        serviceId: service.id,
        serviceName: service.name,
        servicePrice: service.price,
        date,
        startTime,
        endTime,
      },
    });
  } catch (error) {
    console.error("Erro na marcação de bairro:", error);
    res.status(500).json({ error: "Erro ao processar marcação." });
  }
});

app.get("/api/bairro/my-active", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();
    const apptId = String(req.query.id || "").trim();

    if (!phone && !apptId) {
      return res.json({ appointments: [] });
    }

    const today = todayDate();
    let query = {
      status: "SCHEDULED",
      date: { $gte: today },
    };

    if (apptId) {
      query.id = apptId;
    } else {
      const cleanPhone = phone.replace(/\D/g, "");
      const users = await db.users().find({
        $or: [
          { phone: { $regex: cleanPhone } },
          { email: { $regex: cleanPhone } },
        ],
      }).toArray();
      const userIds = users.map((u) => u.id);

      query.$or = [
        { client_phone: phone },
        { client_phone: { $regex: cleanPhone } },
        { user_id: { $in: userIds } },
      ];
    }

    const rows = await db.appointments().find(query).sort({ date: 1, start_time: 1 }).toArray();
    for (const a of rows) {
      const s = await db.services().findOne({ id: a.service_id });
      a.service_name = s?.name || "Corte";
      a.service_price = s?.price || 12;
    }

    res.json({ appointments: rows });
  } catch (error) {
    console.error("Erro ao pesquisar marcações ativas:", error);
    res.status(500).json({ error: "Erro ao consultar marcações." });
  }
});

app.post("/api/bairro/cancel", async (req, res) => {
  try {
    const { appointmentId, phone } = req.body || {};
    if (!appointmentId) return res.status(400).json({ error: "Marcação não indicada." });

    const appt = await db.appointments().findOne({ id: appointmentId });
    if (!appt) return res.status(404).json({ error: "Marcação não encontrada." });
    if (appt.status !== "SCHEDULED") return res.status(400).json({ error: "Esta marcação já não se encontra ativa." });

    if (phone) {
      const cleanInput = phone.replace(/\D/g, "");
      const cleanAppt = (appt.client_phone || "").replace(/\D/g, "");
      const user = await db.users().findOne({ id: appt.user_id });
      const cleanUserPhone = (user?.phone || "").replace(/\D/g, "");
      if (cleanAppt && !cleanAppt.includes(cleanInput) && cleanUserPhone && !cleanUserPhone.includes(cleanInput)) {
        return res.status(403).json({ error: "O número de telemóvel não coincide com esta marcação." });
      }
    }

    await db.appointments().updateOne({ id: appt.id }, { $set: { status: "CANCELLED" } });

    const staffMembers = await db.users().find({ role: { $in: ["ADMIN", "BARBER"] } }).toArray();
    for (const staff of staffMembers) {
      await notify(
        staff.id,
        "⚠️ Marcação Desmarcada pelo Cliente",
        `${appt.client_name || "Cliente"} (${appt.client_phone || "Sem tel"}) desmarcou o corte de ${appt.date} às ${appt.start_time}. A vaga foi libertada!`,
        "CANCELLATION",
        `/dashboard?tab=agenda&date=${appt.date}`
      );
    }

    await offerNextWaitlistEntry(appt.date, appt.start_time);

    res.json({ ok: true, message: "Marcação desmarcada com sucesso. A vaga foi libertada!" });
  } catch (error) {
    console.error("Erro ao cancelar marcação de bairro:", error);
    res.status(500).json({ error: "Erro ao desmarcar." });
  }
});

app.get("/api/bairro/radar", async (_req, res) => {
  try {
    const settings = await getSettings();
    const days = [];
    const now = new Date();
    const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dayNum = String(d.getDate()).padStart(2, "0");
      const iso = `${y}-${m}-${dayNum}`;
      const sched = getDaySchedule(iso);

      let freeCount = 0;
      let hasFlash = false;

      if (!sched.closed) {
        const openMin = timeToMinutes(sched.open);
        const closeMin = timeToMinutes(sched.close);
        const lunchStart = timeToMinutes(settings.lunchStart);
        const lunchEnd = timeToMinutes(settings.lunchEnd);

        const appts = await db.appointments().find({ date: iso, status: "SCHEDULED" }).toArray();
        const blocked = await db.blocked_times().find({ date: iso }).toArray();

        let totalPossible = 0;
        for (let mins = openMin; mins + 50 <= closeMin; mins += 60) {
          const end = mins + 50;
          if (closeMin > lunchEnd && overlaps(mins, end, lunchStart, lunchEnd)) continue;
          totalPossible++;
          const timeStr = minutesToTime(mins);
          if (new Date(`${iso}T${timeStr}:00`).getTime() < Date.now()) continue;

          const busy =
            appts.some((a) => overlaps(mins, end, timeToMinutes(a.start_time), timeToMinutes(a.end_time))) ||
            blocked.some((b) => overlaps(mins, end, timeToMinutes(b.start_time), timeToMinutes(b.end_time)));
          if (!busy) freeCount++;
        }

        // Vaga Flash só faz sentido quando o dia está concorrido (poucas vagas) OU houve cancelamento nas últimas 2 horas
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const recentCancelled = await db.appointments().findOne({
          date: iso,
          status: "CANCELLED",
          created_at: { $gte: twoHoursAgo }
        });
        
        // Só é Vaga Flash se tiver poucas vagas restantes (ex: <= 3 vagas) ou vaga de última hora
        if (recentCancelled && freeCount > 0 && freeCount <= Math.max(3, Math.floor(totalPossible * 0.4))) {
          hasFlash = true;
        }
      }

      days.push({
        iso,
        label: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : dayLabels[d.getDay()],
        dateFormatted: `${dayNum}/${m}`,
        closed: sched.closed,
        hours: sched.closed ? "Encerrado" : `${sched.open} - ${sched.close}`,
        freeCount,
        hasFlash,
      });
    }

    res.json({ days });
  } catch (e) {
    res.json({ days: [] });
  }
});

app.get("/api/bairro/loyalty", async (req, res) => {
  try {
    const phone = String(req.query.phone || "").trim();
    if (!phone) {
      return res.json({ visits: 0, currentCycleCuts: 0, cutsNeeded: 5, hasRewardReady: false });
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const user = await db.users().findOne({
      $or: [
        { phone },
        { phone: { $regex: cleanPhone } },
        { email: `bairro_${cleanPhone}@bairro.viegasbarber.pt` },
      ],
    });

    if (!user) {
      return res.json({ visits: 0, currentCycleCuts: 0, cutsNeeded: 5, hasRewardReady: false });
    }

    const loyalty = await db.loyalty().findOne({ user_id: user.id });
    const visits = loyalty?.visits || 0;
    const currentCycleCuts = visits % 5;
    const hasRewardReady = visits > 0 && currentCycleCuts === 0;
    const cutsNeeded = hasRewardReady ? 0 : 5 - currentCycleCuts;

    res.json({
      userName: user.name,
      visits,
      points: loyalty?.points || 0,
      currentCycleCuts,
      cutsNeeded,
      hasRewardReady,
    });
  } catch (e) {
    res.status(500).json({ error: "Erro ao consultar fidelização." });
  }
});

app.post("/api/bairro/reviews", async (req, res) => {
  try {
    const { name, phone, rating, comment } = req.body || {};
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Por favor indica o teu nome." });
    }
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      return res.status(400).json({ error: "Por favor indica o teu telemóvel para verificar a tua marcação." });
    }
    if (!comment || comment.trim().length < 4) {
      return res.status(400).json({ error: "Por favor escreve um comentário breve sobre o corte." });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const matchingUsers = await db.users().find({
      $or: [
        { phone },
        { phone: { $regex: cleanPhone } },
        { email: `bairro_${cleanPhone}@bairro.viegasbarber.pt` },
      ],
    }).toArray();
    const userIds = matchingUsers.map((u) => u.id);

    // Procurar marcações (SCHEDULED ou COMPLETED) deste cliente
    const appts = await db.appointments().find({
      $or: [
        { client_phone: phone },
        { client_phone: { $regex: cleanPhone } },
        { user_id: { $in: userIds } },
      ],
      status: { $in: ["SCHEDULED", "COMPLETED"] },
    }).toArray();

    if (!appts || appts.length === 0) {
      return res.status(403).json({
        error: "Apenas clientes com corte marcado podem deixar avaliação. Não encontramos marcações para este número."
      });
    }

    // Verificar se pelo menos uma marcação já passou há pelo menos 1 hora
    const now = Date.now();
    const eligibleAppt = appts.find((a) => {
      const apptDateTime = new Date(`${a.date}T${a.start_time}:00`).getTime();
      const oneHourAfter = apptDateTime + (60 * 60 * 1000);
      return now >= oneHourAfter;
    });

    if (!eligibleAppt) {
      return res.status(403).json({
        error: "A avaliação só fica disponível 1 hora depois da hora do teu corte marcado!"
      });
    }

    const numRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const userId = matchingUsers[0]?.id || null;

    await db.reviews().insertOne({
      id: id(),
      user_id: userId,
      appointment_id: eligibleAppt.id,
      reviewer_name: name.trim(),
      reviewer_phone: phone,
      rating: numRating,
      comment: (comment || "").trim(),
      is_private: false,
      created_at: new Date().toISOString(),
    });

    res.json({ ok: true, message: "Obrigado pela tua avaliação!" });
  } catch (e) {
    console.error("Erro na avaliação:", e);
    res.status(500).json({ error: "Erro ao registar avaliação." });
  }
});

app.get("/api/bairro/reviews", async (_req, res) => {
  try {
    const list = await db.reviews().find({}).sort({ created_at: -1 }).limit(8).toArray();
    const result = [];
    for (const r of list) {
      let uName = r.reviewer_name;
      if (!uName && r.user_id) {
        const u = await db.users().findOne({ id: r.user_id });
        uName = u?.name;
      }
      result.push({
        name: uName || "Cliente",
        rating: r.rating || 5,
        comment: r.comment || "Excelente corte e atendimento do Diogo Viegas!",
        date: r.created_at ? new Date(r.created_at).toLocaleDateString("pt-PT") : "Recentemente",
      });
    }
    res.json(result);
  } catch (e) {
    res.json([]);
  }
});

// -------------------------------------------------------------
// HTML5 Single-Page / Clean Page Routes
// -------------------------------------------------------------

const htmlPages = [
  "/",
  "/index.html",
  "/bairro.html",
  "/diogo.html",
  "/galeria.html",
  "/loja.html",
  "/fidelizacao.html",
  "/plano.html",
  "/marcar.html",
  "/login.html",
  "/register.html",
  "/minhas-marcacoes.html",
  "/meus-cortes.html",
  "/espera.html",
  "/dashboard.html",
];

app.get("/sw.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(www, "sw.js"));
});

app.get("/", (req, res, next) => {
  const user = currentUser(req);
  if (user && isStaff(user) && req.query.view !== "public") {
    return res.redirect("/dashboard");
  }
  next();
});

htmlPages.forEach((route) => {
  app.get(route === "/" ? "/" : route.replace(".html", ""), (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    const file = route === "/" ? "index.html" : route.replace(/^\//, "");
    res.sendFile(path.join(www, file.endsWith(".html") ? file : `${file}.html`));
  });
});

app.get("/rapido", (_req, res) => res.redirect("/bairro"));

const port = Number(process.env.PORT || 3000);

async function start() {
  await initDb();
  await seed();
  await db.settings().updateOne(
    { id: "default" },
    {
      $set: {
        phone: "+351 939 504 261",
        whatsapp: "+351 939 504 261",
        instagram: "v_barber8",
        minAdvanceHours: 4,
        lunchStart: "13:00",
        lunchEnd: "13:30",
        address: "Centro comercial São Julião , Setúbal",
      },
    }
  );

  // Background runner: Notificações de lembretes e expiração da lista de espera
  setInterval(async () => {
    try {
      const nowIso = new Date().toISOString();
      const expiredOffers = await db.waitlist().find({
        notified: true,
        offer_expires_at: { $lte: nowIso },
      }).toArray();
      const seen = new Set();
      for (const offer of expiredOffers) {
        if (!offer.time_slot) continue;
        const key = `${offer.date}:${offer.time_slot}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await offerNextWaitlistEntry(offer.date, offer.time_slot);
      }

      const today = todayDate();
      const apptsToday = await db.appointments().find({
        date: today,
        status: "SCHEDULED",
        reminder_sent: { $ne: true },
      }).toArray();
      for (const a of apptsToday) {
        const srv = await db.services().findOne({ id: a.service_id });
        await notify(
          a.user_id,
          "⏰ Lembrete: O teu corte é hoje!",
          `Tens corte marcado com o Diogo Viegas hoje às ${a.start_time} (${srv?.name || "Corte"}). Vemo-nos no Centro comercial São Julião, Setúbal!`,
          "REMINDER",
          "/minhas-marcacoes",
          `reminder:${a.id}`
        );
        await db.appointments().updateOne({ id: a.id }, { $set: { reminder_sent: true } });
      }
    } catch (e) {}
  }, 60 * 1000);

  app.listen(port, () => {
    console.log(`Viegas Barber (HTML5 + CSS3 + JS + Node.js + NoSQL) em http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error("Falha ao iniciar servidor:", err);
});
