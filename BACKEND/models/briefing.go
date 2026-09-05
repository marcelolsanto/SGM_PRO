package models

type BriefingCliente struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	OrdemServicoID uint   `gorm:"column:ordem_servico_id;uniqueIndex;not null" json:"ordem_servico_id"`
	DadosJSON      string `gorm:"column:dados_json;type:text" json:"dados_json"`
}

func (BriefingCliente) TableName() string { return "briefing_clientes" }
