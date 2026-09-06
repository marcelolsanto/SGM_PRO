package models

import "time"

// LancamentoFinanceiro registra o Livro Caixa / Fluxo de Caixa / DRE da empresa
type LancamentoFinanceiro struct {
	ID                  uint       `gorm:"primaryKey" json:"id"`
	Tipo                string     `gorm:"column:tipo;size:20;not null" json:"tipo"` // ENTRADA, SAIDA
	Categoria           string     `gorm:"column:categoria;size:50;not null" json:"categoria"` // REPASSE_MEDIDOR, RECEBIMENTO_LOJA, TAXA_SGM, DESPESA_OPERACIONAL, IMPOSTO
	Valor               float64    `gorm:"column:valor;not null" json:"valor"`
	DataCompetencia     time.Time  `gorm:"column:data_competencia;not null" json:"data_competencia"`
	DataVencimento      time.Time  `gorm:"column:data_vencimento;not null" json:"data_vencimento"`
	DataLiquidacao      *time.Time `gorm:"column:data_liquidacao" json:"data_liquidacao"`
	Status              string     `gorm:"column:status;size:20;default:'REALIZADO'" json:"status"` // PREVISTO, REALIZADO, CANCELADO
	FormaPagamento      string     `gorm:"column:forma_pagamento;size:30;default:'PIX'" json:"forma_pagamento"` // PIX, BOLETO, TED, CARTAO
	FechamentoMedidorID *uint      `gorm:"column:fechamento_medidor_id;index" json:"fechamento_medidor_id"`
	OrdemServicoID      *uint      `gorm:"column:ordem_servico_id;index" json:"ordem_servico_id"`
	LojaID              *uint      `gorm:"column:loja_id;index" json:"loja_id"`
	Descricao           string     `gorm:"column:descricao;size:255;not null" json:"descricao"`
	ComprovanteUrl      string     `gorm:"column:comprovante_url" json:"comprovante_url"`
	CriadoEm            time.Time  `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`
	AtualizadoEm        time.Time  `gorm:"column:atualizado_em;autoUpdateTime" json:"atualizado_em"`

	FechamentoMedidor *FechamentoMedidor `gorm:"foreignKey:FechamentoMedidorID" json:"fechamento_medidor,omitempty"`
	OrdemServico      *OrdemServico      `gorm:"foreignKey:OrdemServicoID" json:"ordem_servico,omitempty"`
	Loja              *Loja              `gorm:"foreignKey:LojaID" json:"loja,omitempty"`
}

func (LancamentoFinanceiro) TableName() string { return "lancamentos_financeiros" }
