import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { embeddedLogo } from "@/logoData";
import ChatWidget from "@/components/ChatWidget";
import { ArrowRight, Building2, Camera, CheckCircle2, ChevronDown, CircleDot, Drill, ExternalLink, Hammer, MapPin, Menu, MessageCircle, Phone, Ruler, ShieldCheck, X, Zap } from "lucide-react";

const defaultLogo = embeddedLogo;
const defaultWhatsappNumbers = ["5515996965635", "5515997780986"];
const defaultDisplayNumbers = ["(15) 99696-5635", "(15) 99778-0986"];

const services = [
  { icon: Drill, title: "Furação em concreto", text: "Perfurações precisas para passagens, ancoragens e instalações técnicas." },
  { icon: CircleDot, title: "Corte de concreto", text: "Cortes limpos em pisos, paredes e estruturas com serra diamantada." },
  { icon: Ruler, title: "Abertura de vãos", text: "Aberturas sob medida para portas, janelas, escadas e adequações." },
  { icon: Hammer, title: "Corte de pisos e lajes", text: "Execução controlada para reformas, ampliações e passagens na obra." },
  { icon: Building2, title: "Demolição controlada", text: "Remoção técnica com segurança, agilidade e mínimo impacto no entorno." },
  { icon: Zap, title: "Furos técnicos", text: "Soluções para hidráulica, elétrica, gás, ar-condicionado e ancoragens." },
];

