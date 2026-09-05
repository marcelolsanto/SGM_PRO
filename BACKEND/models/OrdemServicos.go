package models

import "time"

type OrdemServico struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	LojaID           uint       `gorm:"column:loja_id" json:"loja_id"`
	MedidorID        *uint      `gorm:"column:medidor_id" json:"medidor_id"`
	ClienteNome      string     `gorm:"column:cliente_nome" json:"cliente_nome"`
	EnderecoObra     string     `gorm:"column:endereco_obra" json:"endereco_obra"`
	Status           string     `gorm:"column:status;default:'PENDENTE_LOJA'" json:"status"`
	Urgencia         bool       `gorm:"column:urgencia" json:"urgencia"`
	ValorBaseM2      float64    `gorm:"column:valor_base_m2" json:"valor_base_m2"`
	TaxaDeslocamento float64    `gorm:"column:taxa_deslocamento" json:"taxa_deslocamento"`
	ValorTotalOS     float64    `gorm:"column:valor_total_os" json:"valor_total_os"`
	CustoMedidor     float64    `gorm:"column:custo_medidor" json:"custo_medidor"`
	Token            string     `gorm:"column:token" json:"token"`
	MaterialMedicao  string     `gorm:"column:material_medicao" json:"material_medicao"`
	CaminhoMedicao   string     `gorm:"column:caminho_medicao" json:"caminho_medicao"`
	TermosAceitos    bool       `gorm:"column:termos_aceitos" json:"termos_aceitos"`
	DataAceite       *time.Time `gorm:"column:data_aceite" json:"data_aceite"`
	DataConclusao    *time.Time `gorm:"column:data_conclusao" json:"data_conclusao"`
	CriadoEm         time.Time  `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`

	Loja      Loja             `gorm:"foreignKey:LojaID" json:"loja,omitempty"`
	Medidor   *Medidor         `gorm:"foreignKey:MedidorID" json:"medidor,omitempty"`
	Ambientes []Ambiente       `gorm:"foreignKey:OrdemServicoID;constraint:OnDelete:CASCADE;" json:"ambientes,omitempty"`
	Briefing  *BriefingCliente `gorm:"foreignKey:OrdemServicoID;constraint:OnDelete:CASCADE;" json:"briefing,omitempty"`
}

func (OrdemServico) TableName() string { return "ordem_servicos" }