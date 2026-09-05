import { useState } from 'react'

export default function TermosModal({ isOpen, onClose }) {
  const [aba, setAba] = useState('medidor') // 'medidor' | 'loja'

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-fade-in my-6 flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚖️</span>
              <h2 className="text-xl font-black text-white">Termos Jurídicos & Conformidade SGM.PRO</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Adequação sob o Art. 442-B da CLT, Lei 13.709/2018 (LGPD) e Art. 15 da Lei 12.965/2014 (Marco Civil)
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Abas de Navegação */}
        <div className="grid grid-cols-2 bg-slate-950/80 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setAba('medidor')}
            className={`py-3.5 px-4 font-bold text-xs md:text-sm transition-all border-b-2 flex items-center justify-center gap-2 ${
              aba === 'medidor' 
                ? 'border-blue-500 text-blue-400 bg-blue-500/10' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>🛵</span> Termo de Parceria Autônoma (Medidor)
          </button>
          <button
            onClick={() => setAba('loja')}
            className={`py-3.5 px-4 font-bold text-xs md:text-sm transition-all border-b-2 flex items-center justify-center gap-2 ${
              aba === 'loja' 
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>🏬</span> Garantia & Seguro de Medição (Loja)
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-xs md:text-sm leading-relaxed custom-scrollbar flex-1">
          {aba === 'medidor' ? (
            <div className="space-y-4">
              <div className="bg-blue-950/30 border border-blue-500/20 p-4 rounded-2xl">
                <p className="font-bold text-blue-400 text-xs uppercase tracking-wider mb-1">
                  Enquadramento Legal: Artigo 442-B da Consolidação das Leis do Trabalho (CLT)
                </p>
                <p className="text-slate-300 text-xs">
                  "A contratação do autônomo, cumpridas por este todas as formalidades legais, com ou sem exclusividade, de forma contínua ou não, afasta a qualidade de empregado prevista no art. 3º desta Consolidação."
                </p>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  1. Da Natureza Jurídica da Parceria
                </h3>
                <p>
                  O Medidor declara expressamente atuar como <strong>Prestador de Serviços Autônomo</strong>, devidamente inscrito no Cadastro de Pessoas Físicas (CPF) ou Cadastro Nacional da Pessoa Jurídica (CNPJ / MEI), prestando serviços técnicos de levantamento arquitetônico e conferência de medidas de forma estritamente independente.
                </p>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  2. Da Ausência de Exclusividade e Subordinação
                </h3>
                <p>
                  Não existe entre a plataforma <strong>SGM.PRO</strong> e o Medidor qualquer relação de subordinação hierárquica, cumprimento de jornada pré-fixada, exclusividade ou controle disciplinar. O Medidor possui total liberdade para aceitar ou recusar as demandas disponibilizadas no "Radar de Demandas", bem como prestar serviços a terceiros simultaneamente.
                </p>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  3. Da Remuneração e Liquidação via PIX
                </h3>
                <p>
                  A remuneração do Medidor é calculada estritamente por produção/demanda entregue, composta por:
                </p>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-400">
                  <li>Taxa combinada por metro quadrado (m²) multiplicado pela área e complexidade dos ambientes da OS;</li>
                  <li>Taxa de deslocamento calculada por distância rodoviária até o local da obra;</li>
                  <li>Repasse automático ou sob demanda diretamente na chave PIX cadastrada em seu perfil.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  4. Dos Requisitos Técnicos e Ferramental
                </h3>
                <p>
                  O Medidor é integralmente responsável por fornecer seus próprios instrumentos de trabalho em perfeito estado de aferição, incluindo obrigatoriamente: trena a laser calibrada, trena convencional de fita, nível a laser ou bolha e dispositivo móvel para captura fotográfica e envio dos relatórios à plataforma.
                </p>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  5. Do Sigilo Profissional e LGPD
                </h3>
                <p>
                  O Medidor obriga-se a manter total sigilo sobre dados de clientes, plantas executivas, orçamentos e endereços residenciais que tiver acesso em virtude da realização das medições, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-950/30 border border-emerald-500/20 p-4 rounded-2xl">
                <p className="font-bold text-emerald-400 text-xs uppercase tracking-wider mb-1">
                  Segurança Operacional SGM: Garantia de Medição Técnica e Seguro de Corte
                </p>
                <p className="text-slate-300 text-xs">
                  Para conferir tranquilidade aos lojistas de móveis planejados e marmorarias, a plataforma SGM.PRO institui a política de garantia técnica com cobertura indenizatória de perdas materiais.
                </p>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  1. Da Margem de Tolerância Dimensional
                </h3>
                <p>
                  Em conformidade com as boas práticas da indústria moveleira e normas ABNT aplicáveis à construção civil (NBR 15097), considera-se margem de tolerância técnica dimensional aceitável a variação de até <strong>±2mm (dois milímetros)</strong> entre a medição de campo e o elemento executado, decorrente de imperfeições naturais de reboco e dilatação térmica.
                </p>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  2. Do Fundo de Garantia e Seguro SGM (Cobertura até R$ 500,00)
                </h3>
                <p>
                  Caso seja constatado erro crasso ou divergência dimensional superior à tolerância técnica atribuível exclusivamente à medição homologada na plataforma, a SGM.PRO assegura o ressarcimento das peças de MDF/MDP danificadas no limite de até <strong>R$ 500,00 (quinhentos reais)</strong> por Ordem de Serviço.
                </p>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  3. Dos Prazos e Condições de Acionamento
                </h3>
                <p>
                  Para ter direito à cobertura da garantia técnica, a Loja Contratante deve:
                </p>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-400">
                  <li>Notificar a plataforma através do canal oficial em até <strong>7 (sete) dias úteis</strong> após a entrega ou tentativa de montagem das peças no local;</li>
                  <li>Apresentar fotos nítidas comprovando a incompatibilidade entre o relatório de medição entregue e a alvenaria;</li>
                  <li>Manter as peças inalteradas para eventuais conferências ou vistoria in loco.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide mb-1">
                  4. Da Auditoria e Validade Jurídica do Briefing do Cliente
                </h3>
                <p>
                  O aceite eletrônico e agendamento preenchidos pelo cliente final através do <em>Link Mágico</em> são certificados com carimbo de data/hora UTC, endereço IP de conexão e User-Agent do dispositivo, constituindo registro auditável e idôneo perante o Art. 15 da Lei Federal 12.965/2014 (Marco Civil da Internet).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
          <p className="text-[11px] text-slate-500">
            Última atualização contratual: {new Date().toLocaleDateString('pt-BR')} • Versão 2.4 SGM
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Entendido e Ciente
          </button>
        </div>

      </div>
    </div>
  )
}
