import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

const STATUS_LIST = ["Novo", "Aguardando Pagamento", "Em Produção", "Postado", "Concluído", "Cancelado"];
const STATUS_COLORS = {
  Novo: { bg: "#F3F4F6", cl: "#374151", em: "🆕" },
  "Aguardando Pagamento": { bg: "#FEF9C3", cl: "#854D0E", em: "💰" },
  "Em Produção": { bg: "#FEE2E2", cl: "#991B1B", em: "🔨" },
  Postado: { bg: "#DBEAFE", cl: "#1E40AF", em: "📬" },
  Concluído: { bg: "#DCFCE7", cl: "#166534", em: "✅" },
  Cancelado: { bg: "#F1F5F9", cl: "#64748B", em: "❌" },
};
const MATERIALS = ["Miçanga", "Cristal", "Porcelana", "Semente"];
const MATERIAL_DETAILS = {
  Miçanga: ["Chinesa", "Jablonex"],
  Cristal: ["6mm", "8mm", "10mm"],
  Porcelana: ["6mm", "8mm"],
  Semente: ["Lágrima N.Sra.", "Coquinho", "Olho de Boi", "Olho de Cabra", "Madeira"],
};
const MATERIAL_LABELS = {
  Miçanga: "Tipo de Miçanga",
  Cristal: "Tamanho Cristal",
  Porcelana: "Tamanho",
  Semente: "Tipo de Semente",
};
const FIRM_FORMATS = ["Lisa", "Mordida", "Pitanga", "Meteoro", "Sextavada", "Bola"];
const SIZES = ["40cm", "50cm", "60cm", "65cm", "70cm", "75cm", "80cm"];
const SHIPPERS = ["Correios", "Loggi", "JadLog", "Motoboy"];
const CHANNELS = ["WhatsApp", "Instagram DM", "Comentário"];
const THEME = {
  br: "#2A2A2A",
  gold: "#FFD233",
  glL: "#FFE072",
  dark: "#050505",
  tm: "#F5F5F5",
  tl: "#A1A1AA",
  card: "#101010",
  bg: "#050505",
  panel: "#161616",
  soft: "#1E1E1E",
};
const AI_ENABLED = false;

const EMPTY = {
  nome: "", contato: "", canal: "WhatsApp", tipo: "Guia", fios: "3", mat: "Miçanga", matd: "", cores: "", fin: "Fio solto",
  fqtd: "", fcor: "", ffmt: "", ping: false, pqtd: "", pqual: "", pmetal: "Prateado", fio: "Nylon", fech: "Com firma",
  env: "Fechado", tam: "60cm", transp: "", frete: "", pgto: "Pix", parc: "", valor: "", desconto: false, urg: false,
  taxa: "", pconf: "", pent: "", rastreio: "", status: "Novo", obs: "", imgs: [],
};

const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #2A2A2A", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "Poppins, sans-serif", background: "#111111", color: "#F5F5F5", outline: "none" };
const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, fontFamily: "Poppins, sans-serif" };
const EXTRA_ITEMS_MARKER = "\n\n__EXTRA_ITEMS__\n";

