package models

import "time"

type Loja struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	NomeFantasia string    `gorm:"column:nome_fantasia;not null" json:"nome_fantasia"`
	CNPJ         string    `gorm:"column:cnpj;unique;not null" json:"cnpj"`
	Email        string    `gorm:"column:email;unique;not null" json:"email"`
	Telefone     string    `gorm:"column:telefone;not null" json:"telefone"`
	Endereco     string    `gorm:"column:endereco;not null" json:"endereco"`
	Latitude     float64   `gorm:"column:latitude;default:0" json:"latitude"`
	Longitude    float64   `gorm:"column:longitude;default:0" json:"longitude"`
	SenhaHash    string    `gorm:"column:senha_hash" json:"-"` // O json:"-" impede que a senha volte pro React
	CriadoEm     time.Time `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`
}

func (Loja) TableName() string { return "lojas" }