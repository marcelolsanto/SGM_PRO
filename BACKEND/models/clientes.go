package models

import "time"

type Cliente struct {
	ID       uint      `gorm:"primaryKey" json:"id"`
	LojaID   uint      `gorm:"column:loja_id" json:"loja_id"`
	Nome     string    `gorm:"column:nome;size:255;not null" json:"nome"`
	CpfCnpj  string    `gorm:"column:cpf_cnpj;size:18" json:"cpf_cnpj"`
	Telefone string    `gorm:"column:telefone;size:20" json:"telefone"`
	Email    string    `gorm:"column:email;size:255" json:"email"`
	CriadoEm time.Time `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`
}

func (Cliente) TableName() string { return "clientes" }