function generateId() { return `o_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }
function createExtraItem() {
  return { id: generateId(), tipo: "Guia", mat: "Miçanga", matd: "", cores: "", tam: "60cm", detalhes: "" };
}

function splitOrderNotes(rawObs) {
  if (!rawObs || !rawObs.includes(EXTRA_ITEMS_MARKER)) return { visibleObs: rawObs || "", extraItems: [] };
  const [visibleObs, rawItems] = rawObs.split(EXTRA_ITEMS_MARKER);
  try {
    const parsed = JSON.parse(rawItems);
    return { visibleObs: visibleObs || "", extraItems: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { visibleObs: rawObs || "", extraItems: [] };
  }
}

function buildOrderNotes(visibleObs, extraItems) {
  const cleanObs = visibleObs?.trim() || "";
  const validItems = (extraItems || []).filter((item) => item && (item.cores || item.detalhes || item.mat || item.tipo));
  if (!validItems.length) return cleanObs;
  return `${cleanObs}${EXTRA_ITEMS_MARKER}${JSON.stringify(validItems)}`.trim();
}
function formatDate(date) {
  if (!date) return "—";
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
  return <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{opts.map((opt) => <button key={opt} type="button" onClick={() => onChange(opt)} style={{ padding: small ? "4px 10px" : "7px 15px", borderRadius: 20, fontSize: small ? 12 : 13, fontWeight: 600, border: `1px solid ${val === opt ? THEME.gold : THEME.br}`, background: val === opt ? THEME.dark : "transparent", color: val === opt ? "#F5DFA0" : THEME.tm, cursor: "pointer", fontFamily: "Georgia, serif" }}>{opt}</button>)}</div>;
}

function Field({ label, children, full }) {
  return <div style={{ marginBottom: 13, gridColumn: full ? "1 / -1" : "auto" }}><label style={labelStyle}>{label}</label>{children}</div>;
}

function Section({ title, children }) {
  return <div style={{ marginBottom: 20 }}><div style={{ fontSize: 12, fontWeight: 800, color: THEME.gold, letterSpacing: 0.9, marginBottom: 11, paddingBottom: 7, borderBottom: `1px solid ${THEME.br}`, fontFamily: "Poppins, sans-serif" }}>{title}</div>{children}</div>;
}

function Form({ init, onSave, onCancel, isEdit }) {
  const parsedInit = splitOrderNotes(init?.obs);
  const [form, setForm] = useState({ ...EMPTY, ...(init || {}), obs: parsedInit.visibleObs });
  const [images, setImages] = useState(init?.imgs || []);
  const [extraItems, setExtraItems] = useState(parsedInit.extraItems);
  const [mode, setMode] = useState("manual");
  const [conversation, setConversation] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const detailOptions = MATERIAL_DETAILS[form.mat] || [];

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleImages = async (files) => {
    const remaining = 4 - images.length;
    if (remaining <= 0) return;
    const compressed = await Promise.all(Array.from(files).slice(0, remaining).map(compressImage));
    setImages((prev) => [...prev, ...compressed].slice(0, 4));
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
      alert("Nome do cliente é obrigatório.");
      return;
    }
    setSaving(true);
    const id = form.id || generateId();
    const row = { ...form, id, obs: buildOrderNotes(form.obs, extraItems), imgs: images, criado_em: form.criado_em || new Date().toISOString(), upd: new Date().toISOString() };
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
        {[["manual", "✏️ Manual"], ["ia", AI_ENABLED ? "✨ Extrair com IA" : "🔒 IA em breve"]].map(([key, label]) => (
          <button key={key} type="button" disabled={key === "ia" && !AI_ENABLED} onClick={() => setMode(key)} style={{ flex: 1, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 700, border: `1px solid ${mode === key ? THEME.gold : THEME.br}`, background: mode === key ? THEME.gold : "transparent", color: mode === key ? "#050505" : THEME.tm, cursor: key === "ia" && !AI_ENABLED ? "not-allowed" : "pointer", opacity: key === "ia" && !AI_ENABLED ? 0.6 : 1, fontFamily: "Poppins, sans-serif" }}>
            {label}
          </button>
        ))}
      </div>

      {mode === "ia" && AI_ENABLED && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 10 }}>
            <Segmented opts={CHANNELS} val={form.canal} onChange={(value) => setField("canal", value)} small />
          </div>
          <textarea value={conversation} onChange={(event) => setConversation(event.target.value)} placeholder={`Cole a conversa do ${form.canal}...\n\nEx: Quero brajá 7 fios miçanga jablonex, vermelho e preto, 7 firmas meteoro rajada, pingente tridente prateado, 70cm, pix R$180`} style={{ ...inputStyle, height: 160, resize: "vertical", lineHeight: 1.7 }} />
          <div style={{ fontSize: 12, color: THEME.tl, marginTop: 8 }}>Essa função usa uma API no Vercel. Se não houver chave configurada, o restante do sistema continua funcionando no modo manual.</div>
          <button type="button" onClick={extractWithAI} disabled={aiLoading || !conversation.trim()} style={{ width: "100%", marginTop: 10, padding: "13px", borderRadius: 10, border: "none", background: aiLoading || !conversation.trim() ? "#D5C5A0" : "linear-gradient(135deg,#C8853A,#E8B96A)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: aiLoading || !conversation.trim() ? "not-allowed" : "pointer", fontFamily: "Georgia, serif" }}>
            {aiLoading ? "⏳ Analisando..." : "✨ Extrair Pedido"}
          </button>
        </div>
      )}

      {!AI_ENABLED && (
        <div style={{ marginBottom: 20, background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 12, padding: "12px 14px", color: THEME.tl, fontSize: 13, lineHeight: 1.5, fontFamily: "Poppins, sans-serif" }}>
          A extração com IA está temporariamente desativada. O cadastro manual continua funcionando normalmente.
        </div>
      )}

      <Section title="👤 Cliente">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Nome *"><input value={form.nome} onChange={(event) => setField("nome", event.target.value)} style={inputStyle} placeholder="Nome completo" /></Field>
          <Field label="Contato"><input value={form.contato} onChange={(event) => setField("contato", event.target.value)} style={inputStyle} placeholder="(11) 99999-9999 ou @insta" /></Field>
        </div>
        <Field label="Canal"><Segmented opts={CHANNELS} val={form.canal} onChange={(value) => setField("canal", value)} /></Field>
      </Section>

      <Section title="📿 Construção da Peça">
        <Field label="Tipo de Peça">
          <Segmented opts={["Guia", "Brajá"]} val={form.tipo} onChange={(value) => { setField("tipo", value); if (value === "Guia") setField("fios", "1"); }} />
        </Field>
        {form.tipo === "Brajá" && <Field label="Número de Fios"><Segmented opts={["3", "5", "7"]} val={form.fios} onChange={(value) => setField("fios", value)} /></Field>}
        <Field label="Material">
          <Segmented opts={MATERIALS} val={form.mat} onChange={(value) => { setField("mat", value); setField("matd", ""); }} />
        </Field>
        {detailOptions.length > 0 && <Field label={MATERIAL_LABELS[form.mat] || "Detalhe"}><Segmented opts={detailOptions} val={form.matd} onChange={(value) => setField("matd", value)} /></Field>}
        <Field label="Cores" full><input value={form.cores} onChange={(event) => setField("cores", event.target.value)} style={inputStyle} placeholder="Ex: vermelho, preto e branco alternados" /></Field>
        {form.tipo === "Brajá" && <Field label="Finalização"><Segmented opts={["Fio solto", "Fio trançado"]} val={form.fin} onChange={(value) => setField("fin", value)} /></Field>}
        {form.tipo === "Brajá" && (
          <div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 12, padding: "13px 15px", marginBottom: 13 }}>
            <div style={{ ...labelStyle, marginBottom: 11 }}>🧿 Firmas</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Fio"><Segmented opts={["Nylon", "Cordonê"]} val={form.fio} onChange={(value) => setField("fio", value)} /></Field>
          <Field label="Tamanho">
            <select value={form.tam} onChange={(event) => setField("tam", event.target.value)} style={inputStyle}>
              {SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Fechamento"><Segmented opts={["Com firma", "Sem firma"]} val={form.fech} onChange={(value) => setField("fech", value)} /></Field>
          <Field label="Enviar"><Segmented opts={["Fechado", "Aberto"]} val={form.env} onChange={(value) => setField("env", value)} /></Field>
        </div>
        <div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 12, padding: "13px 15px", marginBottom: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: form.ping ? 13 : 0 }}>
            <input type="checkbox" checked={form.ping} onChange={(event) => setField("ping", event.target.checked)} style={{ width: 18, height: 18, accentColor: THEME.gold }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: THEME.dark }}>Tem Pingente?</span>
          </label>
          {form.ping && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <Field label="Quantidade"><input value={form.pqtd} onChange={(event) => setField("pqtd", event.target.value)} style={inputStyle} placeholder="Ex: 1" /></Field>
              <Field label="Quais"><input value={form.pqual} onChange={(event) => setField("pqual", event.target.value)} style={inputStyle} placeholder="Ex: Tridente" /></Field>
              <Field label="Metal"><Segmented opts={["Prateado", "Dourado"]} val={form.pmetal} onChange={(value) => setField("pmetal", value)} small /></Field>
            </div>
          )}
        </div>
      </Section>

      <Section title="💰 Comercial e Envio">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Valor Total (R$)"><input value={form.valor} onChange={(event) => setField("valor", event.target.value)} style={inputStyle} placeholder="Ex: 150,00" /></Field>
          <Field label="Pagamento"><Segmented opts={["Pix", "Cartão"]} val={form.pgto} onChange={(value) => setField("pgto", value)} /></Field>
        </div>
        {form.pgto === "Cartão" && (
          <Field label="Parcelas">
            <select value={form.parc} onChange={(event) => setField("parc", event.target.value)} style={inputStyle}>
              <option value="">À vista</option>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((count) => <option key={count} value={`${count}x`}>{count}x (juros cliente)</option>)}
            </select>
          </Field>
        )}
        <div style={{ display: "flex", gap: 24, marginBottom: 13 }}>
          {[["desconto", "🏷️ Desconto 5% Pix"], ["urg", "⚡ Pedido Urgente"]].map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: THEME.dark }}>
              <input type="checkbox" checked={form[key]} onChange={(event) => setField(key, event.target.checked)} style={{ width: 18, height: 18, accentColor: THEME.gold }} />
              {label}
            </label>
          ))}
        </div>
        {form.urg && <Field label="Taxa Urgência (R$)"><input value={form.taxa} onChange={(event) => setField("taxa", event.target.value)} style={inputStyle} placeholder="Ex: 30,00" /></Field>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Transportadora">
            <select value={form.transp} onChange={(event) => setField("transp", event.target.value)} style={inputStyle}>
              <option value="">Selecionar...</option>
              {SHIPPERS.map((shipper) => <option key={shipper} value={shipper}>{shipper}</option>)}
            </select>
          </Field>
          <Field label="Frete (R$)"><input value={form.frete} onChange={(event) => setField("frete", event.target.value)} style={inputStyle} placeholder="Ex: 25,00" /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Confecção até"><input type="date" value={form.pconf} onChange={(event) => setField("pconf", event.target.value)} style={inputStyle} /></Field>
          <Field label="Entrega Estimada"><input type="date" value={form.pent} onChange={(event) => setField("pent", event.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Código de Rastreio" full><input value={form.rastreio} onChange={(event) => setField("rastreio", event.target.value)} style={inputStyle} placeholder="Ex: BR123456789BR" /></Field>
      </Section>

      <Section title="📷 Imagens de Referência">
        <div onClick={() => fileRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleImages(event.dataTransfer.files); }} style={{ border: `2px dashed ${THEME.br}`, borderRadius: 12, padding: "18px 16px", textAlign: "center", cursor: "pointer", background: THEME.panel, marginBottom: 10 }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>📎</div>
          <div style={{ fontWeight: 600, color: THEME.tm, fontSize: 14, fontFamily: "Poppins, sans-serif" }}>Clique ou arraste as imagens</div>
          <div style={{ fontSize: 12, color: THEME.tl, marginTop: 3, fontFamily: "Poppins, sans-serif" }}>Até 4 fotos · JPG, PNG, WEBP</div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => handleImages(event.target.files)} />
        </div>
        {images.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {images.map((image, index) => (
              <div key={index} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: `1px solid ${THEME.br}` }}>
                <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button type="button" onClick={(event) => { event.stopPropagation(); setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index)); }} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="📝 Observações e Status">
        <Field label="Observações" full><textarea value={form.obs} onChange={(event) => setField("obs", event.target.value)} style={{ ...inputStyle, height: 75, resize: "vertical", lineHeight: 1.6 }} placeholder="Detalhes especiais, urgências..." /></Field>
        <Field label="Status"><Segmented opts={STATUS_LIST} val={form.status} onChange={(value) => setField("status", value)} small /></Field>
      </Section>

      <Section title="🧩 Peças Adicionais">
        <div style={{ marginBottom: 12, color: THEME.tl, fontSize: 13, fontFamily: "Poppins, sans-serif" }}>
          Use essa área quando o mesmo cliente comprar mais de uma peça no mesmo pedido.
        </div>
        {extraItems.map((item, index) => {
          const detailOptions = MATERIAL_DETAILS[item.mat] || [];
          return (
            <div key={item.id} style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ color: THEME.gold, fontWeight: 700, fontSize: 13, fontFamily: "Poppins, sans-serif" }}>Peça {index + 2}</div>
                <button
                  type="button"
                  onClick={() => setExtraItems((prev) => prev.filter((extra) => extra.id !== item.id))}
                  style={{ border: `1px solid ${THEME.br}`, background: "transparent", color: "#F87171", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}
                >
                  Remover
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Tipo da peça">
                  <Segmented
                    opts={["Guia", "Brajá"]}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Cores">
                  <input value={item.cores} onChange={(event) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, cores: event.target.value } : extra)))} style={inputStyle} placeholder="Ex: preto e amarelo" />
                </Field>
                <Field label="Tamanho">
                  <select value={item.tam} onChange={(event) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, tam: event.target.value } : extra)))} style={inputStyle}>
                    {SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Detalhes" full>
                <textarea value={item.detalhes} onChange={(event) => setExtraItems((prev) => prev.map((extra) => (extra.id === item.id ? { ...extra, detalhes: event.target.value } : extra)))} style={{ ...inputStyle, height: 72, resize: "vertical", lineHeight: 1.6 }} placeholder="Firmas, pingente, acabamento ou qualquer diferença dessa peça" />
              </Field>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setExtraItems((prev) => [...prev, createExtraItem()])}
          style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px dashed ${THEME.br}`, background: "transparent", color: THEME.gold, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}
        >
          + Adicionar outra peça ao pedido
        </button>
      </Section>

      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        {onCancel && <button type="button" onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 12, border: `1px solid ${THEME.br}`, background: "transparent", color: THEME.tm, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>Cancelar</button>}
        <button type="button" onClick={save} disabled={saving} style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: saving ? "#5A5A5A" : "linear-gradient(135deg,#FFD233,#FFE072)", color: "#050505", fontSize: 15, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontFamily: "Poppins, sans-serif" }}>
          {saving ? "⏳ Salvando..." : isEdit ? "💾 Salvar Alterações" : "✅ Criar Pedido"}
        </button>
      </div>
    </div>
  );
}

