import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Facebook, Headphones, MessageCircle, Send, X } from "lucide-react";
import { trpc } from "@/trpc";

const TOKEN_KEY = "me_support_chat_token";
type View = "menu" | "whatsapp" | "online";
type Mode = "start" | "login";
const defaultWhatsapp = ["5515996965635", "5515997780986"];
const defaultDisplay = ["(15) 99696-5635", "(15) 99778-0986"];

function normalizeWhatsapp(value: string | undefined, fallback: string) {
  const digits = (value || fallback).replace(/\D/g, "");
  if (digits.length < 10) return fallback;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [mode, setMode] = useState<Mode>("start");
  const [token, setToken] = useState(() => typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : "");
  const [form, setForm] = useState({ username: "", password: "", name: "", email: "", phone: "" });
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const oauthSession = trpc.auth.oauthSession.useQuery(undefined, { retry: false });
  const settingsQuery = trpc.catalog.settings.useQuery();
  const settings = settingsQuery.data ?? {};
  const whatsappNumbers = [
    normalizeWhatsapp(settings.phone1, defaultWhatsapp[0]),
    normalizeWhatsapp(settings.phone2, defaultWhatsapp[1]),
  ];
  const displayNumbers = [settings.phone1 || defaultDisplay[0], settings.phone2 || defaultDisplay[1]];
  const utils = trpc.useUtils();

  const start = trpc.chat.start.useMutation({
    onSuccess: result => {
      localStorage.setItem(TOKEN_KEY, result.publicToken);
      setFeedback("");
      setToken(result.publicToken);
    },
  });
  const login = trpc.chat.login.useMutation({
    onSuccess: result => {
      localStorage.setItem(TOKEN_KEY, result.publicToken);
      setFeedback("");
      setToken(result.publicToken);
    },
  });
  const conversationQuery = trpc.chat.conversation.useQuery({ publicToken: token }, { enabled: Boolean(token), refetchInterval: 3500 });
  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setBody("");
      setFeedback("");
      utils.chat.conversation.invalidate({ publicToken: token });
    },
    onError: error => setFeedback(error.message || "Não foi possível enviar a mensagem. Tente novamente."),
  });
  const conversation = conversationQuery.data;

  useEffect(() => {
    if (oauthSession.data) {
      localStorage.setItem(TOKEN_KEY, oauthSession.data);
      setToken(oauthSession.data);
      setView("online");
      setFeedback("");
    }
  }, [oauthSession.data]);

  useEffect(() => {
    if (conversationQuery.error && token) {
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setView("online");
      setMode("login");
      setFeedback("Sua sessão do atendimento expirou. Entre novamente para continuar.");
    }
  }, [conversationQuery.error, token]);

  useEffect(() => {
    if (conversation?.visitor?.name) {
      setForm(current => ({ ...current, name: conversation.visitor.name, email: conversation.visitor.email || "", phone: conversation.visitor.phone || "", username: conversation.visitor.username }));
    }
  }, [conversation?.visitor?.name, conversation?.visitor?.email, conversation?.visitor?.phone, conversation?.visitor?.username]);

  const resetToMenu = () => {
    setView("menu");
    setFeedback("");
  };

  const submitAccess = (event: FormEvent) => {
    event.preventDefault();
    setFeedback("");
    if (mode === "login") {
      login.mutate({ username: form.username.trim(), password: form.password });
    } else {
      start.mutate({ username: form.username.trim(), password: form.password, name: form.name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined });
    }
  };

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || !conversation || send.isPending || conversation.conversation.status === "closed") return;
    setFeedback("");
    send.mutate({ publicToken: token, conversationId: conversation.conversation.id, body: text });
  };

  const openWhatsapp = (index: number) => {
    const message = "Olá! Queria fazer um orçamento e saber mais sobre os serviços.";
    window.open(`https://wa.me/${whatsappNumbers[index]}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return <>
    {open && <section className="support-chat" aria-label="Atendimento">
      <header className="support-chat-head">
        <div><Headphones size={18} /><strong>{view === "menu" ? "Fale conosco" : view === "whatsapp" ? "WhatsApp" : "Atendimento online"}</strong><small>{view === "online" ? "Atendimento com nossa equipe" : "Escolha uma opção"}</small></div>
        <button onClick={() => setOpen(false)} aria-label="Fechar atendimento"><X size={18} /></button>
      </header>

      {view === "menu" && <div className="support-choice">
        <div className="support-welcome"><MessageCircle size={32} /><h3>Como podemos ajudar?</h3><p>Escolha uma forma de falar com nossa equipe.</p></div>
        <button className="support-choice-button" onClick={() => setView("online")}><span className="support-choice-icon"><Headphones size={20} /></span><span><strong>Atendimento Online</strong><small>Converse diretamente com nossa equipe</small></span><ArrowLeft className="support-choice-arrow" size={17} /></button>
        <button className="support-choice-button" onClick={() => setView("whatsapp")}><span className="support-choice-icon whatsapp-icon"><MessageCircle size={20} /></span><span><strong>WhatsApp</strong><small>Escolha um dos nossos números</small></span><ArrowLeft className="support-choice-arrow" size={17} /></button>
      </div>}

      {view === "whatsapp" && <div className="support-choice">
        <button className="support-back" onClick={resetToMenu}><ArrowLeft size={16} /> Voltar</button>
        <div className="support-welcome"><MessageCircle size={32} /><h3>Escolha o WhatsApp</h3><p>Selecione o número que deseja chamar.</p></div>
        {[0, 1].map(index => <button className="support-choice-button" key={index} onClick={() => openWhatsapp(index)}><span className="support-choice-icon whatsapp-icon"><MessageCircle size={20} /></span><span><strong>WhatsApp {index + 1}</strong><small>{displayNumbers[index]}</small></span><ArrowLeft className="support-choice-arrow" size={17} /></button>)}
      </div>}

      {view === "online" && !token && <>
        <div className="support-online-top"><button className="support-back" onClick={resetToMenu}><ArrowLeft size={16} /> Voltar</button></div>
        <form className="support-start" onSubmit={submitAccess}>
          <div className="support-welcome"><Headphones size={30} /><h3>{mode === "login" ? "Entrar no suporte" : "Entrar no atendimento"}</h3><p>Você pode usar uma conta existente ou criar um acesso simples.</p></div>
          <div className="social-login-info"><strong>Login com Google ou Facebook</strong><span>Entre rapidamente usando sua conta Google ou Facebook.</span><div className="social-login-buttons"><button type="button" className="social-google" onClick={() => { window.location.href = "/api/auth/google"; }}>G <span>Continuar com Google</span></button><button type="button" className="social-facebook" onClick={() => { window.location.href = "/api/auth/facebook"; }}><Facebook size={17} fill="currentColor" /> <span>Continuar com Facebook</span></button></div></div>
          <div className="support-divider"><span>ou use o acesso atual</span></div>
          <label>Usuário<input required minLength={3} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Seu usuário" /></label>
          <label>Senha<input required minLength={6} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Sua senha" /></label>
          {mode === "start" && <label>Nome completo<input required minLength={2} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" /></label>}
          {mode === "start" && <label>WhatsApp <span>(opcional)</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(15) 99999-9999" /></label>}
          {mode === "start" && <label>E-mail <span>(opcional)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@email.com" /></label>}
          {(start.error || login.error || feedback) && <div className="chat-form-error">{feedback || start.error?.message || login.error?.message || "Não foi possível entrar."}</div>}
          <button className="button button-yellow" disabled={start.isPending || login.isPending}>{mode === "login" ? "Entrar na conversa" : "Criar acesso e iniciar"} <ArrowLeft size={16} /></button>
          <button type="button" className="chat-mode-toggle" onClick={() => setMode(mode === "start" ? "login" : "start")}>{mode === "start" ? "Já tenho cadastro" : "Criar novo acesso"}</button>
        </form>
      </>}

      {view === "online" && token && <><div className="support-status"><span className="online-dot" /> {conversation?.conversation.status === "closed" ? "Atendimento encerrado" : conversation?.conversation.assignedUsername ? `Atendido por ${conversation.conversation.assignedUsername}` : "Aguardando nossa equipe"}</div><div className="support-messages">{conversation?.messages?.length ? conversation.messages.map(message => <div className={message.senderType === "visitor" ? "support-message visitor" : "support-message agent"} key={message.id}><span>{message.senderName}</span><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></div>) : <div className="support-empty">Olá, {conversation?.visitor.name || form.name}! Escreva sua dúvida ou conte sobre sua obra.</div>}</div><form className="support-compose" onSubmit={submitMessage}><input disabled={conversation?.conversation.status === "closed" || send.isPending} value={body} onChange={e => { setBody(e.target.value); if (feedback) setFeedback(""); }} placeholder="Digite sua mensagem..." autoComplete="off" /><button type="submit" disabled={!body.trim() || !conversation || conversation.conversation.status === "closed" || send.isPending} aria-label="Enviar mensagem"><Send size={17} /></button></form>{feedback && <div className="chat-form-error support-send-error">{feedback}</div>}</>}
    </section>}
    <button className="support-float" onClick={() => { setOpen(value => !value); if (!open) { setView("menu"); setFeedback(""); } }} aria-label="Abrir atendimento"><MessageCircle size={27} /><span>Fale conosco</span></button>
  </>;
}
