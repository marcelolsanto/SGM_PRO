package models

import "time"

type BriefingCliente struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	OrdemServicoID uint      `gorm:"column:ordem_servico_id;uniqueIndex;not null" json:"ordem_servico_id"`
	DadosJSON      string    `gorm:"column:dados_json;type:text" json:"dados_json"`
	IPOrigem       string    `gorm:"column:ip_origem;size:50" json:"ip_origem"`
	UserAgent      string    `gorm:"column:user_agent;type:text" json:"user_agent"`
	DataHoraUTC    time.Time `gorm:"column:data_hora_utc" json:"data_hora_utc"`
}

func (BriefingCliente) TableName() string { return "briefing_clientes" }
