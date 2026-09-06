package models

import "time"

type OrdemServico struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	LojaID           uint       `gorm:"column:loja_id" json:"loja_id"`
	RedeID           *uint      `gorm:"column:rede_id;index" json:"rede_id"`
	MedidorID        *uint      `gorm:"column:medidor_id" json:"medidor_id"`
	ClienteNome      string     `gorm:"column:cliente_nome" json:"cliente_nome"`
	EnderecoObra          string     `gorm:"column:endereco_obra" json:"endereco_obra"`
	LatitudeObra          float64    `gorm:"column:latitude_obra;default:0" json:"latitude_obra"`
	LongitudeObra         float64    `gorm:"column:longitude_obra;default:0" json:"longitude_obra"`
	Status                string     `gorm:"column:status;default:'PENDENTE_LOJA'" json:"status"`
	Urgencia         bool       `gorm:"column:urgencia" json:"urgencia"`
	ValorBaseM2      float64    `gorm:"column:valor_base_m2" json:"valor_base_m2"`
	TaxaDeslocamento      float64    `gorm:"column:taxa_deslocamento" json:"taxa_deslocamento"`
	KmDeslocamento        float64    `gorm:"column:km_deslocamento;default:0" json:"km_deslocamento"`
	TempoDeslocamentoMin  int        `gorm:"column:tempo_deslocamento_min;default:0" json:"tempo_deslocamento_min"`
	OrigemDeslocamento    string     `gorm:"column:origem_deslocamento" json:"origem_deslocamento"`
	MaoDeObraMedidor      float64    `gorm:"column:mao_de_obra_medidor;default:0" json:"mao_de_obra_medidor"`
	AdicionalUrgencia float64   `gorm:"column:adicional_urgencia;default:0" json:"adicional_urgencia"`
	ValorTotalOS     float64    `gorm:"column:valor_total_os" json:"valor_total_os"`
	CustoMedidor     float64    `gorm:"column:custo_medidor" json:"custo_medidor"`
	Token            string     `gorm:"column:token" json:"token"`
	MaterialMedicao  string     `gorm:"column:material_medicao" json:"material_medicao"`
	CaminhoMedicao   string     `gorm:"column:caminho_medicao" json:"caminho_medicao"`
	FotosMedicao     string     `gorm:"column:fotos_medicao;type:text" json:"fotos_medicao"`
	ArquivoPromob    string     `gorm:"column:arquivo_promob" json:"arquivo_promob"`
	DesenhoCroqui    string     `gorm:"column:desenho_croqui" json:"desenho_croqui"`
	DocumentosExtras string     `gorm:"column:documentos_extras;type:text" json:"documentos_extras"`
	TermosAceitos    bool       `gorm:"column:termos_aceitos" json:"termos_aceitos"`
	StatusPagamento  string     `gorm:"column:status_pagamento;default:'PENDENTE'" json:"status_pagamento"`
	PixCopiaECola    string     `gorm:"column:pix_copia_e_cola;type:text" json:"pix_copia_e_cola"`
	DataPagamento    *time.Time `gorm:"column:data_pagamento" json:"data_pagamento"`
	DataAgendada     string     `gorm:"column:data_agendada" json:"data_agendada"`
	HoraAgendada     string     `gorm:"column:hora_agendada" json:"hora_agendada"`
	OrdemRota        int        `gorm:"column:ordem_rota;default:0" json:"ordem_rota"`
	TempoEstimadoMin int        `gorm:"column:tempo_estimado_min;default:60" json:"tempo_estimado_min"`
	DataAceite       *time.Time `gorm:"column:data_aceite" json:"data_aceite"`
	DataConclusao    *time.Time `gorm:"column:data_conclusao" json:"data_conclusao"`
	CriadoEm         time.Time  `gorm:"column:criado_em;autoCreateTime" json:"criado_em"`

	Loja      Loja             `gorm:"foreignKey:LojaID" json:"loja,omitempty"`
	Medidor   *Medidor         `gorm:"foreignKey:MedidorID" json:"medidor,omitempty"`
	Ambientes []Ambiente       `gorm:"foreignKey:OrdemServicoID;constraint:OnDelete:CASCADE;" json:"ambientes,omitempty"`
	Briefing  *BriefingCliente `gorm:"foreignKey:OrdemServicoID;constraint:OnDelete:CASCADE;" json:"briefing,omitempty"`
}

func (OrdemServico) TableName() string { return "ordem_servicos" }