const steps = [
  ["01", "Entre em contato", "Fale com nossa equipe e conte o que precisa ser feito."],
  ["02", "Envie as informações", "Recebemos fotos, medidas e detalhes da sua obra."],
  ["03", "Receba o orçamento", "Analisamos o melhor método e apresentamos uma proposta clara."],
  ["04", "Agende a execução", "Com tudo aprovado, combinamos a data e executamos com precisão."],
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [contactStatus, setContactStatus] = useState("");
  const settingsQuery = trpc.catalog.settings.useQuery();
  const settings = settingsQuery.data ?? {};
  const whatsappNumbers = [settings.phone1, settings.phone2].map((phone, index) => (phone || defaultDisplayNumbers[index]).replace(/\D/g, "")).map((phone, index) => phone.length >= 10 ? (phone.startsWith("55") ? phone : `55${phone}`) : defaultWhatsappNumbers[index]);
  const displayNumbers = [settings.phone1 || defaultDisplayNumbers[0], settings.phone2 || defaultDisplayNumbers[1]];
  const logo = settings.logoUrl || defaultLogo;
  const getWhatsappHref = (message = "Olá! Queria fazer um orçamento e saber mais sobre os serviços.", index?: number) => {
    const number = whatsappNumbers[index ?? Math.floor(Math.random() * whatsappNumbers.length)];
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  };
  const contactHref = getWhatsappHref();
  const galleryQuery = trpc.catalog.gallery.useQuery();
  const gallery = galleryQuery.data ?? [];
  const submitContact = (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings.email) { setContactStatus("O e-mail de contato ainda não foi configurado pela empresa."); return; }
    const subject = `Orçamento pelo site — ${contactForm.name}`;
    const body = `Nome: ${contactForm.name}\nE-mail: ${contactForm.email}\nTelefone: ${contactForm.phone}\n\nMensagem:\n${contactForm.message}`;
    window.location.href = `mailto:${settings.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setContactStatus("Seu aplicativo de e-mail foi aberto com a mensagem preenchida.");
  };

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="M&E Furação e Corte"><span className="brand-mark">M<span>&</span>E</span><span className="brand-copy"><strong>FURAÇÃO E CORTE</strong><small>EM CONCRETO</small></span></a>
        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Abrir menu">{mobileOpen ? <X /> : <Menu />}</button>
        <nav className={mobileOpen ? "nav-links open" : "nav-links"}>
          <a href="#servicos" onClick={() => setMobileOpen(false)}>Serviços</a><a href="/loja" onClick={() => setMobileOpen(false)}>Loja</a><a href="#processo" onClick={() => setMobileOpen(false)}>Como funciona</a><a href="#sobre" onClick={() => setMobileOpen(false)}>Sobre nós</a><a href="#contato" onClick={() => setMobileOpen(false)}>Contato</a><a className="nav-cta" href={contactHref}>Falar com a equipe <ArrowRight size={16} /></a>
        </nav>
      </header>

      <main>
        <section id="inicio" className="hero section-pad"><div className="hero-grid" /><div className="hero-content"><div className="eyebrow"><span /> {settings.heroEyebrow || "PRECISÃO QUE SUSTENTA O SEU PROJETO"}</div><h1>{settings.heroTitle || "Furação e corte"}</h1><p className="hero-lede">{settings.companyDescription || "Serviços especializados em concreto para obras que exigem controle, técnica e um acabamento impecável."}</p><div className="hero-actions"><a className="button button-yellow" href="#contato">Solicitar orçamento <ArrowRight size={18} /></a><a className="text-link" href="#servicos">Conheça os serviços <ArrowRight size={16} /></a></div><div className="hero-proof"><div><strong>{settings.completedServices || "100%"}</strong><span>serviços concluídos</span></div><div><strong>{settings.experienceYears || "Alta"}</strong><span>experiência técnica</span></div><div><strong>Equipe</strong><span>especializada</span></div></div></div><div className="hero-art"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="hero-logo-frame"><img src={logo} alt="Logo M&E Furação e Corte em Concreto" /></div><div className="art-label"><Zap size={15} /> TECNOLOGIA DIAMANTADA</div></div></section>
        <section className="trust-strip"><div><ShieldCheck size={19} /> Execução responsável</div><div><CheckCircle2 size={19} /> Acabamento limpo</div><div><Zap size={19} /> Agilidade na obra</div><div><Ruler size={19} /> Medidas precisas</div></section>

        <section id="servicos" className="section-pad services-section"><div className="section-intro"><div><div className="eyebrow dark"><span /> O QUE FAZEMOS</div><h2>{settings.servicesTitle || "Soluções que resolvem de verdade."}</h2></div><p>Do primeiro furo ao corte mais exigente, entregamos técnica e cuidado em cada etapa do serviço.</p></div><div className="service-grid">{services.map(({ icon: Icon, title, text }) => <article className="service-card" key={title}><div className="service-icon"><Icon size={25} /></div><h3>{title}</h3><p>{text}</p><a href="#contato">Solicitar orçamento <ArrowRight size={15} /></a></article>)}</div><div className="technical-drilling"><div><div className="eyebrow dark"><span /> FURAÇÕES TÉCNICAS</div><h3>Perfurações para cada etapa da obra.</h3></div><div className="technical-list"><span><CheckCircle2 /> Furos em vigas</span><span><CheckCircle2 /> Furos em lajes</span><span><CheckCircle2 /> Furos em piscinas</span><span><CheckCircle2 /> Furos em reservatórios</span><span><CheckCircle2 /> Passagem hidráulica</span><span><CheckCircle2 /> Passagem elétrica</span><span><CheckCircle2 /> Passagem de gás</span><span><CheckCircle2 /> Ar-condicionado</span></div></div></section>

        <section id="diferenciais" className="differentials-section section-pad"><div className="section-intro"><div><div className="eyebrow"><span /> POR QUE ESCOLHER A M&E</div><h2>Força, técnica<br /><em>e confiança.</em></h2></div><p>Atendemos obras residenciais, comerciais e industriais em Sorocaba e região.</p></div><div className="differentials-grid"><div><strong>01</strong><h3>Atendimento rápido</h3><p>Retorno ágil para entender o seu projeto e preparar o orçamento.</p></div><div><strong>02</strong><h3>Equipe qualificada</h3><p>Profissionais preparados para executar com segurança e organização.</p></div><div><strong>03</strong><h3>Equipamentos profissionais</h3><p>Tecnologia de corte diamantado para precisão e acabamento.</p></div><div><strong>04</strong><h3>Compromisso com o prazo</h3><p>Planejamento claro para a obra avançar sem retrabalho.</p></div></div></section>

        <section id="galeria" className="gallery-section section-pad"><div className="section-intro"><div><div className="eyebrow dark"><span /> TRABALHOS REALIZADOS</div><h2>Veja a nossa<br /><em>obra acontecendo.</em></h2></div><p>Fotos reais dos serviços concluídos pela equipe M&E. A galeria será atualizada a cada novo projeto.</p></div>{gallery.length ? <div className="gallery-grid">{gallery.map((image) => <figure className="gallery-card" key={image.id}><img src={image.imageUrl} alt={image.title} /><figcaption><strong>{image.title}</strong>{image.description && <span>{image.description}</span>}</figcaption></figure>)}</div> : <div className="gallery-empty"><Camera size={28} /><strong>As primeiras obras estão chegando aqui.</strong><span>Adicione fotos reais pela área de gestão do catálogo.</span></div>}</section>


        <section id="sobre" className="about-section section-pad"><div className="about-image"><div className="concrete-lines" /><div className="about-badge"><strong>01</strong><span>Equipe preparada<br />para o desafio</span></div></div><div className="about-copy"><div className="eyebrow dark"><span /> SOBRE A EMPRESA</div><h2>{settings.aboutTitle || "O concreto é forte. Nosso trabalho também."}</h2><p>{settings.companyDescription || "A M&E é especializada em furação e corte de concreto para quem não pode perder tempo com retrabalho. Cada projeto recebe planejamento, equipamento adequado e uma equipe comprometida com o resultado."}</p><ul><li><CheckCircle2 /> Profissionalismo e segurança</li><li><CheckCircle2 /> Atendimento em {settings.city || "Sorocaba e região"}</li><li><CheckCircle2 /> Respeito ao prazo combinado</li></ul><a className="button button-dark" href="#contato">Fale com a M&E <ArrowRight size={18} /></a></div></section>
        <section id="processo" className="process-section section-pad"><div className="eyebrow"><span /> COMO FUNCIONA</div><h2>{settings.processTitle || "Do planejamento ao último acabamento."}</h2><div className="steps">{steps.map(([num, title, text]) => <div className="step" key={num}><span className="step-num">{num}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></section>
        <section className="faq-section section-pad"><div><div className="eyebrow dark"><span /> DÚVIDAS FREQUENTES</div><h2>Antes de começar,<br /><em>tire suas dúvidas.</em></h2></div><div className="faq-list">{["Que tipo de concreto vocês conseguem cortar?", "Vocês atendem obras residenciais e comerciais?", "Como funciona o orçamento?", "O serviço faz muita sujeira ou barulho?"].map((question, i) => <div className={openFaq === i ? "faq-item active" : "faq-item"} key={question}><button onClick={() => setOpenFaq(openFaq === i ? null : i)}><span>{question}</span><ChevronDown size={19} /></button>{openFaq === i && <p>{i === 0 ? "Trabalhamos com diferentes espessuras e tipos de concreto. Indicamos o equipamento e método mais adequados." : i === 1 ? "Sim. Atendemos reformas, obras comerciais, industriais e residenciais." : i === 2 ? "Você chama pelo WhatsApp, envia as informações do serviço e avaliamos o local para apresentar uma proposta clara." : "Usamos técnicas e equipamentos que reduzem impactos e deixamos o local organizado."}</p>}</div>)}</div></section>
        <section id="contato" className="contact-section section-pad"><div className="contact-inner"><div className="eyebrow"><span /> VAMOS FALAR SOBRE SUA OBRA?</div><h2>{settings.contactTitle || "Seu projeto pede precisão?"}</h2><p>Preencha o formulário ou fale diretamente pelo WhatsApp.</p><div className="contact-details"><span><Phone size={16} /> {displayNumbers[0]}</span><span><Phone size={16} /> {displayNumbers[1]}</span><span><MapPin size={16} /> {settings.city || "Sorocaba - SP"}</span>{settings.email && <span><ExternalLink size={16} /> {settings.email}</span>}</div><form className="contact-form" onSubmit={submitContact}><input required placeholder="Seu nome" value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} /><input required type="email" placeholder="Seu e-mail" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} /><input required placeholder="Seu telefone" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} /><textarea required placeholder="Conte um pouco sobre sua obra" value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} /><button className="button button-dark" type="submit"><ExternalLink size={17} /> Enviar por e-mail</button>{contactStatus && <small>{contactStatus}</small>}</form><a className="button button-dark contact-whatsapp" href={contactHref}><MessageCircle size={19} /> Chamar no WhatsApp</a><small>{settings.address || "Endereço completo será adicionado posteriormente."}</small></div></section>
      </main>

      <footer><div className="footer-brand"><span className="brand-mark">M<span>&</span>E</span><span>FURAÇÃO E CORTE<br /><small>EM CONCRETO</small></span></div><p>Furação, corte e soluções técnicas em concreto.</p><span>Sorocaba - SP · © 2026 M&E</span></footer>
      <ChatWidget />
    </div>
  );
}
