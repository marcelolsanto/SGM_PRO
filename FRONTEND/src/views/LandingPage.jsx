import { useState } from 'react'
import axios from 'axios'

export default function LandingPage({ onIrParaLogin }) {
  // Calculadora Interativa - Tipo de Perfil
  const [tipoCalculadora, setTipoCalculadora] = useState('loja') // 'loja' ou 'medidor'

  // Variáveis da Loja
  const [volumeOSLoja, setVolumeOSLoja] = useState(40)
  const custoCLTPorOS = 580.0
  const custoSGMPorOS = 200.0 // Combo Apartamento Completo (5 Cômodos)
  const gastoCLTMensal = volumeOSLoja * custoCLTPorOS
  const gastoSGMMensal = volumeOSLoja * custoSGMPorOS
  const economiaMensalLoja = gastoCLTMensal - gastoSGMMensal
  const economiaAnualLoja = economiaMensalLoja * 12
  const percentualEconomiaLoja = ((economiaMensalLoja / gastoCLTMensal) * 100).toFixed(1)

  // Variáveis do Medidor
  const [medicoesPorDia, setMedicoesPorDia] = useState(3)
  const [diasPorSemana, setDiasPorSemana] = useState(5)
  const ganhoMedioPorOS = 160.0 // Repasse de 80% (R$ 160 de R$ 200)
  const totalMedicoesMes = medicoesPorDia * diasPorSemana * 4.2
  const ganhoBrutoMensal = totalMedicoesMes * ganhoMedioPorOS

  // FAQ Acordeão
  const [faqAberto, setFaqAberto] = useState(null)
  const toggleFaq = (idx) => setFaqAberto(faqAberto === idx ? null : idx)

  // Formulário de Contato / Lead
  const [formTipo, setFormTipo] = useState('empresa')
  const [formNome, setFormNome] = useState('')
  const [formEmpresa, setFormEmpresa] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formTelefone, setFormTelefone] = useState('')
  const [formCidade, setFormCidade] = useState('')
  const [formSucesso, setFormSucesso] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [whatsappLeadUrl, setWhatsappLeadUrl] = useState('https://wa.me/5511972980409')

  const handleSubmitLead = async (e) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      const res = await axios.post('/api/contato', {
        tipo: formTipo,
        nome: formNome,
        empresa: formEmpresa,
        email: formEmail,
        telefone: formTelefone,
        cidade: formCidade,
        mensagem: formTipo === 'empresa' 
          ? 'Solicitação de Proposta Comercial / Demonstração para Loja' 
          : 'Cadastro e Credenciamento de Medidor Técnico Parceiro'
      })
      if (res.data?.whatsapp_url) {
        setWhatsappLeadUrl(res.data.whatsapp_url)
      }
      setFormSucesso(true)
      setFormNome('')
      setFormEmpresa('')
      setFormEmail('')
      setFormTelefone('')
      setFormCidade('')
    } catch (err) {
      console.warn('Fallback offline WhatsApp:', err)
      const msgWA = `Olá Marcelo! Me chamo *${formNome}* (${formEmpresa}) de *${formCidade}*. Gostaria de saber mais sobre o SGM.PRO (${formTipo}). Tel: ${formTelefone} | E-mail: ${formEmail}`
      setWhatsappLeadUrl(`https://wa.me/5511972980409?text=${encodeURIComponent(msgWA)}`)
      setFormSucesso(true)
    } finally {
      setFormLoading(false)
    }
  }

  const formatarMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. NAVBAR INSTITUCIONAL */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* LOGO */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollTo('inicio')}>
            <span className="text-3xl font-black italic tracking-tighter text-white">
              SGM<span className="text-blue-500">.PRO</span>
            </span>
            <span className="hidden sm:inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
              Rede Nacional de Medição Técnica
            </span>
          </div>

          {/* MENU DESKTOP */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-bold text-slate-400">
            <button onClick={() => scrollTo('empresas')} className="hover:text-white transition-colors">Para Lojas</button>
            <button onClick={() => scrollTo('medidores')} className="hover:text-white transition-colors">Para Medidores</button>
            <button onClick={() => scrollTo('como-funciona')} className="hover:text-white transition-colors">Como Funciona</button>
            <button onClick={() => scrollTo('calculadora')} className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
              <span>💰</span> Simulador ROI
            </button>
            <button onClick={() => scrollTo('planos')} className="hover:text-white transition-colors">Planos</button>
            <button onClick={() => scrollTo('faq')} className="hover:text-white transition-colors">Dúvidas</button>
          </nav>

          {/* AÇÕES */}
          <div className="flex items-center gap-3">
            <a 
              href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20conhecer%20os%20servi%C3%A7os%20do%20SGM.PRO" 
              target="_blank" 
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 bg-emerald-950/70 border border-emerald-500/40 hover:bg-emerald-900/60 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-black transition-all"
            >
              <span>💬</span> WhatsApp
            </a>

            <button 
              onClick={onIrParaLogin}
              className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs md:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
            >
              <span>🔐</span> Acessar Painel
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION */}
      {/* ========================================================================= */}
      <section id="inicio" className="relative pt-16 pb-24 md:pt-24 md:pb-36 overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/15 blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-emerald-600/10 blur-[130px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-700/60 px-4 py-1.5 rounded-full mb-8 shadow-xl">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-300">
              Mais de <strong className="text-emerald-400">232.000 medições executadas</strong> com precisão milimétrica
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.08] max-w-5xl mx-auto">
            A Maior Rede de <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Medição Técnica Terceirizada</span> do Brasil.
          </h1>

          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed">
            Elimine 100% do risco trabalhista CLT, reduza até 30% seus custos com medição e receba laudos técnicos com fotos, croquis com cotas e arquivos <strong>Promob</strong> prontos para sua produção.
          </p>

          {/* BOTÕES PRINCIPAIS DE CONVERSÃO */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button 
              onClick={() => scrollTo('calculadora')} 
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-4 rounded-2xl font-black text-base shadow-xl shadow-blue-600/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <span>📊</span> Simular Minha Economia
            </button>
            <button 
              onClick={() => scrollTo('contato')} 
              className="w-full sm:w-auto bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-8 py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2"
            >
              <span>🤝</span> Credenciar Empresa
            </button>
          </div>

          {/* INDICADORES EM NÚMEROS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-16 max-w-4xl mx-auto">
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
              <span className="text-2xl md:text-3xl font-black text-blue-400 font-mono">232k+</span>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Medições Feitas</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
              <span className="text-2xl md:text-3xl font-black text-emerald-400 font-mono">100+</span>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Lojas Parceiras</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
              <span className="text-2xl md:text-3xl font-black text-amber-400 font-mono">450+</span>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Técnicos Credenciados</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
              <span className="text-2xl md:text-3xl font-black text-purple-400 font-mono">24.7%</span>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">Economia vs CLT</p>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. PROPOSTA DE VALOR DUPLA (LOJAS vs MEDIDORES) */}
      {/* ========================================================================= */}
      <section className="py-20 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Um Ecossistema Completo</h2>
            <h3 className="text-3xl md:text-4xl font-black text-white mt-2">
              Feito sob medida para transformar as duas pontas da marcenaria
            </h3>
            <p className="text-slate-400 text-sm md:text-base mt-3">
              Conectamos a demanda das lojas e fábricas à habilidade e prontidão de técnicos especializados com suporte ponta a ponta.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* BLOCO 1: PARA LOJAS & EMPRESAS */}
            <div id="empresas" className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-blue-500/30 p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20">🏢</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Para Lojas de Planejados & Marcenarias</span>
                  <h4 className="text-2xl font-black text-white">Mais Margem, Zero Dor de Cabeça</h4>
                </div>
              </div>

              <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                Manter medidores internos contratados sob regime CLT gera encargos trabalhistas de 70%, frota depreciando, combustível e ociosidade em semanas de baixo fluxo. Com o SGM.PRO, você só paga pela medição executada.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black text-lg">✓</span>
                  <div>
                    <strong className="text-white text-sm block">100% Livre de Passivo Trabalhista</strong>
                    <span className="text-xs text-slate-400">Profissionais terceirizados autônomos credenciados com contrato de prestação de serviços.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black text-lg">✓</span>
                  <div>
                    <strong className="text-white text-sm block">Laudos com Fotos, Croquis e Promob</strong>
                    <span className="text-xs text-slate-400">Conferência completa de prumos, esquadros, tomadas, hidráulica, gás e arquivos .promob prontos para modular.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black text-lg">✓</span>
                  <div>
                    <strong className="text-white text-sm block">Validação com o Cliente via Link Mágico</strong>
                    <span className="text-xs text-slate-400">O cliente da sua loja recebe um link no celular e valida as anotações do imóvel com assinatura digital sem app.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black text-lg">✓</span>
                  <div>
                    <strong className="text-white text-sm block">Agendamento Ágil e SLA de Urgência</strong>
                    <span className="text-xs text-slate-400">Técnicos distribuídos por radar de geolocalização com opção de atendimento expresso em até 24 horas.</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <button 
                  onClick={() => scrollTo('contato')} 
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-black text-sm transition-all"
                >
                  Quero Terceirizar as Medições da Minha Loja ➔
                </button>
              </div>
            </div>

            {/* BLOCO 2: PARA MEDIDORES TÉCNICOS */}
            <div id="medidores" className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-emerald-500/30 p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl p-3 bg-emerald-600/10 rounded-2xl border border-emerald-500/20">👷</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Para Medidores & Projetistas</span>
                  <h4 className="text-2xl font-black text-white">Liberdade de Rotina e Alta Renda</h4>
                </div>
              </div>

              <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                Pare de bater de porta em porta procurando serviços avulsos. O SGM.PRO direciona demandas contínuas das maiores lojas da sua região direto para o seu celular com rotas otimizadas.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black text-lg">✓</span>
                  <div>
                    <strong className="text-white text-sm block">Potencial de Faturamento de R$ 5k a R$ 15k/mês</strong>
                    <span className="text-xs text-slate-400">Receba por medição executada com média de 4 a 6 chamados diários no seu radar regional.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black text-lg">✓</span>
                  <div>
                    <strong className="text-white text-sm block">Radar Inteligente por Geolocalização</strong>
                    <span className="text-xs text-slate-400">Escolha as demandas mais convenientes próximas a você, economizando tempo no trânsito e combustível.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black text-lg">✓</span>
                  <div>
                    <strong className="text-white text-sm block">Recebimento Seguro e Pontual via PIX</strong>
                    <span className="text-xs text-slate-400">Acompanhe seu saldo em tempo real no painel "Meu Caixa", com repasses transparentes e opção de antecipação.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-black text-lg">✓</span>
                  <div>
                    <strong className="text-white text-sm block">Capacitação Técnica & Selo Verificado SGM</strong>
                    <span className="text-xs text-slate-400">Acesso a modelos de croquis, treinamentos de boas práticas Promob e credibilidade no mercado.</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <button 
                  onClick={() => scrollTo('contato')} 
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-black text-sm transition-all"
                >
                  Quero me Cadastrar como Medidor Parceiro ➔
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. A REGRA DE NEGÓCIO: COMO FUNCIONA O SGM.PRO */}
      {/* ========================================================================= */}
      <section id="como-funciona" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Passo a Passo Transparente</span>
            <h3 className="text-3xl md:text-4xl font-black text-white mt-2">
              Como funciona o fluxo de uma medição no sistema
            </h3>
            <p className="text-slate-400 text-sm md:text-base mt-3">
              Da solicitação do lojista à entrega final dos arquivos técnicos para a fábrica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-2xl font-black text-blue-400 font-mono block mb-2">01</span>
                <h5 className="text-sm font-black text-white mb-1">Abertura da OS</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  A loja cadastra o cliente, endereço e anexa a planta do arquiteto em PDF.
                </p>
              </div>
              <span className="text-xs text-blue-400/80 font-mono mt-4 block">100% Online</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-2xl font-black text-indigo-400 font-mono block mb-2">02</span>
                <h5 className="text-sm font-black text-white mb-1">Radar de Técnicos</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O sistema alerta os medidores credenciados mais próximos por geolocalização.
                </p>
              </div>
              <span className="text-xs text-indigo-400/80 font-mono mt-4 block">Raio até 25km</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-2xl font-black text-amber-400 font-mono block mb-2">03</span>
                <h5 className="text-sm font-black text-white mb-1">Visita In-Loco</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O técnico comparece, afere prumo, esquadro, pontos de água e tomadas com trena a laser.
                </p>
              </div>
              <span className="text-xs text-amber-400/80 font-mono mt-4 block">Precisão Milimétrica</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-2xl font-black text-purple-400 font-mono block mb-2">04</span>
                <h5 className="text-sm font-black text-white mb-1">Magic Link</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O cliente final confere e assina digitalmente as observações pelo WhatsApp sem instalar app.
                </p>
              </div>
              <span className="text-xs text-purple-400/80 font-mono mt-4 block">Validação Jurídica</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-2xl font-black text-emerald-400 font-mono block mb-2">05</span>
                <h5 className="text-sm font-black text-white mb-1">Entrega Técnica</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload do laudo PDF, galeria de fotos, croqui com cotas e arquivo Promob.
                </p>
              </div>
              <span className="text-xs text-emerald-400/80 font-mono mt-4 block">Pronto pra Modulação</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <span className="text-2xl font-black text-blue-400 font-mono block mb-2">06</span>
                <h5 className="text-sm font-black text-white mb-1">Repasse & PIX</h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Liquidação do pagamento da loja e repasse seguro ao medidor credenciado.
                </p>
              </div>
              <span className="text-xs text-blue-400/80 font-mono mt-4 block">Zero Inadimplência</span>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SIMULADOR DE ROI / CALCULADORA DE ECONOMIA E GANHOS */}
      {/* ========================================================================= */}
      <section id="calculadora" className="py-20 bg-slate-900/50 border-y border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              Calculadora Dinâmica de Retorno
            </span>
            <h3 className="text-3xl md:text-5xl font-black text-white mt-4">
              Calcule seu Retorno Financeiro
            </h3>
            <p className="text-slate-400 text-sm md:text-base mt-2">
              Descubra quanto sua loja economiza ao terceirizar ou quanto você pode faturar como medidor credenciado.
            </p>

            {/* SELETOR DE PERFIL DA CALCULADORA */}
            <div className="inline-flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mt-6">
              <button 
                onClick={() => setTipoCalculadora('loja')} 
                className={`px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all ${tipoCalculadora === 'loja' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                🏢 Sou Loja / Marcenaria
              </button>
              <button 
                onClick={() => setTipoCalculadora('medidor')} 
                className={`px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all ${tipoCalculadora === 'medidor' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                👷 Sou Medidor Técnico
              </button>
            </div>
          </div>

          {/* CALCULADORA PARA LOJAS */}
          {tipoCalculadora === 'loja' && (
            <div className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                
                {/* CONTROLES */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                    Volume de Medições por Mês da sua Loja:
                  </label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="10" 
                      max="150" 
                      step="5" 
                      value={volumeOSLoja} 
                      onChange={(e) => setVolumeOSLoja(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    <span className="text-2xl font-black font-mono text-blue-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                      {volumeOSLoja}
                    </span>
                  </div>

                  <div className="mt-8 space-y-3 text-xs text-slate-400 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
                    <p className="flex justify-between">
                      <span>Custo com Medidor Próprio CLT:</span>
                      <strong className="text-slate-300 font-mono">R$ 580,00 / OS</strong>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      *Considera salário fixo R$ 2.800 + encargos 70% + combustível + depreciação de veículo/seguro + ociosidade.
                    </p>
                    <p className="flex justify-between pt-2 border-t border-slate-800">
                      <span>Investimento SGM.PRO (Apê Completo 5 cômodos):</span>
                      <strong className="text-emerald-400 font-mono">R$ 200,00 / OS</strong>
                    </p>
                  </div>
                </div>

                {/* RESULTADO LOJA */}
                <div className="bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/30 p-6 md:p-8 rounded-2xl text-center flex flex-col justify-center">
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Economia Estimada</span>
                  
                  <p className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono mt-2">
                    {formatarMoeda(economiaMensalLoja)} <span className="text-sm font-bold text-slate-400">/mês</span>
                  </p>

                  <p className="text-xl font-black text-white font-mono mt-1">
                    {formatarMoeda(economiaAnualLoja)} <span className="text-xs font-bold text-slate-400">/ano</span>
                  </p>

                  <div className="mt-4 inline-block bg-emerald-900/40 border border-emerald-700/50 px-3 py-1 rounded-full text-xs font-black text-emerald-300">
                    ⚡ {percentualEconomiaLoja}% de Redução Líquida de Custo
                  </div>

                  <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                    Além de economizar mais de <strong>{formatarMoeda(economiaAnualLoja)}</strong> ao ano, sua empresa fica <strong>100% imune a reclamatórias trabalhistas</strong>.
                  </p>

                  <button 
                    onClick={() => scrollTo('contato')} 
                    className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 rounded-xl shadow-lg transition-all"
                  >
                    Garantir essa Economia na Minha Loja ➔
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* CALCULADORA PARA MEDIDORES */}
          {tipoCalculadora === 'medidor' && (
            <div className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                
                {/* CONTROLES */}
                <div>
                  <div className="mb-6">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                      Medições que você quer fazer por dia:
                    </label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="1" 
                        max="6" 
                        step="1" 
                        value={medicoesPorDia} 
                        onChange={(e) => setMedicoesPorDia(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                      />
                      <span className="text-2xl font-black font-mono text-emerald-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                        {medicoesPorDia}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                      Dias trabalhados por semana:
                    </label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="3" 
                        max="6" 
                        step="1" 
                        value={diasPorSemana} 
                        onChange={(e) => setDiasPorSemana(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                      />
                      <span className="text-2xl font-black font-mono text-emerald-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                        {diasPorSemana}d
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 text-xs text-slate-400 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
                    <p className="flex justify-between">
                      <span>Média de repasse por medição (80% da OS):</span>
                      <strong className="text-emerald-400 font-mono">R$ 160,00 / OS</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      *80% do valor da OS é seu! Em um apartamento de 5 cômodos (R$ 200), você recebe R$ 160,00 líquidos.
                    </p>
                  </div>
                </div>

                {/* RESULTADO MEDIDOR */}
                <div className="bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-500/30 p-6 md:p-8 rounded-2xl text-center flex flex-col justify-center">
                  <span className="text-xs font-black uppercase tracking-widest text-blue-400">Projeção de Faturamento</span>
                  
                  <p className="text-3xl sm:text-4xl font-black text-white font-mono mt-2">
                    {formatarMoeda(ganhoBrutoMensal)} <span className="text-sm font-bold text-slate-400">/mês</span>
                  </p>

                  <p className="text-sm text-slate-400 mt-1">
                    Executando cerca de <strong>{Math.round(totalMedicoesMes)} medições</strong> por mês
                  </p>

                  <div className="mt-4 inline-block bg-blue-900/40 border border-blue-700/50 px-3 py-1 rounded-full text-xs font-black text-blue-300">
                    🚀 Liberdade de Horários + Pagamentos via PIX
                  </div>

                  <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                    Trabalhe com autonomia perto da sua casa, aceite apenas as OSs que desejar e receba pontualmente.
                  </p>

                  <button 
                    onClick={() => scrollTo('contato')} 
                    className="mt-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs py-3 rounded-xl shadow-lg transition-all"
                  >
                    Cadastrar como Medidor Credenciado ➔
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. TABELA DE PLANOS & PREÇOS */}
      {/* ========================================================================= */}
      <section id="planos" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Planos & Condições Comerciais</span>
            <h3 className="text-3xl md:text-4xl font-black text-white mt-2">
              Planos Transparentes para Cada Momento do seu Negócio
            </h3>
            <p className="text-slate-400 text-sm md:text-base mt-3">
              Sem taxas escondidas. Escolha o modelo que melhor se adapta à sua demanda.
            </p>
          </div>

          {/* PLANOS PARA EMPRESAS */}
          <div className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl">🏢</span>
              <h4 className="text-lg font-black text-white">Planos Corporativos (Lojas & Marcenarias)</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* PLANO STARTER */}
              <div className="bg-slate-900/60 border border-slate-800 p-6 md:p-8 rounded-3xl flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Starter On-Demand</span>
                  <div className="mt-3 mb-4">
                    <span className="text-3xl font-black text-white">R$ 0</span>
                    <span className="text-slate-500 text-xs"> /mensalidade</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    Ideal para pequenas marcenarias ou arquitetos com demanda pontual de medições.
                  </p>

                  <ul className="space-y-3 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><span>✓</span> Apenas R$ 200 no combo de 5 ambientes (ou à la carte)</li>
                    <li className="flex items-center gap-2"><span>✓</span> Laudo PDF com fotos em alta resolução</li>
                    <li className="flex items-center gap-2"><span>✓</span> Validação digital via Magic Link</li>
                    <li className="flex items-center gap-2"><span>✓</span> Sem mensalidade nem fidelidade</li>
                    <li className="flex items-center gap-2 text-slate-600"><span>✕</span> Sem medidores dedicados</li>
                  </ul>
                </div>

                <button 
                  onClick={() => scrollTo('contato')} 
                  className="w-full mt-8 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs py-3 rounded-xl transition-all"
                >
                  Começar sem Mensalidade
                </button>
              </div>

              {/* PLANO PRO (DESTACADO) */}
              <div className="bg-gradient-to-b from-blue-950/60 to-slate-900 border-2 border-blue-500 p-6 md:p-8 rounded-3xl shadow-2xl relative flex flex-col justify-between transform md:-translate-y-2">
                <div className="absolute -top-3 right-6 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                  Mais Popular
                </div>

                <div>
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Plano Pro Lojista</span>
                  <div className="mt-3 mb-4">
                    <span className="text-3xl font-black text-white">R$ 290</span>
                    <span className="text-slate-400 text-xs"> /mês</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    Para lojas com fluxo constante que necessitam de projetos Promob e prioridade no radar.
                  </p>

                  <ul className="space-y-3 text-xs text-slate-200">
                    <li className="flex items-center gap-2 font-bold text-emerald-400"><span>✓</span> Desconto adicional em lote e prioridade máxima</li>
                    <li className="flex items-center gap-2"><span>✓</span> Arquivo Promob (.promob) montado</li>
                    <li className="flex items-center gap-2"><span>✓</span> Medidores Ouro com prioridade de envio</li>
                    <li className="flex items-center gap-2"><span>✓</span> Painel de Business Intelligence (BI)</li>
                    <li className="flex items-center gap-2"><span>✓</span> Suporte técnico prioritário via WhatsApp</li>
                  </ul>
                </div>

                <button 
                  onClick={() => scrollTo('contato')} 
                  className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs py-3.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all"
                >
                  Contratar Plano Pro
                </button>
              </div>

              {/* PLANO ENTERPRISE */}
              <div className="bg-slate-900/60 border border-slate-800 p-6 md:p-8 rounded-3xl flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enterprise & Redes</span>
                  <div className="mt-3 mb-4">
                    <span className="text-3xl font-black text-white">Sob Consulta</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    Para redes de franquias e indústrias moveleiras com mais de 50 medições mensais.
                  </p>

                  <ul className="space-y-3 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><span>✓</span> Tabela com descontos progressivos em escala</li>
                    <li className="flex items-center gap-2"><span>✓</span> Equipe exclusiva de medidores dedicados</li>
                    <li className="flex items-center gap-2"><span>✓</span> Integração via API com seu ERP / Promob Cut</li>
                    <li className="flex items-center gap-2"><span>✓</span> SLA contratual de urgência em até 24h</li>
                    <li className="flex items-center gap-2"><span>✓</span> Gerente de conta exclusivo e relatórios de SLA</li>
                  </ul>
                </div>

                <button 
                  onClick={() => scrollTo('contato')} 
                  className="w-full mt-8 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs py-3 rounded-xl transition-all"
                >
                  Falar com Consultor Enterprise
                </button>
              </div>

            </div>
          </div>

          {/* PLANOS PARA MEDIDORES */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl">👷</span>
              <h4 className="text-lg font-black text-white">Credenciamento de Medidores Técnicos</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              
              <div className="bg-slate-900/60 border border-slate-800 p-6 md:p-8 rounded-3xl flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Medidor Credenciado</span>
                  <div className="mt-3 mb-2">
                    <span className="text-3xl font-black text-white">100% Grátis</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Acesso completo ao radar para aceitar medições avulsas na sua região.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2"><span>✓</span> Cadastro sem nenhum custo de entrada</li>
                    <li className="flex items-center gap-2"><span>✓</span> Repasse de 80% do valor da OS (até R$ 160+ por OS)</li>
                    <li className="flex items-center gap-2"><span>✓</span> Pagamento quinzenal garantido</li>
                  </ul>
                </div>
                <button 
                  onClick={() => scrollTo('contato')} 
                  className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs py-3 rounded-xl transition-all"
                >
                  Cadastrar Gratuitamente
                </button>
              </div>

              <div className="bg-gradient-to-b from-emerald-950/50 to-slate-900 border border-emerald-500/40 p-6 md:p-8 rounded-3xl flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Medidor Master PRO</span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30">Destaque</span>
                  </div>
                  <div className="mt-2 mb-2">
                    <span className="text-3xl font-black text-white">R$ 59</span>
                    <span className="text-slate-400 text-xs"> /mês</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Para técnicos que querem fazer da medição sua principal fonte de renda.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-200">
                    <li className="flex items-center gap-2 font-bold text-emerald-300"><span>✓</span> Prioridade máxima no radar no raio de 25km</li>
                    <li className="flex items-center gap-2"><span>✓</span> Recebimento antecipado via PIX em até 24h</li>
                    <li className="flex items-center gap-2"><span>✓</span> Selo Verificado no perfil visto pelas lojas</li>
                    <li className="flex items-center gap-2"><span>✓</span> Suporte de engenharia para conferência Promob</li>
                  </ul>
                </div>
                <button 
                  onClick={() => scrollTo('contato')} 
                  className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 rounded-xl transition-all"
                >
                  Garantir Vaga Master PRO
                </button>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FAQ (PERGUNTAS FREQUENTES) */}
      {/* ========================================================================= */}
      <section id="faq" className="py-20 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Tire Suas Dúvidas</span>
            <h3 className="text-3xl md:text-4xl font-black text-white mt-2">
              Perguntas Frequentes (FAQ)
            </h3>
            <p className="text-slate-400 text-sm mt-2">
              Tudo o que você precisa saber antes de contratar ou se credenciar.
            </p>
          </div>

          <div className="space-y-4">
            
            {[
              {
                p: 'E se houver alguma divergência de medidas na hora da montagem dos móveis?',
                r: 'Todos os medidores credenciados seguem o checklist oficial com medição cruzada e fotos de todos os ângulos com cotas visíveis. Caso haja qualquer inconformidade comprovada, nosso seguro técnico garante a realização de uma nova conferência imediata sem nenhum custo adicional para a loja.'
              },
              {
                p: 'Como é feita a entrega do arquivo Promob?',
                r: 'No fechamento da OS, o técnico anexa diretamente no portal o arquivo .promob (ou arquivo DWG/DXF correspondente) já com as paredes, prumos, tomadas, hidráulica e esquadrias levantadas em 3D, poupando horas de trabalho da equipe de projetos da loja.'
              },
              {
                p: 'Minha loja tem obrigação de manter um número mínimo de medições por mês?',
                r: 'Não! No plano Starter, sua loja tem flexibilidade absoluta: se em determinado mês você tiver 3 medições, pagará apenas por 3. Se no outro tiver 80, terá 80 medidores prontos para atender sem que você precise contratar ninguém.'
              },
              {
                p: 'Como funciona o Magic Link enviado para o cliente final?',
                r: 'Ao concluir a medição in-loco, o sistema gera um link seguro e criptografado que é enviado por WhatsApp ou SMS para o cliente proprietário do imóvel. Ele abre em qualquer smartphone, visualiza o resumo e confirma o recebimento digitalmente, gerando validade jurídica.'
              },
              {
                p: 'Quais os requisitos para me credenciar como Medidor Parceiro?',
                r: 'Você precisa ter trena a laser profissional, smartphone com câmera de boa qualidade, veículo ou moto própria para locomoção, noções técnicas de arquitetura/marcenaria e compromisso com pontualidade e apresentação profissional.'
              },
              {
                p: 'Como e quando o medidor técnico recebe o repasse?',
                r: 'Os repasses são feitos diretamente na sua conta bancária via PIX. No plano gratuito, os repasses ocorrem quinzenalmente. No plano Master PRO, você pode solicitar a liberação via PIX no dia seguinte à validação da OS.'
              }
            ].map((faq, idx) => (
              <div 
                key={idx} 
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all"
              >
                <button 
                  onClick={() => toggleFaq(idx)} 
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-black text-sm md:text-base text-white hover:text-blue-400 transition-colors"
                >
                  <span>{faq.p}</span>
                  <span className="text-slate-500 text-lg shrink-0 font-mono">
                    {faqAberto === idx ? '−' : '+'}
                  </span>
                </button>
                {faqAberto === idx && (
                  <div className="px-5 pb-5 text-xs md:text-sm text-slate-400 border-t border-slate-800/60 pt-3 leading-relaxed animate-fade-in">
                    {faq.r}
                  </div>
                )}
              </div>
            ))}

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FORMULÁRIO DE CONTATO & CAPTURA DE LEADS */}
      {/* ========================================================================= */}
      <section id="contato" className="py-24 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 md:p-12 rounded-3xl shadow-2xl relative">
            
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Atendimento Imediato</span>
              <h3 className="text-2xl md:text-4xl font-black text-white mt-2">
                Fale com a Equipe Comercial SGM.PRO
              </h3>
              <p className="text-slate-400 text-xs md:text-sm mt-2">
                Preencha os dados abaixo para receber nossa apresentação corporativa ou se cadastrar como profissional credenciado.
              </p>

              {/* SELEÇÃO DO PERFIL NO FORMULÁRIO */}
              <div className="inline-flex bg-slate-950 p-1 rounded-xl border border-slate-800 mt-6">
                <button 
                  type="button"
                  onClick={() => setFormTipo('empresa')} 
                  className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${formTipo === 'empresa' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  Quero Contratar para Minha Loja
                </button>
                <button 
                  type="button"
                  onClick={() => setFormTipo('medidor')} 
                  className={`px-5 py-2 rounded-lg text-xs font-black transition-all ${formTipo === 'medidor' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                >
                  Quero ser Medidor Parceiro
                </button>
              </div>
            </div>

            {formSucesso && (
              <div className="bg-emerald-950/60 border border-emerald-500/50 p-6 rounded-2xl mb-8 text-center animate-fade-in">
                <span className="text-3xl block mb-2">🎉</span>
                <h4 className="text-lg font-black text-emerald-400">Solicitação Enviada com Sucesso!</h4>
                <p className="text-xs text-slate-300 mt-1 max-w-lg mx-auto">
                  Sua mensagem foi gravada no sistema e notificada à nossa equipe. Se preferir atendimento imediato, clique no botão abaixo para conversar no WhatsApp oficial:
                </p>
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a 
                    href={whatsappLeadUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2"
                  >
                    <span>💬</span> Iniciar Conversa no WhatsApp Agora ➔
                  </a>
                  <button 
                    type="button" 
                    onClick={() => setFormSucesso(false)} 
                    className="text-xs text-slate-400 hover:text-white font-bold px-4 py-2"
                  >
                    Enviar Outra Mensagem
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitLead} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Seu Nome Completo *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: Carlos Silva"
                    value={formNome} 
                    onChange={e => setFormNome(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none focus:border-blue-500" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                    {formTipo === 'empresa' ? 'Nome da Loja / Marcenaria *' : 'Especialidade / Profissão *'}
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder={formTipo === 'empresa' ? 'Ex: Planejados Conceito' : 'Ex: Medidor Técnico / Promob'}
                    value={formEmpresa} 
                    onChange={e => setFormEmpresa(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none focus:border-blue-500" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">E-mail Corporativo *</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="seuemail@empresa.com"
                    value={formEmail} 
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none focus:border-blue-500" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">WhatsApp com DDD *</label>
                  <input 
                    type="tel" 
                    required 
                    placeholder="(11) 99999-9999"
                    value={formTelefone} 
                    onChange={e => setFormTelefone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none focus:border-blue-500" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Cidade / UF *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ex: São Paulo - SP"
                    value={formCidade} 
                    onChange={e => setFormCidade(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm outline-none focus:border-blue-500" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={formLoading}
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-xl font-black text-sm shadow-xl shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {formLoading ? 'Enviando e Notificando Equipe...' : (formTipo === 'empresa' ? 'Solicitar Contato Comercial para Minha Loja ➔' : 'Enviar Meu Cadastro como Medidor ➔')}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-800 text-center flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-slate-400">
              <span>Precisa de resposta imediata?</span>
              <a 
                href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20um%20consultor%20do%20SGM.PRO" 
                target="_blank" 
                rel="noreferrer"
                className="text-emerald-400 font-bold hover:underline flex items-center gap-1"
              >
                <span>💬</span> Chamar Consultor no WhatsApp Oficial
              </a>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. FOOTER INSTITUCIONAL */}
      {/* ========================================================================= */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl font-black italic tracking-tighter text-white">
                SGM<span className="text-blue-500">.PRO</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">v2.5 Enterprise</span>
            </div>
            <p className="text-slate-500 max-w-sm">
              Sistema de Gestão e Terceirização de Medições Técnicas para o setor moveleiro e arquitetura de interiores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-bold text-slate-400">
            <button onClick={() => scrollTo('inicio')} className="hover:text-white">Início</button>
            <button onClick={() => scrollTo('empresas')} className="hover:text-white">Para Lojas</button>
            <button onClick={() => scrollTo('medidores')} className="hover:text-white">Para Medidores</button>
            <button onClick={() => scrollTo('planos')} className="hover:text-white">Planos</button>
            <button onClick={() => scrollTo('faq')} className="hover:text-white">FAQ</button>
            <button onClick={onIrParaLogin} className="text-blue-400 hover:text-blue-300">Área do Cliente</button>
          </div>

          <div className="text-center md:text-right">
            <p>© {new Date().getFullYear()} SGM.PRO Tecnologia S.A.</p>
            <p className="text-[10px] text-slate-600 mt-1">Todos os direitos reservados. CNPJ 00.000.000/0001-00</p>
          </div>

        </div>
      </footer>

    </div>
  )
}
