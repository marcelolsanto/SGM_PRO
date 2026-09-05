package models

import "time"

type Medidor struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	NomeCompleto string    `gorm:"column:nome_completo" json:"nome_completo"`
	Cpf          string    `gorm:"column:cpf" json:"cpf"`
	Telefone     string    `gorm:"column:telefone" json:"telefone"`
	TaxaPorM2    float64   `gorm:"column:taxa_por_m2" json:"taxa_por_m2"`
	ChavePix     string    `gorm:"column:chave_pix" json:"chave_pix"`
	TipoChavePix string    `gorm:"column:tipo_chave_pix;default:'CPF'" json:"tipo_chave_pix"`
	Endereco          string     `gorm:"column:endereco" json:"endereco"`
	Latitude          float64    `gorm:"column:latitude;default:0" json:"latitude"`
	Longitude         float64    `gorm:"column:longitude;default:0" json:"longitude"`
	UltimaLocalizacao *time.Time `gorm:"column:ultima_localizacao" json:"ultima_localizacao"`
	DiasDisponiveis   string     `gorm:"column:dias_disponiveis;default:'[\"Seg\",\"Ter\",\"Qua\",\"Qui\",\"Sex\",\"Sab\"]'" json:"dias_disponiveis"`
	HorasDisponiveis  string     `gorm:"column:horas_disponiveis;default:'[\"08:00\",\"09:00\",\"10:00\",\"11:00\",\"13:00\",\"14:00\",\"15:00\",\"16:00\",\"17:00\"]'" json:"horas_disponiveis"`
	EstaAtivo         bool       `gorm:"column:esta_ativo;default:true" json:"esta_ativo"`
	CriadoEm          time.Time  `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`
}

func (Medidor) TableName() string { return "medidores" }