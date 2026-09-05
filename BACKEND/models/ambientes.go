package models

type Ambiente struct {
	ID               uint    `gorm:"primaryKey" json:"id"`
	OrdemServicoID   uint    `gorm:"column:ordem_servico_id" json:"ordem_servico_id"`
	Nome             string  `gorm:"column:nome" json:"nome"`
	TipoAmbiente     string  `gorm:"column:tipo_ambiente" json:"tipo_ambiente"`
	AreaEstimadaM2   float64 `gorm:"column:area_estimada_m2" json:"area_estimada_m2"`
	Complexidade     float64 `gorm:"column:complexidade;default:1.0" json:"complexidade"`
	CaminhoPlantaPdf string  `gorm:"column:caminho_planta_pdf" json:"caminho_planta_pdf"`
	Observacoes      string  `gorm:"column:observacoes" json:"observacoes"`
}

func (Ambiente) TableName() string { return "ambientes" }