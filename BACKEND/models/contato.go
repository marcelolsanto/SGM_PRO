package models

import (
	"time"
)

type ContatoLead struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Tipo      string    `gorm:"size:50;index" json:"tipo"` // 'empresa' ou 'medidor'
	Nome      string    `gorm:"size:255" json:"nome"`
	Empresa   string    `gorm:"size:255" json:"empresa"`
	Email     string    `gorm:"size:255" json:"email"`
	Telefone  string    `gorm:"size:50" json:"telefone"`
	Cidade    string    `gorm:"size:150" json:"cidade"`
	Mensagem  string    `gorm:"type:text" json:"mensagem"`
	Status    string    `gorm:"size:50;default:'NOVO'" json:"status"` // 'NOVO', 'EM_CONTATO', 'CONVERTIDO', 'ARQUIVADO'
	CriadoEm  time.Time `gorm:"autoCreateTime;index" json:"criado_em"`
}
