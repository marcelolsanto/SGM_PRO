package models

import "time"

// FechamentoMedidorItem vincula uma Ordem de Serviço ao Lote de Fechamento do Medidor
type FechamentoMedidorItem struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	FechamentoID      uint      `gorm:"column:fechamento_id;not null;index" json:"fechamento_id"`
	OrdemServicoID    uint      `gorm:"column:ordem_servico_id;not null;index" json:"ordem_servico_id"`
	ValorMaoDeObra    float64   `gorm:"column:valor_mao_de_obra;default:0" json:"valor_mao_de_obra"`
	ValorDeslocamento float64   `gorm:"column:valor_deslocamento;default:0" json:"valor_deslocamento"`
	ValorAdicionais   float64   `gorm:"column:valor_adicionais;default:0" json:"valor_adicionais"`
	ValorTotalItem    float64   `gorm:"column:valor_total_item;default:0" json:"valor_total_item"`
	StatusItem        string    `gorm:"column:status_item;size:30;default:'VALIDADO'" json:"status_item"` // VALIDADO, DIVERGENTE, GLOSADO
	Observacao        string    `gorm:"column:observacao;size:255" json:"observacao"`
	CriadoEm          time.Time `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`

	OrdemServico OrdemServico `gorm:"foreignKey:OrdemServicoID" json:"ordem_servico,omitempty"`
}

func (FechamentoMedidorItem) TableName() string { return "fechamento_medidor_itens" }