function Card({ order, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [viewer, setViewer] = useState(null);
  const statusColors = STATUS_COLORS[order.status] || STATUS_COLORS.Novo;
  const images = order.imgs || [];
  const parsedNotes = splitOrderNotes(order.obs);
  const visibleObs = parsedNotes.visibleObs;
  const extraItems = parsedNotes.extraItems;

  if (edit) {
    return <div style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 16, padding: 20, marginBottom: 10 }}><Form init={order} isEdit onSave={(updated) => { onUpdate(updated); setEdit(false); }} onCancel={() => setEdit(false)} /></div>;
  }

  const pairs = [
    ["Tipo", `${order.tipo}${order.tipo === "Brajá" ? ` ${order.fios} fios` : ""}`],
    ["Material", `${order.mat}${order.matd ? ` · ${order.matd}` : ""}`],
    ["Tamanho", order.tam], ["Cores", order.cores], ["Fio", order.fio], ["Fechamento", order.fech], ["Enviar", order.env],
    ...(order.tipo === "Brajá" ? [["Finalização", order.fin], ["Firmas", order.fqtd ? `${order.fqtd}x ${order.ffmt || ""} ${order.fcor || ""}`.trim() : "—"]] : []),
    ...(order.ping ? [["Pingente", `${order.pqtd}x ${order.pqual} (${order.pmetal})`]] : []),
    ["Valor", order.valor ? `R$ ${order.valor}` : "—"],
    ["Pagamento", `${order.pgto}${order.parc ? ` ${order.parc}` : ""}${order.desconto ? " (-5%)" : ""}`],
    ["Transp.", order.transp || "—"], ["Frete", order.frete ? `R$ ${order.frete}` : "—"],
    ...(order.urg ? [["Urgente", `Taxa R$ ${order.taxa || "—"}`]] : []),
    ["Confecção", formatDate(order.pconf)], ["Entrega", formatDate(order.pent)],
    ...(order.rastreio ? [["Rastreio", order.rastreio]] : []),
    ["Canal", order.canal], ["Criado", formatDate(order.criado_em)],
  ];

  const copy = async () => {
    const lines = [
      `PEDIDO — ${order.nome}`, `Contato: ${order.contato || "—"}`, `Canal: ${order.canal}`, "",
      `PEÇA: ${order.tipo}${order.tipo === "Brajá" ? ` ${order.fios} fios` : ""}`,
      `Material: ${order.mat}${order.matd ? ` (${order.matd})` : ""}`,
      `Cores: ${order.cores || "—"}`, `Tamanho: ${order.tam} | Fio: ${order.fio}`, `Fechamento: ${order.fech} | Enviar: ${order.env}`,
      ...(order.tipo === "Brajá" ? [`Finalização: ${order.fin}`, `Firmas: ${order.fqtd}x ${order.ffmt} ${order.fcor}`] : []),
      ...(order.ping ? [`Pingente: ${order.pqtd}x ${order.pqual} (${order.pmetal})`] : []),
      "", "COMERCIAL:", `Valor: R$ ${order.valor || "—"} | ${order.pgto}${order.parc ? ` ${order.parc}` : ""}`,
      `Transp: ${order.transp || "—"} | Frete: R$ ${order.frete || "—"}`, `Confecção: ${formatDate(order.pconf)} | Entrega: ${formatDate(order.pent)}`,
      ...(order.rastreio ? [`Rastreio: ${order.rastreio}`] : []),
      ...(extraItems.length ? ["", "PEÇAS ADICIONAIS:", ...extraItems.map((item, index) => `${index + 2}. ${item.tipo} · ${item.mat}${item.matd ? ` ${item.matd}` : ""} · ${item.tam} · ${item.cores || "sem cores"}${item.detalhes ? ` · ${item.detalhes}` : ""}`)] : []),
      ...(visibleObs ? ["", `Obs: ${visibleObs}`] : []),
      "",
      `Status: ${order.status}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
  };

  const handleDelete = async () => {
    if (!window.confirm(`Excluir pedido de ${order.nome}?`)) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", order.id);
    if (!error) onDelete(order.id);
  };

  return (
    <div style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 16, marginBottom: 10, overflow: "hidden", boxShadow: "0 18px 40px rgba(0,0,0,0.28)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: THEME.panel, borderBottom: open ? `1px solid ${THEME.br}` : "none", cursor: "pointer" }} onClick={() => setOpen((value) => !value)}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg,${THEME.gold},${THEME.glL})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, color: "#050505" }}>🔮</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: THEME.tm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Poppins, sans-serif" }}>{order.nome || "Cliente"}</div>
          <div style={{ fontSize: 12, color: THEME.tl, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.tipo}{order.tipo === "Brajá" ? ` ${order.fios}f` : ""} · {order.mat}{order.matd ? ` ${order.matd}` : ""} · {order.tam}{order.contato ? ` · ${order.contato}` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {order.urg && <span style={{ fontSize: 10, background: "#FFD233", color: "#050505", padding: "2px 8px", borderRadius: 20, fontWeight: 700, fontFamily: "Poppins, sans-serif" }}>⚡</span>}
          <select value={order.status} onChange={async (event) => { event.stopPropagation(); const nextStatus = event.target.value; await supabase.from("pedidos").update({ status: nextStatus }).eq("id", order.id); onUpdate({ ...order, status: nextStatus }); }} onClick={(event) => event.stopPropagation()} style={{ border: "none", background: statusColors.bg, color: statusColors.cl, padding: "4px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none", fontFamily: "Poppins, sans-serif" }}>
            {STATUS_LIST.map((status) => <option key={status} value={status}>{STATUS_COLORS[status].em} {status}</option>)}
          </select>
          <span style={{ color: THEME.tl, fontSize: 11 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 13 }}>
            {pairs.map(([key, value]) => <div key={key} style={{ background: THEME.soft, borderRadius: 10, padding: "8px 10px", border: `1px solid ${THEME.br}` }}><div style={{ fontSize: 10, fontWeight: 700, color: THEME.tl, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 2, fontFamily: "Poppins, sans-serif" }}>{key}</div><div style={{ fontSize: 13, color: THEME.tm, wordBreak: "break-word", fontFamily: "Poppins, sans-serif" }}>{value || "—"}</div></div>)}
          </div>
          {extraItems.length > 0 && (
            <div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ ...labelStyle, marginBottom: 8, color: THEME.gold }}>Peças adicionais</div>
              <div style={{ display: "grid", gap: 8 }}>
                {extraItems.map((item, index) => (
                  <div key={item.id || index} style={{ background: THEME.soft, border: `1px solid ${THEME.br}`, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: THEME.tm, marginBottom: 4, fontFamily: "Poppins, sans-serif" }}>Peça {index + 2}</div>
                    <div style={{ fontSize: 13, color: THEME.tm, lineHeight: 1.6, fontFamily: "Poppins, sans-serif" }}>
                      {item.tipo} · {item.mat}{item.matd ? ` · ${item.matd}` : ""} · {item.tam}
                      {item.cores ? ` · ${item.cores}` : ""}
                      {item.detalhes ? ` · ${item.detalhes}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {visibleObs && <div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: THEME.tm, lineHeight: 1.6, fontFamily: "Poppins, sans-serif" }}><strong>Obs:</strong> {visibleObs}</div>}
          {images.length > 0 && <div style={{ marginBottom: 13 }}><div style={{ ...labelStyle, marginBottom: 7 }}>📷 Referências</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{images.map((image, index) => <div key={index} onClick={() => setViewer(image)} style={{ width: 70, height: 70, borderRadius: 8, overflow: "hidden", cursor: "zoom-in", border: `1px solid ${THEME.br}`, flexShrink: 0 }}><img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>)}</div></div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={copy} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${THEME.br}`, background: "transparent", color: THEME.tm, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>📋 Copiar</button>
            <button type="button" onClick={() => setEdit(true)} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${THEME.gold}`, background: "transparent", color: THEME.gold, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>✏️ Editar</button>
            <button type="button" onClick={handleDelete} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #7F1D1D", background: "transparent", color: "#F87171", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>🗑 Excluir</button>
          </div>
        </div>
      )}
      {viewer && <div onClick={() => setViewer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}><img src={viewer} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} /></div>}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("novo");
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  useEffect(() => {
    supabase.from("pedidos").select("*").order("criado_em", { ascending: false }).then(({ data, error }) => {
      if (!error && data) setOrders(data);
      setLoaded(true);
    });
  }, []);
  const saveOrder = (order) => setOrders((prev) => (prev.find((item) => item.id === order.id) ? prev.map((item) => (item.id === order.id ? order : item)) : [order, ...prev]));
  const updateOrder = (order) => setOrders((prev) => prev.map((item) => (item.id === order.id ? order : item)));
  const deleteOrder = (id) => setOrders((prev) => prev.filter((item) => item.id !== id));
  const counts = STATUS_LIST.reduce((accumulator, status) => ({ ...accumulator, [status]: orders.filter((order) => order.status === status).length }), {});
  const filteredOrders = orders.filter((order) => {
    const statusMatches = filter === "Todos" || order.status === filter;
    const searchMatches = !search || ["nome", "contato", "cores", "mat", "obs"].some((key) => order[key]?.toLowerCase().includes(search.toLowerCase()));
    return statusMatches && searchMatches;
  });
  const inProgress = orders.filter((order) => ["Novo", "Aguardando Pagamento", "Em Produção"].includes(order.status)).length;
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top, #1A1A1A 0%, #050505 55%)", fontFamily: "Poppins, sans-serif", color: THEME.tm }}>
      <div style={{ background: "linear-gradient(135deg,#050505,#181818)", boxShadow: "0 18px 40px rgba(0,0,0,0.45)", borderBottom: `1px solid ${THEME.br}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "18px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 26 }}>✨</div>
            <div><div style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", letterSpacing: 0.2 }}>Umbando · Pedidos</div><div style={{ fontSize: 12, color: THEME.gold, fontWeight: 500 }}>Gerenciador de encomendas personalizadas</div></div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{[["Andamento", inProgress, THEME.gold], ["Total", orders.length, "#FFFFFF"]].map(([label, value, color]) => <div key={label} style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderRadius: 12, padding: "6px 12px", textAlign: "center", minWidth: 62 }}><div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "Poppins, sans-serif" }}>{value}</div><div style={{ fontSize: 10, color: THEME.tl, fontFamily: "Poppins, sans-serif" }}>{label}</div></div>)}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>{[["novo", "➕ Novo"], ["lista", `📦 Pedidos (${orders.length})`], ["kanban", "📊 Kanban"]].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} style={{ background: tab === key ? THEME.gold : "transparent", color: tab === key ? "#050505" : THEME.tl, border: tab === key ? "none" : `1px solid ${THEME.br}`, padding: "10px 16px", fontSize: 13, fontWeight: tab === key ? 700 : 500, cursor: "pointer", borderRadius: "12px 12px 0 0", fontFamily: "Poppins, sans-serif" }}>{label}</button>)}</div>
        </div>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "22px 16px" }}>
        {!loaded ? <div style={{ textAlign: "center", padding: 80, color: THEME.tl, fontFamily: "Poppins, sans-serif" }}>⏳ Carregando pedidos...</div> : <>
          {tab === "novo" && <div style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 20, padding: "22px 20px", boxShadow: "0 22px 60px rgba(0,0,0,0.35)" }}><Form onSave={(order) => { saveOrder(order); setTab("lista"); }} /></div>}
          {tab === "lista" && (
            <div>
              <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="🔍 Buscar por nome, contato, cores..." style={{ ...inputStyle, padding: "11px 14px", fontSize: 15 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["Todos", ...STATUS_LIST].map((status) => { const colors = status !== "Todos" ? STATUS_COLORS[status] : null; return <button key={status} type="button" onClick={() => setFilter(status)} style={{ background: filter === status ? THEME.gold : colors?.bg || THEME.panel, color: filter === status ? "#050505" : colors?.cl || THEME.tm, border: `1px solid ${filter === status ? THEME.gold : THEME.br}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Poppins, sans-serif" }}>{status} ({status === "Todos" ? orders.length : counts[status] || 0})</button>; })}</div>
              </div>
              {filteredOrders.length === 0 ? <div style={{ textAlign: "center", padding: "60px 20px", background: THEME.card, borderRadius: 16, border: `1px dashed ${THEME.br}`, color: THEME.tl }}><div style={{ fontSize: 34, marginBottom: 10 }}>🔮</div><div style={{ fontSize: 16, fontWeight: 700, color: THEME.tm, marginBottom: 6, fontFamily: "Poppins, sans-serif" }}>{orders.length === 0 ? "Nenhum pedido ainda" : "Nenhum resultado"}</div><div style={{ fontSize: 13, fontFamily: "Poppins, sans-serif" }}>{orders.length === 0 ? "Crie o primeiro na aba Novo" : "Tente outros filtros"}</div></div> : filteredOrders.map((order) => <Card key={order.id} order={order} onUpdate={updateOrder} onDelete={deleteOrder} />)}
            </div>
          )}
          {tab === "kanban" && <div style={{ overflowX: "auto", paddingBottom: 8 }}><div style={{ display: "flex", gap: 10, minWidth: "max-content" }}>{STATUS_LIST.map((status) => { const colors = STATUS_COLORS[status]; const list = orders.filter((order) => order.status === status); return <div key={status} style={{ width: 195, flexShrink: 0 }}><div style={{ background: colors.bg, color: colors.cl, padding: "8px 12px", borderRadius: "12px 12px 0 0", fontWeight: 700, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Poppins, sans-serif" }}><span>{colors.em} {status}</span><span style={{ background: "rgba(0,0,0,0.18)", borderRadius: 20, padding: "2px 8px" }}>{list.length}</span></div><div style={{ background: THEME.panel, border: `1px solid ${THEME.br}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 8, minHeight: 100 }}>{list.length === 0 ? <div style={{ textAlign: "center", padding: "24px 10px", color: THEME.tl, fontSize: 12, fontFamily: "Poppins, sans-serif" }}>Vazio</div> : list.map((order) => <div key={order.id} onClick={() => { setSearch(order.nome); setFilter("Todos"); setTab("lista"); }} style={{ background: THEME.card, border: `1px solid ${THEME.br}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, cursor: "pointer" }}><div style={{ fontWeight: 700, fontSize: 13, color: THEME.tm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Poppins, sans-serif" }}>{order.nome || "Cliente"}</div><div style={{ fontSize: 11, color: THEME.tl, fontFamily: "Poppins, sans-serif" }}>{order.tipo}{order.tipo === "Brajá" ? ` ${order.fios}f` : ""} · {order.mat} · {order.tam}</div>{order.valor && <div style={{ fontSize: 12, fontWeight: 700, color: THEME.gold, marginTop: 4, fontFamily: "Poppins, sans-serif" }}>R$ {order.valor}</div>}{order.urg && <div style={{ fontSize: 10, color: THEME.gold, fontWeight: 700, marginTop: 2, fontFamily: "Poppins, sans-serif" }}>⚡ URGENTE</div>}</div>)}</div></div>; })}</div></div>}
        </>}
      </div>
    </div>
  );
}
