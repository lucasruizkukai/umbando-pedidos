import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

const STATUS_LIST = ["Novo", "Em ProduÃ§Ã£o", "Postado", "ConcluÃ­do", "Cancelado"];
const STATUS_COLORS = {
  Novo: { bg: "#F3F4F6", cl: "#374151", em: "N" },
  "Em ProduÃ§Ã£o": { bg: "#FEE2E2", cl: "#991B1B", em: "P" },
  Postado: { bg: "#DBEAFE", cl: "#1E40AF", em: "E" },
  ConcluÃ­do: { bg: "#DCFCE7", cl: "#166534", em: "C" },
  Cancelado: { bg: "#F1F5F9", cl: "#64748B", em: "X" },
};
const MATERIALS = ["MiÃ§anga", "Cristal", "Porcelana", "Semente"];
const MATERIAL_DETAILS = {
  MiÃ§anga: ["Chinesa", "Jablonex"],
  Cristal: ["6mm", "8mm", "10mm"],
  Porcelana: ["6mm", "8mm"],
  Semente: ["LÃ¡grima N.Sra.", "Coquinho", "Olho de Boi", "Olho de Cabra", "Madeira"],
};
const MATERIAL_LABELS = {
  MiÃ§anga: "Tipo de MiÃ§anga",
  Cristal: "Tamanho Cristal",
  Porcelana: "Tamanho",
  Semente: "Tipo de Semente",
};
const FIRM_FORMATS = ["Lisa", "Mordida", "Pitanga", "Meteoro", "Sextavada", "Bola"];
const SIZES = ["40cm", "50cm", "60cm", "65cm", "70cm", "75cm", "80cm"];
const SHIPPERS = ["Correios", "Loggi", "JadLog", "Motoboy"];
const CHANNELS = ["WhatsApp", "Instagram DM", "ComentÃ¡rio"];
const THEME = {
  br: "#D8D3C8",
  gold: "#C8A96A",
  glL: "#E2C690",
  dark: "#1F2937",
  tm: "#1F2937",
  tl: "#6B7280",
  card: "#FFFFFF",
  bg: "#F5F3EE",
  panel: "#F8F6F1",
  soft: "#F1EEE7",
  primary: "#4E5F4D",
  primaryDark: "#3F4D3D",
  primarySoft: "#E7EEE6",
};
const AI_ENABLED = false;

const EMPTY = {
  nome: "", contato: "", canal: "WhatsApp", tipo: "Guia", fios: "3", mat: "MiÃ§anga", matd: "", cores: "", fin: "Fio solto",
  fqtd: "", fcor: "", ffmt: "", ping: false, pqtd: "", pqual: "", pmetal: "Prateado", fio: "Nylon", fech: "Com firma",
  env: "Fechado", tam: "60cm", transp: "", frete: "", pgto: "Pix", parc: "", valor: "", desconto: false, urg: false,
  taxa: "", pconf: "", pent: "", rastreio: "", status: "Novo", obs: "", obsInterna: "", imgs: [],
};

const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #D8D3C8", borderRadius: 12, padding: "11px 13px", fontSize: 14, fontFamily: "Poppins, sans-serif", background: "#FFFFFF", color: "#1F2937", outline: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)" };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, fontFamily: "Poppins, sans-serif" };
const ORDER_META_MARKER = "__ORDER_META__";
const LEGACY_EXTRA_ITEMS_MARKER = "__EXTRA_ITEMS__";

function generateId() { return `o_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }
function parseCurrency(value) {
  if (value === null || value === undefined) return 0;
  const normalized = String(value).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(amount || 0));
}

function getTotal(order) {
  const subtotal = parseCurrency(order.valor);
  const shipping = parseCurrency(order.frete);
  const urgency = order.urg ? parseCurrency(order.taxa) : 0;
  const discount = order.desconto ? subtotal * 0.05 : 0;
  return subtotal + shipping + urgency - discount;
}

function getDueTimestamp(order) {
  const base = order.pconf || order.pent;
  const timestamp = base ? new Date(base).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function isDueSoon(order) {
  const due = order.pconf || order.pent;
  if (!due || ["ConcluÃ­do", "Cancelado"].includes(order.status)) return false;
  const dueDate = new Date(due);
  const today = new Date();
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  return diff >= 0 && diff <= 2;
}

function getDueLabel(order) {
  const due = order.pconf || order.pent;
  if (!due || ["ConcluÃ­do", "Cancelado"].includes(order.status)) return "";
  const dueType = order.pconf ? "Confecção" : "Entrega";
  const dueDate = new Date(due);
  const today = new Date();
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${dueType} atrasada desde ${formatDate(due)}`;
  if (diff === 0) return `${dueType} hoje`;
  if (diff === 1) return `${dueType} amanhã`;
  if (diff === 2) return `${dueType} em 2 dias`;
  return `${dueType} ${formatDate(due)}`;
}

function isOverdue(order) {
  const due = order.pconf || order.pent;
  if (!due || ["ConcluÃ­do", "Cancelado"].includes(order.status)) return false;
  const dueDate = new Date(due);
  const today = new Date();
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return dueDate.getTime() < today.getTime();
}

function getUrgencyTone(order) {
  const due = order.pent || order.pconf;
  if (!due || ["ConcluÃƒÂ­do", "Cancelado"].includes(order.status)) {
    return { border: THEME.br, badgeBg: "#F3F4F6", badgeColor: THEME.tm, surface: THEME.panel };
  }
  const dueDate = new Date(due);
  const today = new Date();
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { border: "#DC2626", badgeBg: "#FEE2E2", badgeColor: "#991B1B", surface: "#FFF5F5" };
  if (diff === 0) return { border: "#EA580C", badgeBg: "#FFEDD5", badgeColor: "#C2410C", surface: "#FFF7ED" };
  if (diff === 1) return { border: "#F59E0B", badgeBg: "#FEF3C7", badgeColor: "#B45309", surface: "#FFFBEA" };
  if (diff === 2) return { border: "#D4A017", badgeBg: "#FEF3C7", badgeColor: "#9A6B00", surface: "#FFFCF0" };
  return { border: "#7C9A76", badgeBg: "#E8EFE6", badgeColor: "#496044", surface: THEME.panel };
}

function createExtraItem() {
  return { id: generateId(), tipo: "Guia", mat: "MiÃ§anga", matd: "", cores: "", tam: "60cm", detalhes: "" };
}

function splitOrderNotes(rawObs) {
  const source = rawObs || "";
  const markerIndex = source.indexOf(ORDER_META_MARKER);
  const legacyIndex = source.indexOf(LEGACY_EXTRA_ITEMS_MARKER);

  if (markerIndex === -1 && legacyIndex === -1) {
    return { visibleObs: source, extraItems: [], statusHistory: [], internalObs: "" };
  }

  if (markerIndex !== -1) {
    const visibleObs = source.slice(0, markerIndex).trim();
    const rawMeta = source.slice(markerIndex + ORDER_META_MARKER.length).trim();
    try {
      const parsed = JSON.parse(rawMeta);
      if (Array.isArray(parsed)) return { visibleObs, extraItems: parsed, statusHistory: [], internalObs: "" };
      return {
        visibleObs,
        extraItems: Array.isArray(parsed?.extraItems) ? parsed.extraItems : [],
        statusHistory: Array.isArray(parsed?.statusHistory) ? parsed.statusHistory : [],
        internalObs: parsed?.internalObs || "",
      };
    } catch {
      return { visibleObs: source.replace(ORDER_META_MARKER, "").trim(), extraItems: [], statusHistory: [], internalObs: "" };
    }
  }

  const visibleObs = source.slice(0, legacyIndex).trim();
  const rawMeta = source.slice(legacyIndex + LEGACY_EXTRA_ITEMS_MARKER.length).trim();
  try {
    const parsed = JSON.parse(rawMeta);
    return { visibleObs, extraItems: Array.isArray(parsed) ? parsed : [], statusHistory: [], internalObs: "" };
  } catch {
    return { visibleObs: source.replace(LEGACY_EXTRA_ITEMS_MARKER, "").trim(), extraItems: [], statusHistory: [], internalObs: "" };
  }
}

function buildOrderNotes(visibleObs, extraItems, statusHistory, internalObs) {
  const cleanObs = visibleObs?.trim() || "";
  const validItems = (extraItems || []).filter((item) => item && (item.cores || item.detalhes || item.mat || item.tipo));
  const validHistory = (statusHistory || []).filter((item) => item?.status && item?.at);
  const cleanInternalObs = internalObs?.trim() || "";
  if (!validItems.length && !validHistory.length && !cleanInternalObs) return cleanObs;
  return [cleanObs, ORDER_META_MARKER, JSON.stringify({ extraItems: validItems, statusHistory: validHistory, internalObs: cleanInternalObs })]
    .filter(Boolean)
    .join("\n\n");
}

function splitContact(value) {
  const raw = value || "";
  const parts = raw.split(" | @");
  if (parts.length === 2) return { contato: parts[0].trim(), instagram: parts[1].trim() };
  if (raw.trim().startsWith("@")) return { contato: "", instagram: raw.trim().slice(1) };
  return { contato: raw, instagram: "" };
}

