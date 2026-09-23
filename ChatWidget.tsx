import { FormEvent, useState } from "react";
import { ArrowLeft, Headphones, MessageCircle, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

type View = "menu" | "whatsapp" | "ai";
type Message = { role: "user" | "assistant"; content: string };

const defaultWhatsapp = ["5515996965635", "5515997780986"];
const defaultDisplay = ["(15) 99696-5635", "(15) 99778-0986"];

function normalizeWhatsapp(value: string | undefined, fallback: string) {
  const digits = (value || fallback).replace(/\D/g, "");
  if (digits.length < 10) return fallback;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

const initialMessage: Message = {
  role: "assistant",
  content: "Olá! Sou o Assistente Virtual da M&E Furação e Corte em Concreto. Posso ajudar com nossos serviços, região de atendimento e orçamento. Como posso ajudar?",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const settingsQuery = trpc.catalog.settings.useQuery();
  const settings = settingsQuery.data ?? {};
  const whatsappNumbers = [
    normalizeWhatsapp(settings.phone1, defaultWhatsapp[0]),
    normalizeWhatsapp(settings.phone2, defaultWhatsapp[1]),
  ];
  const displayNumbers = [settings.phone1 || defaultDisplay[0], settings.phone2 || defaultDisplay[1]];
  const ai = trpc.chat.ai.useMutation({
    onSuccess: result => {
      setMessages(current => [...current, { role: "assistant", content: result.answer }]);
    },
    onError: error => {
      setMessages(current => [...current, { role: "assistant", content: error.message || "Não consegui responder agora. Fale conosco pelo WhatsApp." }]);
    },
  });

  const resetToMenu = () => {
    setView("menu");
    setBody("");
  };

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || ai.isPending) return;
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setBody("");
    ai.mutate({ messages: nextMessages.slice(-20) });
  };

  const openWhatsapp = (index: number) => {
    const message = "Olá! Queria fazer um orçamento e saber mais sobre os serviços.";
    window.open(`https://wa.me/${whatsappNumbers[index]}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return <>
    {open && <section className="support-chat" aria-label="Atendimento">
      <header className="support-chat-head">
        <div><Headphones size={18} /><strong>{view === "menu" ? "Fale conosco" : view === "whatsapp" ? "WhatsApp" : "Atendimento IA"}</strong><small>{view === "ai" ? "Assistente virtual da M&E" : "Escolha uma opção"}</small></div>
        <button onClick={() => setOpen(false)} aria-label="Fechar atendimento"><X size={18} /></button>
      </header>

      {view === "menu" && <div className="support-choice">
        <div className="support-welcome"><MessageCircle size={32} /><h3>Como podemos ajudar?</h3><p>Escolha uma forma de falar com a M&E.</p></div>
        <button className="support-choice-button" onClick={() => setView("ai")}><span className="support-choice-icon"><Headphones size={20} /></span><span><strong>Atendimento IA</strong><small>Tire suas dúvidas agora</small></span><ArrowLeft className="support-choice-arrow" size={17} /></button>
        <button className="support-choice-button" onClick={() => setView("whatsapp")}><span className="support-choice-icon whatsapp-icon"><MessageCircle size={20} /></span><span><strong>WhatsApp</strong><small>Fale diretamente com a empresa</small></span><ArrowLeft className="support-choice-arrow" size={17} /></button>
      </div>}

      {view === "whatsapp" && <div className="support-choice">
        <button className="support-back" onClick={resetToMenu}><ArrowLeft size={16} /> Voltar</button>
        <div className="support-welcome"><MessageCircle size={32} /><h3>Escolha o WhatsApp</h3><p>Selecione o número que deseja chamar.</p></div>
        {[0, 1].map(index => <button className="support-choice-button" key={index} onClick={() => openWhatsapp(index)}><span className="support-choice-icon whatsapp-icon"><MessageCircle size={20} /></span><span><strong>WhatsApp {index + 1}</strong><small>{displayNumbers[index]}</small></span><ArrowLeft className="support-choice-arrow" size={17} /></button>)}
      </div>}

      {view === "ai" && <><div className="support-online-top"><button className="support-back" onClick={resetToMenu}><ArrowLeft size={16} /> Voltar</button></div><div className="support-status"><span className="online-dot" /> Atendimento IA online</div><div className="support-messages">{messages.map((message, index) => <div className={message.role === "user" ? "support-message visitor" : "support-message agent"} key={`${message.role}-${index}`}><span>{message.role === "user" ? "Você" : "Assistente IA M&E"}</span><p>{message.content}</p></div>)}{ai.isPending && <div className="support-message agent"><span>Assistente IA M&E</span><p>Estou analisando sua pergunta...</p></div>}</div><form className="support-compose" onSubmit={submitMessage}><input disabled={ai.isPending} value={body} onChange={event => setBody(event.target.value)} placeholder="Digite sua dúvida..." autoComplete="off" /><button type="submit" disabled={!body.trim() || ai.isPending} aria-label="Enviar mensagem"><Send size={17} /></button></form></>}
    </section>}
    <button className="support-float" onClick={() => { setOpen(value => !value); if (!open) setView("menu"); }} aria-label="Abrir atendimento"><MessageCircle size={27} /><span>Fale conosco</span></button>
  </>;
}
