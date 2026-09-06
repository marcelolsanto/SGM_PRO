package models

import "time"

// FechamentoMedidor representa um lote de fechamento periódico de medições (quinzenal ou mensal)
type FechamentoMedidor struct {
	ID                     uint       `gorm:"primaryKey" json:"id"`
	MedidorID              uint       `gorm:"column:medidor_id;not null;index" json:"medidor_id"`
	NumeroLote             string     `gorm:"column:numero_lote;size:50;uniqueIndex;not null" json:"numero_lote"`
	PeriodoInicio          time.Time  `gorm:"column:periodo_inicio;not null" json:"periodo_inicio"`
	PeriodoFim             time.Time  `gorm:"column:periodo_fim;not null" json:"periodo_fim"`
	QuantidadeOS           int        `gorm:"column:quantidade_os;default:0" json:"quantidade_os"`
	ValorMaoDeObra         float64    `gorm:"column:valor_mao_de_obra;default:0" json:"valor_mao_de_obra"`
	ValorDeslocamento      float64    `gorm:"column:valor_deslocamento;default:0" json:"valor_deslocamento"`
	ValorAdicionais        float64    `gorm:"column:valor_adicionais;default:0" json:"valor_adicionais"`
	ValorDescontos         float64    `gorm:"column:valor_descontos;default:0" json:"valor_descontos"`
	ValorBruto             float64    `gorm:"column:valor_bruto;default:0" json:"valor_bruto"`
	ValorRetencoesImpostos float64    `gorm:"column:valor_retencoes_impostos;default:0" json:"valor_retencoes_impostos"` // INSS/IRRF/ISS se RPA
	ValorLiquido           float64    `gorm:"column:valor_liquido;default:0" json:"valor_liquido"`
	Status                 string     `gorm:"column:status;size:30;default:'ENVIADO_CONFERENCIA'" json:"status"` // RASCUNHO, ENVIADO_CONFERENCIA, APROVADO, PAGO, RECUSADO
	TipoDocumentoFiscal    string     `gorm:"column:tipo_documento_fiscal;size:20;default:'MEI'" json:"tipo_documento_fiscal"` // NFSE, MEI, RPA
	NumeroDocumentoFiscal  string     `gorm:"column:numero_documento_fiscal;size:100" json:"numero_documento_fiscal"`
	UrlDocumentoFiscal     string     `gorm:"column:url_documento_fiscal" json:"url_documento_fiscal"`
	UrlComprovantePix      string     `gorm:"column:url_comprovante_pix" json:"url_comprovante_pix"`
	UrlPlanilhaEnviada     string     `gorm:"column:url_planilha_enviada" json:"url_planilha_enviada"`
	ChavePix               string     `gorm:"column:chave_pix" json:"chave_pix"`
	TipoChavePix           string     `gorm:"column:tipo_chave_pix;default:'CPF'" json:"tipo_chave_pix"`
	DivergenciasJson       string     `gorm:"column:divergencias_json;type:text" json:"divergencias_json"`
	ObservacoesFinanceiro  string     `gorm:"column:observacoes_financeiro;type:text" json:"observacoes_financeiro"`
	TermoQuitacaoHash      string     `gorm:"column:termo_quitacao_hash;size:64" json:"termo_quitacao_hash"`
	TermoQuitacaoIp        string     `gorm:"column:termo_quitacao_ip;size:45" json:"termo_quitacao_ip"`
	TermoQuitacaoEm        *time.Time `gorm:"column:termo_quitacao_em" json:"termo_quitacao_em"`
	AprovadoEm             *time.Time `gorm:"column:aprovado_em" json:"aprovado_em"`
	PagoEm                 *time.Time `gorm:"column:pago_em" json:"pago_em"`
	CriadoEm               time.Time  `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`
	AtualizadoEm           time.Time  `gorm:"column:atualizado_em;autoUpdateTime" json:"atualizado_em"`

	Medidor Medidor                 `gorm:"foreignKey:MedidorID" json:"medidor,omitempty"`
	Itens   []FechamentoMedidorItem `gorm:"foreignKey:FechamentoID;constraint:OnDelete:CASCADE;" json:"itens,omitempty"`
}

func (FechamentoMedidor) TableName() string { return "fechamento_medidores" }
