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
	Endereco     string    `gorm:"column:endereco" json:"endereco"`
	EstaAtivo    bool      `gorm:"column:esta_ativo;default:true" json:"esta_ativo"`
	CriadoEm     time.Time `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`
}

func (Medidor) TableName() string { return "medidores" }