function buildContact(contato, instagram) {
  const cleanContato = (contato || "").trim();
  const cleanInstagram = (instagram || "").trim().replace(/^@+/, "");
  if (cleanContato && cleanInstagram) return `${cleanContato} | @${cleanInstagram}`;
  if (cleanInstagram) return `@${cleanInstagram}`;
  return cleanContato;
}

function buildClientSummary(order, extraItems = [], visibleObs = "") {
  const contact = splitContact(order.contato);
  const lines = [
    "âœ¨ *Fechamento do seu pedido*",
    "",
    `Oi, ${order.nome}! Separei abaixo o resumo final do seu pedido:`,
    "",
    "ðŸ“¿ *PeÃ§a principal*",
    `${order.tipo}${order.tipo === "BrajÃ¡" ? ` ${order.fios} fios` : ""}`,
    `Material: ${order.mat}${order.matd ? ` (${order.matd})` : ""}`,
    `Cores: ${order.cores || "NÃ£o informado"}`,
    `Tamanho: ${order.tam}`,
    `Fio: ${order.fio}`,
    `Fechamento: ${order.fech}`,
    `Envio da peÃ§a: ${order.env}`,
    ...(order.tipo === "BrajÃ¡" ? [`FinalizaÃ§Ã£o: ${order.fin}`, `Firmas: ${order.fqtd ? `${order.fqtd}x ${order.ffmt || ""} ${order.fcor || ""}`.trim() : "NÃ£o informado"}`] : []),
    ...(order.ping ? [`Pingentes: ${order.pqual || "NÃ£o informado"}${order.pmetal ? ` (${order.pmetal})` : ""}`] : []),
    ...(extraItems.length ? ["", "ðŸ§© *PeÃ§as adicionais*", ...extraItems.map((item, index) => `${index + 2}. ${item.tipo} â€¢ ${item.mat}${item.matd ? ` ${item.matd}` : ""} â€¢ ${item.tam}${item.cores ? ` â€¢ ${item.cores}` : ""}${item.detalhes ? ` â€¢ ${item.detalhes}` : ""}`)] : []),
    "",
    "ðŸ’° *Pagamento e entrega*",
    `Produto: ${formatCurrency(parseCurrency(order.valor))}`,
    `Frete: ${formatCurrency(parseCurrency(order.frete))}`,
    ...(order.urg ? [`Taxa de urgÃªncia: ${formatCurrency(parseCurrency(order.taxa))}`] : []),
    ...(order.desconto ? ["Desconto Pix aplicado: 5%"] : []),
    `Total final: ${formatCurrency(getTotal(order))}`,
    `Pagamento: ${order.pgto}${order.parc ? ` ${order.parc}` : ""}`,
    ...(order.transp ? [`Transportadora: ${order.transp}`] : []),
    ...(order.pconf ? [`PrevisÃ£o de confecÃ§Ã£o: ${formatDate(order.pconf)}`] : []),
    ...(order.pent ? [`PrevisÃ£o de entrega: ${formatDate(order.pent)}`] : []),
    ...(visibleObs ? ["", `ðŸ“ ObservaÃ§Ãµes: ${visibleObs}`] : []),
    "",
    "Se estiver tudo certinho, seguimos com a produÃ§Ã£o ðŸ¤",
  ];
  if (contact.instagram && order.canal === "Instagram DM") {
    lines.splice(3, 0, `Instagram: @${contact.instagram}`);
  }
  return lines.join("\n");
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCurrencyInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits) / 100;
  return cents.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseOptionsInput(value, fallback) {
  const items = String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function getStatusHistoryEntry(status) {
  return { id: generateId(), status, at: new Date().toISOString() };
}

function applyStatusDefaults(order, nextStatus) {
  const next = { ...order, status: nextStatus };
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  if (nextStatus === "Em ProduÃ§Ã£o" && !next.pconf) {
    const productionDate = new Date(today);
    productionDate.setDate(productionDate.getDate() + 3);
    next.pconf = productionDate.toISOString().slice(0, 10);
  }
  if (nextStatus === "Postado") {
    if (!next.pconf) next.pconf = iso;
    if (!next.pent) {
      const deliveryDate = new Date(today);
      deliveryDate.setDate(deliveryDate.getDate() + 7);
      next.pent = deliveryDate.toISOString().slice(0, 10);
    }
  }
  if (nextStatus === "ConcluÃ­do" && !next.pent) next.pent = iso;
  return next;
}

function buildTrackingLink(order) {
  const code = (order.rastreio || "").trim();
  if (!code) return "";
  if (order.transp === "Correios") return `https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(code)}`;
  return "";
}

function buildTrackingMessage(order) {
  const contact = splitContact(order.contato);
  const trackingLink = buildTrackingLink(order);
  return [
    `Oi, ${order.nome}! Seu pedido jÃ¡ foi enviado ðŸ¤`,
    "",
    `Transportadora: ${order.transp || "NÃ£o informada"}`,
    `CÃ³digo de rastreio: ${order.rastreio || "NÃ£o informado"}`,
    ...(trackingLink ? ["", `Acompanhe aqui: ${trackingLink}`] : []),
    ...(order.pent ? ["", `PrevisÃ£o de entrega: ${formatDate(order.pent)}`] : []),
    "",
    "Qualquer dÃºvida, fico Ã  disposiÃ§Ã£o.",
    ...(contact.instagram ? [`Instagram: @${contact.instagram}`] : []),
  ].join("\n");
}
function formatDate(date) {
  if (!date) return "â€”";
  try { return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
  catch { return date; }
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 900;
        const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      image.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function Segmented({ opts, val, onChange, small }) {
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{opts.map((opt) => <button key={opt} type="button" onClick={() => onChange(opt)} style={{ padding: small ? "5px 11px" : "8px 16px", borderRadius: 999, fontSize: small ? 12 : 13, fontWeight: 600, border: `1px solid ${val === opt ? THEME.primary : THEME.br}`, background: val === opt ? THEME.primary : "#FFFFFF", color: val === opt ? "#FFFFFF" : THEME.tm, cursor: "pointer", fontFamily: "Poppins, sans-serif", boxShadow: val === opt ? "0 10px 20px rgba(78,95,77,0.18)" : "none" }}>{opt}</button>)}</div>;
}

function Field({ label, children, full }) {
  return <div style={{ marginBottom: 13, gridColumn: full ? "1 / -1" : "auto" }}><label style={labelStyle}>{label}</label>{children}</div>;
}

function Section({ title, children }) {
  return <div style={{ marginBottom: 22 }}><div style={{ fontSize: 12, fontWeight: 800, color: THEME.primary, letterSpacing: 0.9, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${THEME.br}`, fontFamily: "Poppins, sans-serif" }}>{title}</div>{children}</div>;
}

function Form({ init, onSave, onCancel, isEdit, customerSuggestions = [], channels = CHANNELS, shippers = SHIPPERS, sizes = SIZES, isMobile = false }) {
  const parsedInit = splitOrderNotes(init?.obs);
  const parsedContact = splitContact(init?.contato);
  const [form, setForm] = useState({ ...EMPTY, ...(init || {}), contato: parsedContact.contato, instagram: parsedContact.instagram, obs: parsedInit.visibleObs, obsInterna: parsedInit.internalObs || "" });
  const [images, setImages] = useState(init?.imgs || []);
  const [extraItems, setExtraItems] = useState(parsedInit.extraItems);
  const [statusHistory, setStatusHistory] = useState(parsedInit.statusHistory.length ? parsedInit.statusHistory : [getStatusHistoryEntry((init || EMPTY).status)]);
  const [mode, setMode] = useState("manual");
  const [conversation, setConversation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const detailOptions = MATERIAL_DETAILS[form.mat] || [];
  const twoCol = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 };
  const threeCol = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 };
  const fourCol = { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const handleStatusChange = (value) => {
    setForm((prev) => applyStatusDefaults(prev, value));
    setStatusHistory((prev) => prev.at(-1)?.status === value ? prev : [...prev, getStatusHistoryEntry(value)]);
  };

  const handleImages = async (files) => {
    const remaining = 4 - images.length;
    if (remaining <= 0) return;
    const compressed = await Promise.all(Array.from(files).slice(0, remaining).map(compressImage));
    setImages((prev) => [...prev, ...compressed].slice(0, 4));
  };

  const moveImage = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setImages((prev) => {
      const clone = [...prev];
      [clone[index], clone[target]] = [clone[target], clone[index]];
      return clone;
    });
  };

  const extractWithAI = async () => {
    if (!conversation.trim()) return;
    setAiLoading(true);
    try {
      const response = await fetch("/api/extract-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation, channel: form.canal }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Falha ao analisar a conversa.");
      setForm((prev) => ({ ...prev, ...payload.order }));
      setMode("manual");
    } catch (error) {
      alert(error.message || "Erro ao analisar. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  };

  const save = async () => {
    if (!form.nome.trim()) {
      alert("Nome do cliente Ã© obrigatÃ³rio.");
      return;
    }
    setSaving(true);
    const id = form.id || generateId();
    const { instagram, obsInterna, ...dbForm } = form;
    const row = {
      ...dbForm,
      id,
      contato: buildContact(form.contato, form.instagram),
      obs: buildOrderNotes(form.obs, extraItems, statusHistory, form.obsInterna),
      imgs: images,
      criado_em: form.criado_em || new Date().toISOString(),
      upd: new Date().toISOString(),
    };
    const { error } = await supabase.from("pedidos").upsert(row);
    if (error) {
      alert("Erro ao salvar. Tente novamente.");
      console.error(error);
    } else {
      onSave(row);
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["manual", "âœï¸ Manual"], ["ia", AI_ENABLED ? "âœ¨ Extrair com IA" : "ðŸ”’ IA em breve"]].map(([key, label]) => (
          <button key={key} type="button" disabled={key === "ia" && !AI_ENABLED} onClick={() => setMode(key)} style={{ flex: 1, padding: "12px", borderRadius: 14, fontSize: 13, fontWeight: 700, border: `1px solid ${mode === key ? THEME.primary : THEME.br}`, background: mode === key ? THEME.primary : "#FFFFFF", color: mode === key ? "#FFFFFF" : THEME.tm, cursor: key === "ia" && !AI_ENABLED ? "not-allowed" : "pointer", opacity: key === "ia" && !AI_ENABLED ? 0.6 : 1, fontFamily: "Poppins, sans-serif", boxShadow: mode === key ? "0 14px 30px rgba(78,95,77,0.18)" : "none" }}>
            {label}
          </button>
        ))}
      </div>

      {mode === "ia" && AI_ENABLED && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 10 }}>
            <Segmented opts={channels} val={form.canal} onChange={(value) => setField("canal", value)} small />
          </div>
          <textarea value={conversation} onChange={(event) => setConversation(event.target.value)} placeholder={`Cole a conversa do ${form.canal}...\n\nEx: Quero brajÃ¡ 7 fios miÃ§anga jablonex, vermelho e preto, 7 firmas meteoro rajada, pingente tridente prateado, 70cm, pix R$180`} style={{ ...inputStyle, height: 160, resize: "vertical", lineHeight: 1.7 }} />
          <div style={{ fontSize: 12, color: THEME.tl, marginTop: 8 }}>Essa funÃ§Ã£o usa uma API no Vercel. Se nÃ£o houver chave configurada, o restante do sistema continua funcionando no modo manual.</div>
          <button type="button" onClick={extractWithAI} disabled={aiLoading || !conversation.trim()} style={{ width: "100%", marginTop: 10, padding: "13px", borderRadius: 10, border: "none", background: aiLoading || !conversation.trim() ? "#D5C5A0" : "linear-gradient(135deg,#C8853A,#E8B96A)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: aiLoading || !conversation.trim() ? "not-allowed" : "pointer", fontFamily: "Georgia, serif" }}>
            {aiLoading ? "â³ Analisando..." : "âœ¨ Extrair Pedido"}
          </button>
        </div>
      )}

      {!AI_ENABLED && (
        <div style={{ marginBottom: 20, background: "#FFFFFF", border: `1px solid ${THEME.br}`, borderRadius: 14, padding: "13px 15px", color: THEME.tl, fontSize: 13, lineHeight: 1.6, fontFamily: "Poppins, sans-serif" }}>
          A extraÃ§Ã£o com IA estÃ¡ temporariamente desativada. O cadastro manual continua funcionando normalmente.
        </div>
      )}

      <Section title="ðŸ‘¤ Cliente">
        <div style={twoCol}>
          <Field label="Nome *"><input list="clientes-sugestoes" value={form.nome} onChange={(event) => setField("nome", event.target.value)} style={inputStyle} placeholder="Nome completo" /></Field>
          <Field label="Contato"><input value={form.contato} onChange={(event) => setField("contato", formatPhone(event.target.value))} style={inputStyle} placeholder="(11) 99999-9999" /></Field>
        </div>
        <Field label="Instagram @"><input value={form.instagram || ""} onChange={(event) => setField("instagram", event.target.value.replace(/^@+/, ""))} style={inputStyle} placeholder="usuario" /></Field>
        <datalist id="clientes-sugestoes">
          {customerSuggestions.map((item, index) => <option key={`${item.nome}-${index}`} value={item.nome} />)}
        </datalist>
        <Field label="Canal"><Segmented opts={channels} val={form.canal} onChange={(value) => setField("canal", value)} /></Field>
      </Section>

      <Section title="ðŸ“¿ ConstruÃ§Ã£o da PeÃ§a">
        <Field label="Tipo de PeÃ§a">
          <Segmented opts={["Guia", "BrajÃ¡"]} val={form.tipo} onChange={(value) => { setField("tipo", value); if (value === "Guia") setField("fios", "1"); }} />
        </Field>
        {form.tipo === "BrajÃ¡" && <Field label="NÃºmero de Fios"><Segmented opts={["3", "5", "7"]} val={form.fios} onChange={(value) => setField("fios", value)} /></Field>}
        <Field label="Material">
          <Segmented opts={MATERIALS} val={form.mat} onChange={(value) => { setField("mat", value); setField("matd", ""); }} />
        </Field>
        {detailOptions.length > 0 && <Field label={MATERIAL_LABELS[form.mat] || "Detalhe"}><Segmented opts={detailOptions} val={form.matd} onChange={(value) => setField("matd", value)} /></Field>}
        <Field label="Cores" full><textarea value={form.cores} onChange={(event) => setField("cores", event.target.value)} style={{ ...inputStyle, minHeight: 72, resize: "vertical", lineHeight: 1.6 }} placeholder="Ex: vermelho, preto e branco alternados" /></Field>
        {form.tipo === "BrajÃ¡" && <Field label="FinalizaÃ§Ã£o"><Segmented opts={["Fio solto", "Fio tranÃ§ado"]} val={form.fin} onChange={(value) => setField("fin", value)} /></Field>}
        {form.tipo === "BrajÃ¡" && (
          <div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 14, padding: "13px 15px", marginBottom: 13 }}>
            <div style={{ ...labelStyle, marginBottom: 11 }}>ðŸ§¿ Firmas</div>
            <div style={threeCol}>
              <Field label="Quantidade"><input value={form.fqtd} onChange={(event) => setField("fqtd", event.target.value)} style={inputStyle} placeholder="Ex: 7" /></Field>
              <Field label="Cor"><input value={form.fcor} onChange={(event) => setField("fcor", event.target.value)} style={inputStyle} placeholder="Ex: rajada" /></Field>
              <Field label="Formato">
                <select value={form.ffmt} onChange={(event) => setField("ffmt", event.target.value)} style={inputStyle}>
                  <option value="">Selecionar...</option>
                  {FIRM_FORMATS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
            </div>
          </div>
        )}
        <div style={twoCol}>
          <Field label="Fio"><Segmented opts={["Nylon", "CordonÃª"]} val={form.fio} onChange={(value) => setField("fio", value)} /></Field>
          <Field label="Tamanho">
            <select value={form.tam} onChange={(event) => setField("tam", event.target.value)} style={inputStyle}>
              {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </Field>
        </div>
        <div style={twoCol}>
          <Field label="Fechamento"><Segmented opts={["Com firma", "Sem firma"]} val={form.fech} onChange={(value) => setField("fech", value)} /></Field>
          <Field label="Enviar"><Segmented opts={["Fechado", "Aberto"]} val={form.env} onChange={(value) => setField("env", value)} /></Field>
        </div>
        <div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 14, padding: "13px 15px", marginBottom: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: form.ping ? 13 : 0 }}>
            <input type="checkbox" checked={form.ping} onChange={(event) => setField("ping", event.target.checked)} style={{ width: 18, height: 18, accentColor: THEME.primary }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: THEME.tm, fontFamily: "Poppins, sans-serif" }}>Tem Pingente?</span>
          </label>
          {form.ping && (
            <div style={threeCol}>
              <Field label="Quantidade"><input value={form.pqtd} onChange={(event) => setField("pqtd", event.target.value)} style={inputStyle} placeholder="Ex: 1" /></Field>
              <Field label="Quais pingentes" full><textarea value={form.pqual} onChange={(event) => setField("pqual", event.target.value)} style={{ ...inputStyle, minHeight: 72, resize: "vertical", lineHeight: 1.6 }} placeholder={"Ex:\n1 tridente\n1 firma\n1 espada"} /></Field>
              <Field label="Metal"><Segmented opts={["Prateado", "Dourado"]} val={form.pmetal} onChange={(value) => setField("pmetal", value)} small /></Field>
            </div>
          )}
        </div>
      </Section>

      <Section title="ðŸ’° Comercial e Envio">
        <div style={twoCol}>
          <Field label="Valor Total (R$)"><input value={form.valor} onChange={(event) => setField("valor", formatCurrencyInput(event.target.value))} style={inputStyle} placeholder="Ex: 150,00" /></Field>
          <Field label="Pagamento"><Segmented opts={["Pix", "CartÃ£o"]} val={form.pgto} onChange={(value) => setField("pgto", value)} /></Field>
        </div>
        {form.pgto === "CartÃ£o" && (
          <Field label="Parcelas">
            <select value={form.parc} onChange={(event) => setField("parc", event.target.value)} style={inputStyle}>
              <option value="">Ã€ vista</option>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((count) => <option key={count} value={`${count}x`}>{count}x (juros cliente)</option>)}
            </select>
          </Field>
        )}
        <div style={{ display: "flex", gap: 24, marginBottom: 13 }}>
          {[["desconto", "ðŸ·ï¸ Desconto 5% Pix"], ["urg", "âš¡ Pedido Urgente"]].map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: THEME.tm, fontFamily: "Poppins, sans-serif" }}>
              <input type="checkbox" checked={form[key]} onChange={(event) => setField(key, event.target.checked)} style={{ width: 18, height: 18, accentColor: THEME.primary }} />
              {label}
            </label>
          ))}
        </div>
        {form.urg && <Field label="Taxa UrgÃªncia (R$)"><input value={form.taxa} onChange={(event) => setField("taxa", formatCurrencyInput(event.target.value))} style={inputStyle} placeholder="Ex: 30,00" /></Field>}
        <Field label="Total Final">
          <div style={{ ...inputStyle, display: "flex", alignItems: "center", minHeight: 46, fontWeight: 700, color: THEME.primary, background: THEME.primarySoft }}>
            {formatCurrency(getTotal(form))}
          </div>
        </Field>
        <div style={twoCol}>
          <Field label="Transportadora">
            <select value={form.transp} onChange={(event) => setField("transp", event.target.value)} style={inputStyle}>
              <option value="">Selecionar...</option>
              {shippers.map((shipper) => <option key={shipper} value={shipper}>{shipper}</option>)}
            </select>
          </Field>
          <Field label="Frete (R$)"><input value={form.frete} onChange={(event) => setField("frete", formatCurrencyInput(event.target.value))} style={inputStyle} placeholder="Ex: 25,00" /></Field>
        </div>
        <div style={twoCol}>
          <Field label="ConfecÃ§Ã£o atÃ©"><input type="date" value={form.pconf} onChange={(event) => setField("pconf", event.target.value)} style={inputStyle} /></Field>
          <Field label="Entrega Estimada"><input type="date" value={form.pent} onChange={(event) => setField("pent", event.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="CÃ³digo de Rastreio" full><input value={form.rastreio} onChange={(event) => setField("rastreio", event.target.value)} style={inputStyle} placeholder="Ex: BR123456789BR" /></Field>
      </Section>

      <Section title="ðŸ“· Imagens de ReferÃªncia">
        <div onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleImages(event.dataTransfer.files); }} style={{ border: `2px dashed ${THEME.br}`, borderRadius: 14, padding: "18px 16px", textAlign: "center", cursor: "pointer", background: THEME.panel, marginBottom: 10 }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>ðŸ“Ž</div>
          <div style={{ fontWeight: 600, color: THEME.tm, fontSize: 14, fontFamily: "Poppins, sans-serif" }}>Clique ou arraste as imagens</div>
          <div style={{ fontSize: 12, color: THEME.tl, marginTop: 3, fontFamily: "Poppins, sans-serif" }}>AtÃ© 4 fotos Â· JPG, PNG, WEBP</div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => handleImages(event.target.files)} />
        </div>
        {images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 8 }}>
            {images.map((image, index) => (
              <div key={index} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: `1px solid ${THEME.br}` }}>
                <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", left: 4, bottom: 4, display: "flex", gap: 4 }}>
                  <button type="button" onClick={(event) => { event.stopPropagation(); moveImage(index, -1); }} style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.88)", color: THEME.tm, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>â†</button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); moveImage(index, 1); }} style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.88)", color: THEME.tm, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>â†’</button>
                </div>
                <button type="button" onClick={(event) => { event.stopPropagation(); setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index)); }} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>âœ•</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="ðŸ“ ObservaÃ§Ãµes e Status">
        <Field label="ObservaÃ§Ãµes" full><textarea value={form.obs} onChange={(event) => setField("obs", event.target.value)} style={{ ...inputStyle, height: 75, resize: "vertical", lineHeight: 1.6 }} placeholder="Detalhes especiais, urgÃªncias..." /></Field>
        <Field label="ObservaÃ§Ã£o interna" full><textarea value={form.obsInterna || ""} onChange={(event) => setField("obsInterna", event.target.value)} style={{ ...inputStyle, height: 75, resize: "vertical", lineHeight: 1.6, background: "#FFFDF7" }} placeholder="AnotaÃ§Ãµes sÃ³ para vocÃª. NÃ£o entram no resumo do cliente." /></Field>
        <Field label="Status"><Segmented opts={STATUS_LIST} val={form.status} onChange={handleStatusChange} small /></Field>
      </Section>

      <Section title="ðŸ’¼ Resumo Financeiro">
        <div style={fourCol}>
          {[
            ["Produto", formatCurrency(parseCurrency(form.valor))],
            ["Frete", formatCurrency(parseCurrency(form.frete))],
            ["UrgÃªncia", formatCurrency(form.urg ? parseCurrency(form.taxa) : 0)],
            ["Total", formatCurrency(getTotal(form))],
          ].map(([label, value]) => (
            <div key={label} style={{ background: label === "Total" ? THEME.primarySoft : THEME.soft, border: `1px solid ${THEME.br}`, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ ...labelStyle, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: label === "Total" ? THEME.primary : THEME.tm, fontFamily: "Poppins, sans-serif" }}>{value}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ðŸ§© PeÃ§as Adicionais">
        <div style={{ marginBottom: 12, color: THEME.tl, fontSize: 13, fontFamily: "Poppins, sans-serif" }}>
          Use essa Ã¡rea quando o mesmo cliente comprar mais de uma peÃ§a no mesmo pedido.
        </div>
        {extraItems.map((item, index) => {
          const detailOptions = MATERIAL_DETAILS[item.mat] || [];
          return (
            <div key={item.id} style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ color: THEME.gold, fontWeight: 700, fontSize: 13, fontFamily: "Poppins, sans-serif" }}>PeÃ§a {index + 2}</div>
                <button
                  type="button"
                  onClick={() => setExtraItems((prev) => prev.filter((extra) => extra.id !== item.id))}
                  style={{ border: `1px solid ${THEME.br}`, background: "transparent", color: "#F87171", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}
                >
                  Remover
                </button>
              </div>
              <div style={twoCol}>
                <Field label="Tipo da peÃ§a">
                  <Segmented
                    opts={["Guia", "BrajÃ¡"]}
                    val={item.tipo}
                    onChange={(value) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, tipo: value } : extra)))}
                  />
                </Field>
                <Field label="Material">
                  <Segmented
                    opts={MATERIALS}
                    val={item.mat}
                    onChange={(value) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, mat: value, matd: "" } : extra)))}
                  />
                </Field>
              </div>
              {detailOptions.length > 0 && (
                <Field label={MATERIAL_LABELS[item.mat] || "Detalhe"}>
                  <Segmented
                    opts={detailOptions}
                    val={item.matd}
                    onChange={(value) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, matd: value } : extra)))}
                  />
                </Field>
              )}
              <div style={twoCol}>
                <Field label="Cores">
                  <input value={item.cores} onChange={(event) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, cores: event.target.value } : extra)))} style={inputStyle} placeholder="Ex: preto e amarelo" />
                </Field>
                <Field label="Tamanho">
                  <select value={item.tam} onChange={(event) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, tam: event.target.value } : extra)))} style={inputStyle}>
                    {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Detalhes" full>
                <textarea value={item.detalhes} onChange={(event) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, detalhes: event.target.value } : extra)))} style={{ ...inputStyle, height: 72, resize: "vertical", lineHeight: 1.6 }} placeholder="Firmas, pingente, acabamento ou qualquer diferenÃ§a dessa peÃ§a" />
              </Field>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setExtraItems((prev) => [...prev, createExtraItem()])}
          style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px dashed ${THEME.br}`, background: "transparent", color: THEME.gold, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}
        >
          + Adicionar outra peÃ§a ao pedido
        </button>
      </Section>

      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        {onCancel && <button type="button" onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${THEME.br}`, background: "#FFFFFF", color: THEME.tm, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>Cancelar</button>}
        <button type="button" onClick={save} disabled={saving} style={{ flex: 2, padding: "14px", borderRadius: 14, border: "none", background: saving ? "#A8B1A6" : `linear-gradient(135deg,${THEME.primary},${THEME.primaryDark})`, color: "#FFFFFF", fontSize: 15, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "Poppins, sans-serif", boxShadow: "0 16px 32px rgba(78,95,77,0.20)" }}>
          {saving ? "â³ Salvando..." : isEdit ? "ðŸ’¾ Salvar AlteraÃ§Ãµes" : "âœ… Criar Pedido"}
        </button>
      </div>
    </div>
  );
}

function Card({ order, onUpdate, onDelete, onDuplicate, onToast, isMobile = false }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [viewer, setViewer] = useState(null);
  const statusColors = STATUS_COLORS[order.status] || STATUS_COLORS.Novo;
  const images = order.imgs || [];
  const parsedNotes = splitOrderNotes(order.obs);
  const visibleObs = parsedNotes.visibleObs;
  const extraItems = parsedNotes.extraItems;
  const internalObs = parsedNotes.internalObs;
  const parsedContact = splitContact(order.contato);
  const overdue = isOverdue(order);
  const dueSoon = isDueSoon(order);
  const clientSummary = buildClientSummary(order, extraItems, visibleObs);
  const dueLabel = getDueLabel(order);
  const trackingLink = buildTrackingLink(order);
  const trackingMessage = buildTrackingMessage(order);

  if (edit) {
    return <div style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 18, padding: 20, marginBottom: 10, boxShadow: "0 18px 40px rgba(31,41,55,0.08)" }}><Form init={order} isEdit isMobile={isMobile} onSave={(updated) => { onUpdate(updated); setEdit(false); }} onCancel={() => setEdit(false)} /></div>;
  }

  const pairs = [
    ["Tipo", `${order.tipo}${order.tipo === "BrajÃ¡" ? ` ${order.fios} fios` : ""}`],
    ["Material", `${order.mat}${order.matd ? ` Â· ${order.matd}` : ""}`],
    ["Tamanho", order.tam], ["Cores", order.cores], ["Fio", order.fio], ["Fechamento", order.fech], ["Enviar", order.env],
    ...(order.tipo === "BrajÃ¡" ? [["FinalizaÃ§Ã£o", order.fin], ["Firmas", order.fqtd ? `${order.fqtd}x ${order.ffmt || ""} ${order.fcor || ""}`.trim() : "â€”"]] : []),
    ...(order.ping ? [["Pingente", `${order.pqtd}x ${order.pqual} (${order.pmetal})`]] : []),
    ["Valor", order.valor ? `R$ ${order.valor}` : "â€”"],
    ["Total Final", formatCurrency(getTotal(order))],
    ["Pagamento", `${order.pgto}${order.parc ? ` ${order.parc}` : ""}${order.desconto ? " (-5%)" : ""}`],
    ["Transp.", order.transp || "â€”"], ["Frete", order.frete ? `R$ ${order.frete}` : "â€”"],
    ...(order.urg ? [["Urgente", `Taxa R$ ${order.taxa || "â€”"}`]] : []),
    ["ConfecÃ§Ã£o", formatDate(order.pconf)], ["Entrega", formatDate(order.pent)],
    ...(order.rastreio ? [["Rastreio", order.rastreio]] : []),
    ["Canal", `${order.canal}${parsedContact.instagram ? ` Â· @${parsedContact.instagram}` : ""}`], ["Criado", formatDate(order.criado_em)],
  ];

  const copy = async () => {
    const lines = [
      `*PEDIDO* ${order.nome}`,
      `Contato: ${parsedContact.contato || "â€”"}${parsedContact.instagram ? ` | @${parsedContact.instagram}` : ""}`,
      `Canal: ${order.canal}`,
      "",
      `*PEÃ‡A PRINCIPAL*`,
      `${order.tipo}${order.tipo === "BrajÃ¡" ? ` ${order.fios} fios` : ""}`,
      `Material: ${order.mat}${order.matd ? ` (${order.matd})` : ""}`,
      `Cores: ${order.cores || "â€”"}`,
      `Tamanho: ${order.tam} | Fio: ${order.fio}`,
      `Fechamento: ${order.fech} | Envio: ${order.env}`,
      ...(order.tipo === "BrajÃ¡" ? [`FinalizaÃ§Ã£o: ${order.fin}`, `Firmas: ${order.fqtd ? `${order.fqtd}x ${order.ffmt || ""} ${order.fcor || ""}`.trim() : "â€”"}`] : []),
      ...(order.ping ? [`Pingentes: ${order.pqtd || "â€”"} | ${order.pqual || "â€”"} (${order.pmetal})`] : []),
      ...(extraItems.length ? ["", "*PEÃ‡AS ADICIONAIS*", ...extraItems.map((item, index) => `${index + 2}. ${item.tipo} | ${item.mat}${item.matd ? ` ${item.matd}` : ""} | ${item.tam}${item.cores ? ` | ${item.cores}` : ""}${item.detalhes ? ` | ${item.detalhes}` : ""}`)] : []),
      "",
      "*COMERCIAL*",
      `Produto: ${formatCurrency(parseCurrency(order.valor))}`,
      `Frete: ${formatCurrency(parseCurrency(order.frete))}`,
      `Taxa urgÃªncia: ${formatCurrency(order.urg ? parseCurrency(order.taxa) : 0)}`,
      `Total final: ${formatCurrency(getTotal(order))}`,
      `Pagamento: ${order.pgto}${order.parc ? ` ${order.parc}` : ""}${order.desconto ? " com desconto Pix" : ""}`,
      `Transp: ${order.transp || "â€”"}`,
      `ConfecÃ§Ã£o: ${formatDate(order.pconf)} | Entrega: ${formatDate(order.pent)}`,
      ...(order.rastreio ? [`Rastreio: ${order.rastreio}`] : []),
      ...(visibleObs ? ["", `Obs: ${visibleObs}`] : []),
      "",
      `Status: ${order.status}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    onToast?.("Pedido copiado.");
  };
  const copyClientSummary = async () => {
    await navigator.clipboard.writeText(clientSummary);
    onToast?.("Resumo do cliente copiado.");
  };
  const copyTrackingMessage = async () => {
    await navigator.clipboard.writeText(trackingMessage);
    onToast?.("Mensagem de rastreio copiada.");
  };
  const updateStatus = async (nextStatus) => {
    const currentStatus = order.status;
    if (currentStatus === nextStatus) return;
    if (["ConcluÃ­do", "Cancelado"].includes(nextStatus)) {
      const ok = window.confirm(`Confirmar mudanÃ§a para "${nextStatus}"?`);
      if (!ok) return;
    }
    const nextOrder = applyStatusDefaults(order, nextStatus);
    const nextHistory = parsedNotes.statusHistory?.at(-1)?.status === nextStatus ? parsedNotes.statusHistory : [...(parsedNotes.statusHistory || []), getStatusHistoryEntry(nextStatus)];
    const { error } = await supabase.from("pedidos").update({
      status: nextOrder.status,
      pconf: nextOrder.pconf,
      pent: nextOrder.pent,
      obs: buildOrderNotes(visibleObs, extraItems, nextHistory, internalObs),
    }).eq("id", order.id);
    if (!error) onUpdate({ ...nextOrder, obs: buildOrderNotes(visibleObs, extraItems, nextHistory, internalObs) });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Excluir pedido de ${order.nome}?`)) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", order.id);
    if (!error) onDelete(order.id);
  };

  return (
    <div style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 18, marginBottom: 12, overflow: "hidden", boxShadow: "0 18px 40px rgba(31,41,55,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: overdue ? "#FFF4E8" : THEME.panel, borderBottom: open ? `1px solid ${THEME.br}` : "none", cursor: "pointer" }} onClick={() => setOpen((value) => !value)}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg,${THEME.primary},${THEME.primaryDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, color: "#FFFFFF" }}>ðŸ”®</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: THEME.tm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Poppins, sans-serif" }}>{order.nome || "Cliente"}</div>
          <div style={{ fontSize: 12, color: THEME.tl, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.tipo}{order.tipo === "BrajÃ¡" ? ` ${order.fios}f` : ""} Â· {order.mat}{order.matd ? ` ${order.matd}` : ""} Â· {order.tam}{parsedContact.contato ? ` Â· ${parsedContact.contato}` : parsedContact.instagram ? ` Â· @${parsedContact.instagram}` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {overdue && <span style={{ fontSize: 10, background: "#F97316", color: "#FFFFFF", padding: "2px 8px", borderRadius: 20, fontWeight: 700, fontFamily: "Poppins, sans-serif" }}>ATRASADO</span>}
          {!overdue && dueSoon && <span style={{ fontSize: 10, background: "#FBBF24", color: "#FFFFFF", padding: "2px 8px", borderRadius: 20, fontWeight: 700, fontFamily: "Poppins, sans-serif" }}>PRAZO</span>}
          {order.urg && <span style={{ fontSize: 10, background: "#FFF7E2", color: THEME.gold, padding: "2px 8px", borderRadius: 20, fontWeight: 700, fontFamily: "Poppins, sans-serif", border: `1px solid #EED9B0` }}>âš¡</span>}
          <select value={order.status} onChange={async (event) => { event.stopPropagation(); await updateStatus(event.target.value); }} onClick={(event) => event.stopPropagation()} style={{ border: "none", background: statusColors.bg, color: statusColors.cl, padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none", fontFamily: "Poppins, sans-serif" }}>
            {STATUS_LIST.map((status) => <option key={status} value={status}>{STATUS_COLORS[status].em} {status}</option>)}
          </select>
          <span style={{ color: THEME.tl, fontSize: 11 }}>{open ? "â–²" : "â–¼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 8, marginBottom: 13 }}>
            {pairs.map(([key, value]) => <div key={key} style={{ background: THEME.soft, borderRadius: 12, padding: "9px 11px", border: `1px solid ${THEME.br}` }}><div style={{ fontSize: 10, fontWeight: 700, color: THEME.tl, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 2, fontFamily: "Poppins, sans-serif" }}>{key}</div><div style={{ fontSize: 13, color: THEME.tm, wordBreak: "break-word", whiteSpace: "pre-wrap", fontFamily: "Poppins, sans-serif" }}>{value || "â€”"}</div></div>)}
          </div>
          {parsedNotes.statusHistory?.length > 0 && (
            <div style={{ background: "#FFFFFF", border: `1px solid ${THEME.br}`, borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ ...labelStyle, marginBottom: 8, color: THEME.primary }}>Linha do tempo</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {parsedNotes.statusHistory.map((item, index) => (
                  <div key={item.id || index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ background: THEME.primarySoft, border: `1px solid ${THEME.br}`, borderRadius: 999, padding: "6px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: THEME.primary, fontFamily: "Poppins, sans-serif" }}>{item.status}</div>
                      <div style={{ fontSize: 10, color: THEME.tl, fontFamily: "Poppins, sans-serif" }}>{formatDate(item.at)}</div>
                    </div>
                    {index < parsedNotes.statusHistory.length - 1 && <div style={{ width: 16, height: 1, background: THEME.br }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
          {dueLabel && (
            <div style={{ background: overdue ? "#FFF4E8" : dueSoon ? "#FFFBEA" : THEME.panel, border: `1px solid ${overdue ? "#FDBA74" : dueSoon ? "#FDE68A" : THEME.br}`, borderRadius: 12, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: overdue ? "#C2410C" : dueSoon ? "#A16207" : THEME.tm, fontWeight: 600, fontFamily: "Poppins, sans-serif" }}>
              {dueLabel}
            </div>
          )}
          {extraItems.length > 0 && (
            <div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ ...labelStyle, marginBottom: 8, color: THEME.gold }}>PeÃ§as adicionais</div>
              <div style={{ display: "grid", gap: 8 }}>
                {extraItems.map((item, index) => (
                  <div key={item.id || index} style={{ background: THEME.soft, border: `1px solid ${THEME.br}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: THEME.tm, marginBottom: 4, fontFamily: "Poppins, sans-serif" }}>PeÃ§a {index + 2}</div>
                    <div style={{ fontSize: 13, color: THEME.tm, lineHeight: 1.6, fontFamily: "Poppins, sans-serif" }}>
                      {item.tipo} Â· {item.mat}{item.matd ? ` Â· ${item.matd}` : ""} Â· {item.tam}
                      {item.cores ? ` Â· ${item.cores}` : ""}
                      {item.detalhes ? ` Â· ${item.detalhes}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {visibleObs && <div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: THEME.tm, lineHeight: 1.6, fontFamily: "Poppins, sans-serif", whiteSpace: "pre-wrap" }}><strong>Obs:</strong> {visibleObs}</div>}
          {internalObs && <div style={{ background: "#FFFDF7", border: `1px solid ${THEME.br}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: THEME.tm, lineHeight: 1.6, fontFamily: "Poppins, sans-serif", whiteSpace: "pre-wrap" }}><strong>Obs. interna:</strong> {internalObs}</div>}
          {order.rastreio && (
            <div style={{ background: "#FFFFFF", border: `1px solid ${THEME.br}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12, boxShadow: "0 10px 24px rgba(31,41,55,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ ...labelStyle, marginBottom: 0, color: THEME.primary }}>Rastreio para cliente</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={copyTrackingMessage} style={{ padding: "7px 12px", borderRadius: 10, border: `1px solid ${THEME.primary}`, background: "#FFFFFF", color: THEME.primary, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>Copiar mensagem</button>
                  {trackingLink && <a href={trackingLink} target="_blank" rel="noreferrer" style={{ padding: "7px 12px", borderRadius: 10, border: `1px solid ${THEME.br}`, background: "#FFFFFF", color: THEME.tm, fontSize: 12, fontWeight: 700, textDecoration: "none", fontFamily: "Poppins, sans-serif" }}>Abrir rastreio</a>}
                </div>
              </div>
              <div style={{ fontSize: 13, color: THEME.tm, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "Poppins, sans-serif" }}>
                {trackingMessage}
              </div>
            </div>
          )}
          <div style={{ background: "#FFFFFF", border: `1px solid ${THEME.br}`, borderRadius: 14, padding: "14px 16px", marginBottom: 12, boxShadow: "0 10px 24px rgba(31,41,55,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ ...labelStyle, marginBottom: 0, color: THEME.primary }}>Resumo para cliente</div>
              <button type="button" onClick={copyClientSummary} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${THEME.primary}`, background: THEME.primary, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>Copiar resumo</button>
            </div>
            <div style={{ fontSize: 13, color: THEME.tm, lineHeight: 1.75, whiteSpace: "pre-wrap", fontFamily: "Poppins, sans-serif" }}>
              {clientSummary}
            </div>
          </div>
          {images.length > 0 && <div style={{ marginBottom: 13 }}><div style={{ ...labelStyle, marginBottom: 7 }}>ðŸ“· ReferÃªncias</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{images.map((image, index) => <div key={index} onClick={() => setViewer(image)} style={{ width: 70, height: 70, borderRadius: 8, overflow: "hidden", cursor: "zoom-in", border: `1px solid ${THEME.br}`, flexShrink: 0 }}><img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>)}</div></div>}
          <div style={{ display: "flex", gap: 8, justifyContent: isMobile ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
            {order.status !== "Postado" && <button type="button" onClick={() => updateStatus("Postado")} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${THEME.primary}`, background: THEME.primarySoft, color: THEME.primary, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>Marcar postado</button>}
            {order.status !== "ConcluÃ­do" && <button type="button" onClick={() => updateStatus("ConcluÃ­do")} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${THEME.gold}`, background: "#FFF9F0", color: THEME.gold, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>Concluir</button>}
            <button type="button" onClick={copy} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${THEME.br}`, background: "transparent", color: THEME.tm, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>ðŸ“‹ Copiar</button>
            <button type="button" onClick={() => onDuplicate(order)} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${THEME.primary}`, background: "transparent", color: THEME.primary, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>â§‰ Duplicar</button>
            <button type="button" onClick={() => setEdit(true)} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${THEME.gold}`, background: "transparent", color: THEME.gold, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>âœï¸ Editar</button>
            <button type="button" onClick={handleDelete} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #7F1D1D", background: "transparent", color: "#F87171", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>ðŸ—‘ Excluir</button>
          </div>
        </div>
      )}
      {viewer && <div onClick={() => setViewer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}><img src={viewer} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} /></div>}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(() => window.localStorage.getItem("umbando_tab") || "novo");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 760);
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState(() => window.localStorage.getItem("umbando_filter") || "Todos");
  const [search, setSearch] = useState(() => window.localStorage.getItem("umbando_search") || "");
  const [deadlineFilter, setDeadlineFilter] = useState(() => window.localStorage.getItem("umbando_deadline_filter") || "Todos");
  const [channelFilter, setChannelFilter] = useState(() => window.localStorage.getItem("umbando_channel_filter") || "Todos");
  const [sortBy, setSortBy] = useState(() => window.localStorage.getItem("umbando_sort") || "recentes");
  const [toast, setToast] = useState("");
  const [draftOrder, setDraftOrder] = useState(null);
  const [brandName, setBrandName] = useState(() => window.localStorage.getItem("umbando_brand_name") || "Umbando Â· Pedidos");
  const [brandSubtitle, setBrandSubtitle] = useState(() => window.localStorage.getItem("umbando_brand_subtitle") || "Gerenciador de encomendas personalizadas");
  const [customChannelsText, setCustomChannelsText] = useState(() => window.localStorage.getItem("umbando_channels_text") || CHANNELS.join("\n"));
  const [customShippersText, setCustomShippersText] = useState(() => window.localStorage.getItem("umbando_shippers_text") || SHIPPERS.join("\n"));
  const [customSizesText, setCustomSizesText] = useState(() => window.localStorage.getItem("umbando_sizes_text") || SIZES.join("\n"));
  const configuredChannels = parseOptionsInput(customChannelsText, CHANNELS);
  const configuredShippers = parseOptionsInput(customShippersText, SHIPPERS);
  const configuredSizes = parseOptionsInput(customSizesText, SIZES);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    supabase.from("pedidos").select("*").order("criado_em", { ascending: false }).then(({ data, error }) => {
      if (!error && data) setOrders(data);
      setLoaded(true);
    });
  }, []);
  useEffect(() => { window.localStorage.setItem("umbando_tab", tab); }, [tab]);
  useEffect(() => { window.localStorage.setItem("umbando_filter", filter); }, [filter]);
  useEffect(() => { window.localStorage.setItem("umbando_search", search); }, [search]);
  useEffect(() => { window.localStorage.setItem("umbando_deadline_filter", deadlineFilter); }, [deadlineFilter]);
  useEffect(() => { window.localStorage.setItem("umbando_channel_filter", channelFilter); }, [channelFilter]);
  useEffect(() => { window.localStorage.setItem("umbando_sort", sortBy); }, [sortBy]);
  useEffect(() => { window.localStorage.setItem("umbando_brand_name", brandName); }, [brandName]);
  useEffect(() => { window.localStorage.setItem("umbando_brand_subtitle", brandSubtitle); }, [brandSubtitle]);
  useEffect(() => { window.localStorage.setItem("umbando_channels_text", customChannelsText); }, [customChannelsText]);
  useEffect(() => { window.localStorage.setItem("umbando_shippers_text", customShippersText); }, [customShippersText]);
  useEffect(() => { window.localStorage.setItem("umbando_sizes_text", customSizesText); }, [customSizesText]);
  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(window.__umbandoToastTimer);
    window.__umbandoToastTimer = window.setTimeout(() => setToast(""), 2600);
  };
  const saveOrder = (order) => {
    setOrders((prev) => (prev.find((item) => item.id === order.id) ? prev.map((item) => (item.id === order.id ? order : item)) : [order, ...prev]));
    showToast(order.id && orders.find((item) => item.id === order.id) ? "Pedido atualizado com sucesso." : "Pedido salvo com sucesso.");
    setDraftOrder(null);
  };
  const updateOrder = (order) => setOrders((prev) => prev.map((item) => (item.id === order.id ? order : item)));
  const deleteOrder = (id) => setOrders((prev) => prev.filter((item) => item.id !== id));
  const duplicateOrder = (order) => {
    const clone = { ...order, id: "", criado_em: "", upd: "", status: "Novo", rastreio: "", pconf: "", pent: "" };
    setDraftOrder(clone);
    setTab("novo");
    showToast("Pedido duplicado para ediÃ§Ã£o.");
  };
  const exportCsv = () => {
    const header = ["Nome", "Contato", "Instagram", "Canal", "Status", "Entrega", "Valor", "Frete", "Total", "Observacoes"];
    const rows = filteredOrders.map((order) => {
      const contact = splitContact(order.contato);
      const notes = splitOrderNotes(order.obs);
      return [order.nome, contact.contato, contact.instagram, order.canal, order.status, order.pent || "", order.valor || "", order.frete || "", formatCurrency(getTotal(order)), (notes.visibleObs || "").replace(/\n/g, " ")];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const counts = STATUS_LIST.reduce((accumulator, status) => ({ ...accumulator, [status]: orders.filter((order) => order.status === status).length }), {});
  const filteredOrders = orders.filter((order) => {
    const statusMatches = filter === "Todos" || order.status === filter;
    const notes = splitOrderNotes(order.obs);
    const haystack = [
      order.nome,
      order.contato,
      order.cores,
      order.mat,
      order.obs,
      order.rastreio,
      notes.visibleObs,
      ...notes.extraItems.flatMap((item) => [item.tipo, item.mat, item.matd, item.cores, item.detalhes]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const searchMatches = !search || haystack.includes(search.toLowerCase());
    let deadlineMatches = true;
    if (deadlineFilter === "Atrasados") deadlineMatches = isOverdue(order);
    if (deadlineFilter === "Hoje") {
      const due = order.pent || order.pconf;
      deadlineMatches = !!due && new Date(due).toDateString() === new Date().toDateString();
    }
    if (deadlineFilter === "PrÃ³ximos 2 dias") deadlineMatches = isDueSoon(order);
    const channelMatches = channelFilter === "Todos" || order.canal === channelFilter;
    return statusMatches && searchMatches && deadlineMatches && channelMatches;
  }).sort((a, b) => {
    if (sortBy === "prazo") return getDueTimestamp(a) - getDueTimestamp(b);
    if (sortBy === "valor") return getTotal(b) - getTotal(a);
    if (sortBy === "cliente") return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    return new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime();
  });
  const inProgress = orders.filter((order) => ["Novo", "Em ProduÃ§Ã£o"].includes(order.status)).length;
  const revenueMonth = orders.filter((order) => {
    const d = order.criado_em ? new Date(order.criado_em) : null;
    const now = new Date();
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, order) => sum + getTotal(order), 0);
  const overdueCount = orders.filter(isOverdue).length;
  const channelCounts = configuredChannels.map((channel) => [channel, orders.filter((order) => order.canal === channel).length]);
  const customerSuggestions = Array.from(new Map(orders.map((order) => [order.nome, { nome: order.nome }])).values()).filter((item) => item.nome);
  const sortedKanbanOrders = (status) =>
    orders
      .filter((order) => order.status === status)
      .sort((a, b) => getDueTimestamp(a) - getDueTimestamp(b) || new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
  const agendaOrders = orders.filter((order) => order.pent || order.pconf).sort((a, b) => getDueTimestamp(a) - getDueTimestamp(b));

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #FBFAF7 0%, ${THEME.bg} 100%)`, fontFamily: "Poppins, sans-serif", color: THEME.tm }}>
      <div style={{ background: "linear-gradient(180deg,#FFFFFF,#F8F6F1)", boxShadow: "0 14px 30px rgba(31,41,55,0.06)", borderBottom: `1px solid ${THEME.br}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "18px 20px 0" }}>
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 26 }}>âœ¨</div>
            <div style={{ minWidth: 0, flex: "1 1 260px" }}><div style={{ fontSize: 22, fontWeight: 800, color: THEME.tm, letterSpacing: 0.2 }}>{brandName}</div><div style={{ fontSize: 12, color: THEME.primary, fontWeight: 600 }}>{brandSubtitle}</div></div>
            <div style={{ marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>{[["Andamento", inProgress, THEME.primary], ["Atrasados", overdueCount, "#C2410C"], ["MÃªs", formatCurrency(revenueMonth), THEME.tm]].map(([label, value, color]) => <div key={label} style={{ background: "#FFFFFF", border: `1px solid ${THEME.br}`, borderRadius: 14, padding: "7px 12px", textAlign: "center", minWidth: isMobile ? 88 : 72, flex: isMobile ? "1 1 88px" : "0 0 auto", boxShadow: "0 8px 22px rgba(31,41,55,0.05)" }}><div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "Poppins, sans-serif" }}>{value}</div><div style={{ fontSize: 10, color: THEME.tl, fontFamily: "Poppins, sans-serif" }}>{label}</div></div>)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {channelCounts.map(([label, value]) => (
              <div key={label} style={{ background: "#FFFFFF", border: `1px solid ${THEME.br}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, color: THEME.tl, fontFamily: "Poppins, sans-serif" }}>
                <strong style={{ color: THEME.tm }}>{label}</strong>: {value}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["novo", "âž• Novo"], ["lista", `ðŸ“¦ Pedidos (${orders.length})`], ["kanban", "ðŸ“Š Kanban"], ["agenda", "ðŸ“† Agenda"], ["config", "âš™ï¸ Config"]].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} style={{ background: tab === key ? THEME.primary : "#FFFFFF", color: tab === key ? "#FFFFFF" : THEME.tl, border: `1px solid ${tab === key ? THEME.primary : THEME.br}`, padding: "10px 16px", fontSize: 13, fontWeight: tab === key ? 700 : 500, cursor: "pointer", borderRadius: "14px 14px 0 0", fontFamily: "Poppins, sans-serif", boxShadow: tab === key ? "0 10px 24px rgba(78,95,77,0.16)" : "none" }}>{label}</button>)}</div>
        </div>
      </div>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "22px 16px" }}>
        {toast && (
          <div style={{ position: "sticky", top: 12, zIndex: 20, marginBottom: 14 }}>
            <div style={{ background: THEME.primary, color: "#FFFFFF", borderRadius: 14, padding: "12px 14px", fontSize: 14, fontWeight: 600, boxShadow: "0 18px 40px rgba(78,95,77,0.22)" }}>
              {toast}
            </div>
          </div>
        )}
        {!loaded ? <div style={{ textAlign: "center", padding: 80, color: THEME.tl, fontFamily: "Poppins, sans-serif" }}>â³ Carregando pedidos...</div> : <>
          {tab === "novo" && <div style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 22, padding: "22px 20px", boxShadow: "0 22px 60px rgba(31,41,55,0.08)" }}><Form init={draftOrder} customerSuggestions={customerSuggestions} channels={configuredChannels} shippers={configuredShippers} sizes={configuredSizes} isMobile={isMobile} onSave={(order) => { saveOrder(order); setTab("lista"); }} onCancel={draftOrder ? () => { setDraftOrder(null); setTab("lista"); } : undefined} /></div>}
          {tab === "lista" && (
            <div>
              <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ðŸ” Buscar por nome, contato, cores..." style={{ ...inputStyle, padding: "11px 14px", fontSize: 15 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Todos", "Hoje", "PrÃ³ximos 2 dias", "Atrasados"].map((item) => (
                    <button key={item} type="button" onClick={() => setDeadlineFilter(item)} style={{ background: deadlineFilter === item ? THEME.primary : "#FFFFFF", color: deadlineFilter === item ? "#FFFFFF" : THEME.tm, border: `1px solid ${deadlineFilter === item ? THEME.primary : THEME.br}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>
                      {item}
                    </button>
                  ))}
                  <button type="button" onClick={exportCsv} style={{ marginLeft: "auto", background: "#FFFFFF", color: THEME.primary, border: `1px solid ${THEME.br}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>
                    â­³ Exportar CSV
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["Todos", ...STATUS_LIST].map((status) => { const colors = status !== "Todos" ? STATUS_COLORS[status] : null; return <button key={status} type="button" onClick={() => setFilter(status)} style={{ background: filter === status ? THEME.primary : colors?.bg || "#FFFFFF", color: filter === status ? "#FFFFFF" : colors?.cl || THEME.tm, border: `1px solid ${filter === status ? THEME.primary : THEME.br}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>{status} ({status === "Todos" ? orders.length : counts[status] || 0})</button>; })}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                  <div style={{ display: "none" }}>
                    <div style={{ ...labelStyle, marginBottom: 6 }}>Canal</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["Todos", ...configuredChannels].map((channel) => <button key={channel} type="button" onClick={() => setChannelFilter(channel)} style={{ background: channelFilter === channel ? THEME.primary : "#FFFFFF", color: channelFilter === channel ? "#FFFFFF" : THEME.tm, border: `1px solid ${channelFilter === channel ? THEME.primary : THEME.br}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>{channel}</button>)}</div>
                  </div>
                  <div>
                    <div style={{ ...labelStyle, marginBottom: 6 }}>OrdenaÃ§Ã£o</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["recentes", "Recentes"], ["prazo", "Prazo"], ["valor", "Maior valor"], ["cliente", "Cliente"]].map(([key, label]) => <button key={key} type="button" onClick={() => setSortBy(key)} style={{ background: sortBy === key ? THEME.primary : "#FFFFFF", color: sortBy === key ? "#FFFFFF" : THEME.tm, border: `1px solid ${sortBy === key ? THEME.primary : THEME.br}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>{label}</button>)}</div>
                  </div>
                </div>
              </div>
              {filteredOrders.length === 0 ? <div style={{ textAlign: "center", padding: "60px 20px", background: THEME.card, borderRadius: 18, border: `1px dashed ${THEME.br}`, color: THEME.tl }}><div style={{ fontSize: 34, marginBottom: 10 }}>ðŸ”®</div><div style={{ fontSize: 16, fontWeight: 700, color: THEME.tm, marginBottom: 6, fontFamily: "Poppins, sans-serif" }}>{orders.length === 0 ? "Nenhum pedido ainda" : "Nenhum resultado"}</div><div style={{ fontSize: 13, fontFamily: "Poppins, sans-serif" }}>{orders.length === 0 ? "Crie o primeiro na aba Novo" : "Tente outros filtros"}</div></div> : filteredOrders.map((order) => <Card key={order.id} order={order} onUpdate={updateOrder} onDelete={deleteOrder} onDuplicate={duplicateOrder} onToast={showToast} isMobile={isMobile} />)}
            </div>
          )}
          {tab === "kanban" && <div style={{ overflowX: "auto", paddingBottom: 8 }}><div style={{ display: "flex", gap: 10, minWidth: "max-content" }}>{STATUS_LIST.map((status) => { const colors = STATUS_COLORS[status]; const list = sortedKanbanOrders(status); return <div key={status} style={{ width: 195, flexShrink: 0 }}><div style={{ background: colors.bg, color: colors.cl, padding: "8px 12px", borderRadius: "14px 14px 0 0", fontWeight: 700, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Poppins, sans-serif", border: `1px solid ${THEME.br}` }}><span>{colors.em} {status}</span><span style={{ background: "rgba(255,255,255,0.65)", borderRadius: 20, padding: "2px 8px" }}>{list.length}</span></div><div style={{ background: "#FCFBF8", border: `1px solid ${THEME.br}`, borderTop: "none", borderRadius: "0 0 14px 14px", padding: 8, minHeight: 100 }}>{list.length === 0 ? <div style={{ textAlign: "center", padding: "24px 10px", color: THEME.tl, fontSize: 12, fontFamily: "Poppins, sans-serif" }}>Vazio</div> : list.map((order) => <div key={order.id} onClick={() => { setSearch(order.nome); setFilter("Todos"); setTab("lista"); }} style={{ background: isOverdue(order) ? "#FFF4E8" : THEME.card, border: `1px solid ${isOverdue(order) ? "#FDBA74" : THEME.br}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8, cursor: "pointer", boxShadow: "0 8px 18px rgba(31,41,55,0.05)" }}><div style={{ fontWeight: 700, fontSize: 13, color: THEME.tm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Poppins, sans-serif" }}>{order.nome || "Cliente"}</div><div style={{ fontSize: 11, color: THEME.tl, fontFamily: "Poppins, sans-serif" }}>{order.tipo}{order.tipo === "BrajÃ¡" ? ` ${order.fios}f` : ""} Â· {order.mat} Â· {order.tam}</div>{order.pent && <div style={{ fontSize: 10, color: isOverdue(order) ? "#C2410C" : THEME.tl, marginTop: 4, fontFamily: "Poppins, sans-serif" }}>{isOverdue(order) ? "Atrasado: " : "Entrega: "}{formatDate(order.pent)}</div>}{order.valor && <div style={{ fontSize: 12, fontWeight: 700, color: THEME.primary, marginTop: 4, fontFamily: "Poppins, sans-serif" }}>{formatCurrency(getTotal(order))}</div>}{order.urg && <div style={{ fontSize: 10, color: THEME.gold, fontWeight: 700, marginTop: 2, fontFamily: "Poppins, sans-serif" }}>âš¡ URGENTE</div>}</div>)}</div></div>; })}</div></div>}
          {tab === "agenda" && (
            <div style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 22, padding: "22px 20px", boxShadow: "0 22px 60px rgba(31,41,55,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: THEME.tm }}>Agenda de entregas</div>
                  <div style={{ fontSize: 13, color: THEME.tl }}>Visual rÃ¡pido por prazo de confecÃ§Ã£o e entrega.</div>
                </div>
                <div style={{ ...labelStyle, marginBottom: 0 }}>{agendaOrders.length} com data</div>
              </div>
              {agendaOrders.length === 0 ? <div style={{ textAlign: "center", padding: "40px 20px", background: THEME.panel, borderRadius: 18, border: `1px dashed ${THEME.br}`, color: THEME.tl }}>Nenhum pedido com prazo definido ainda.</div> : <div style={{ display: "grid", gap: 10 }}>{agendaOrders.map((order) => { const tone = getUrgencyTone(order); const channelLabel = order.canal === "Instagram DM" ? "Instagram" : order.canal === "WhatsApp" ? "WhatsApp" : order.canal; return <div key={order.id} style={{ background: tone.surface, border: `1px solid ${tone.border}`, borderLeft: `8px solid ${tone.border}`, borderRadius: 16, padding: "14px 16px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr .8fr .8fr auto", gap: 10, alignItems: "center", boxShadow: "0 10px 24px rgba(31,41,55,0.05)" }}><div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}><div style={{ fontSize: 15, fontWeight: 700, color: THEME.tm }}>{order.nome}</div><span style={{ fontSize: 11, color: THEME.tl, background: "#FFFFFF", border: `1px solid ${THEME.br}`, borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>{channelLabel}</span></div><div style={{ fontSize: 12, color: THEME.tl }}>{order.tipo} Â· {order.mat} Â· {order.tam}</div></div><div><div style={{ ...labelStyle, marginBottom: 4 }}>ConfecÃ§Ã£o</div><div style={{ fontSize: 13, color: THEME.tm }}>{formatDate(order.pconf)}</div></div><div><div style={{ ...labelStyle, marginBottom: 4 }}>Entrega</div><div style={{ fontSize: 13, color: THEME.tm }}>{formatDate(order.pent)}</div></div><div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: isMobile ? "flex-start" : "flex-end" }}><div style={{ background: tone.badgeBg, color: tone.badgeColor, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 800, border: `1px solid ${tone.border}` }}>{getDueLabel(order) || "Sem alerta"}</div><button type="button" onClick={() => { setSearch(order.nome); setFilter("Todos"); setTab("lista"); }} style={{ border: `1px solid ${THEME.br}`, background: "#FFFFFF", color: THEME.tm, borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>Abrir pedido</button></div></div>; })}</div>}
            </div>
          )}
          {tab === "config" && (
            <div style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 22, padding: "22px 20px", boxShadow: "0 22px 60px rgba(31,41,55,0.08)" }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: THEME.tm, marginBottom: 4 }}>Cadastro personalizÃ¡vel</div>
                <div style={{ fontSize: 13, color: THEME.tl }}>Essas preferÃªncias ficam salvas no seu navegador.</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 18 }}>
                <Field label="Nome da marca"><input value={brandName} onChange={(event) => setBrandName(event.target.value)} style={inputStyle} placeholder="Nome que aparece no topo" /></Field>
                <Field label="SubtÃ­tulo"><input value={brandSubtitle} onChange={(event) => setBrandSubtitle(event.target.value)} style={inputStyle} placeholder="Frase curta da sua marca" /></Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Canais" full={isMobile}><textarea value={customChannelsText} onChange={(event) => setCustomChannelsText(event.target.value)} style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.6 }} placeholder={"Um item por linha\nWhatsApp\nInstagram DM\nComentÃ¡rio"} /></Field>
                <Field label="Transportadoras" full={isMobile}><textarea value={customShippersText} onChange={(event) => setCustomShippersText(event.target.value)} style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.6 }} placeholder={"Um item por linha\nCorreios\nLoggi"} /></Field>
                <Field label="Tamanhos" full={isMobile}><textarea value={customSizesText} onChange={(event) => setCustomSizesText(event.target.value)} style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.6 }} placeholder={"Um item por linha\n40cm\n50cm\n60cm"} /></Field>
              </div>
            </div>
          )}
        </>}
      </div>
    </div>
  );
}




