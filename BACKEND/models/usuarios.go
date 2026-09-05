package models

import "time"

type Usuario struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	RefID         uint       `gorm:"column:ref_id;default:0" json:"ref_id"`
	Nome          string     `gorm:"column:nome;size:255;not null" json:"nome"`
	Email         string     `gorm:"column:email;size:255;unique;not null" json:"email"`
	Senha         string     `gorm:"column:senha;not null" json:"-"`
	Perfil        string     `gorm:"column:perfil;size:20;default:'ADMIN'" json:"perfil"`
	ResetToken    string     `gorm:"column:reset_token;size:100;index" json:"-"`
	ResetTokenExp *time.Time `gorm:"column:reset_token_exp" json:"-"`
	CriadoEm      time.Time  `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`
}

func (Usuario) TableName() string { return "usuarios" }