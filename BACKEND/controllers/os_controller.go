package controllers

import (
	"math"
	"strings"
	"time"

	"workspace/backend/config"
	"workspace/backend/models"
	"workspace/backend/services"
	"workspace/backend/utils"

	"github.com/gofiber/fiber/v2"
)

func getPerfilERefID(c *fiber.Ctx) (string, uint) {
	perfil := ""
	if p, ok := c.Locals("perfil").(string); ok {
		perfil = p
	}
	var refID uint
	if r, ok := c.Locals("ref_id").(float64); ok {
		refID = uint(r)
	} else if r, ok := c.Locals("ref_id").(uint); ok {
		refID = r
	}
	return perfil, refID
}

func getRedeID(c *fiber.Ctx) uint {
	var redeID uint
	if rd, ok := c.Locals("rede_id").(float64); ok {
		redeID = uint(rd)
	} else if rd, ok := c.Locals("rede_id").(uint); ok {
		redeID = rd
	}
	return redeID
}

type MesEstatistica struct {
	Mes                string  `json:"mes"`
	TotalOS            int64   `json:"total_os"`
	FaturamentoLojas   float64 `json:"faturamento_lojas"`
	RepasseMedidores   float64 `json:"repasse_medidores"`
	LucroSGM           float64 `json:"lucro_sgm"`
	CustoCLT           float64 `json:"custo_clt"`
	EconomiaLoja       float64 `json:"economia_loja"`
	PercentualEconomia float64 `json:"percentual_economia"`
}

type EstatisticasAnuaisResponse struct {
	Ano                string           `json:"ano"`
	TotalOS            int64            `json:"total_os"`
	FaturamentoLojas   float64          `json:"faturamento_total_lojas"`
	RepasseMedidores   float64          `json:"faturamento_medidores"`
	LucroSGM           float64          `json:"lucro_sgm"`
	CustoCLTEstimado   float64          `json:"custo_clt_estimado"`
	EconomiaGerada     float64          `json:"economia_gerada"`
	PercentualEconomia float64          `json:"percentual_economia"`
	Meses              []MesEstatistica `json:"meses"`
}

func ObterEstatisticasAnuais(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	redeID := getRedeID(c)
	ano := c.Query("ano", "2026")
	if ano == "" || ano == "TODOS" {
		ano = "2026"
	}

	tInicio, err := time.Parse("2006", ano)
	if err != nil {
		tInicio = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	}
	tFim := tInicio.AddDate(1, 0, 0)

	type QueryRow struct {
		Mes              string  `gorm:"column:mes"`
		TotalOS          int64   `gorm:"column:total_os"`
		FaturamentoLojas float64 `gorm:"column:faturamento_lojas"`
		RepasseMedidores float64 `gorm:"column:repasse_medidores"`
	}

	var rows []QueryRow
	q := config.DB.Table("ordem_servicos").
		Select("TO_CHAR(DATE_TRUNC('month', criado_em), 'YYYY-MM') AS mes, COUNT(*) AS total_os, COALESCE(SUM(valor_total_os), 0) AS faturamento_lojas, COALESCE(SUM(custo_medidor), 0) AS repasse_medidores").
		Where("criado_em >= ? AND criado_em < ?", tInicio, tFim)

	if perfil == "LOJA" {
		if redeID > 0 {
			q = q.Where("loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?)", redeID, refID)
		} else {
			q = q.Where("loja_id = ?", refID)
		}
	} else if perfil == "MEDIDOR" {
		q = q.Where("medidor_id = ?", refID)
	}

	if err := q.Group("DATE_TRUNC('month', criado_em)").Order("mes ASC").Scan(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao calcular estatísticas anuais", "detalhes": err.Error()})
	}

	var meses []MesEstatistica
	var totalOS int64
	var faturamentoTotal, repasseTotal float64

	for _, r := range rows {
		lucro := r.FaturamentoLojas - r.RepasseMedidores
		custoCLT := float64(r.TotalOS) * 580.0
		economia := custoCLT - r.FaturamentoLojas
		if economia < 0 {
			economia = 0
		}
		pctEconomia := 0.0
		if custoCLT > 0 {
			pctEconomia = math.Round((economia/custoCLT)*1000) / 10
		}

		meses = append(meses, MesEstatistica{
			Mes:                r.Mes,
			TotalOS:            r.TotalOS,
			FaturamentoLojas:   math.Round(r.FaturamentoLojas*100) / 100,
			RepasseMedidores:   math.Round(r.RepasseMedidores*100) / 100,
			LucroSGM:           math.Round(lucro*100) / 100,
			CustoCLT:           math.Round(custoCLT*100) / 100,
			EconomiaLoja:       math.Round(economia*100) / 100,
			PercentualEconomia: pctEconomia,
		})

		totalOS += r.TotalOS
		faturamentoTotal += r.FaturamentoLojas
		repasseTotal += r.RepasseMedidores
	}

	lucroTotal := faturamentoTotal - repasseTotal
	custoCLTTotal := float64(totalOS) * 580.0
	economiaTotal := custoCLTTotal - faturamentoTotal
	if economiaTotal < 0 {
		economiaTotal = 0
	}
	pctTotal := 0.0
	if custoCLTTotal > 0 {
		pctTotal = math.Round((economiaTotal/custoCLTTotal)*1000) / 10
	}

	resp := EstatisticasAnuaisResponse{
		Ano:                ano,
		TotalOS:            totalOS,
		FaturamentoLojas:   math.Round(faturamentoTotal*100) / 100,
		RepasseMedidores:   math.Round(repasseTotal*100) / 100,
		LucroSGM:           math.Round(lucroTotal*100) / 100,
		CustoCLTEstimado:   math.Round(custoCLTTotal*100) / 100,
		EconomiaGerada:     math.Round(economiaTotal*100) / 100,
		PercentualEconomia: pctTotal,
		Meses:              meses,
	}

	return c.Status(200).JSON(resp)
}

func ListarOrdens(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	redeID := getRedeID(c)
	ano := c.Query("ano")
	mes := c.Query("mes")
	statusFiltro := c.Query("status")
	lojaFiltro := c.Query("loja_id")
	redeFiltro := c.Query("rede_id")
	limit := c.QueryInt("limit", 0)

	var ordens []models.OrdemServico
	query := config.DB.Preload("Loja").
		Preload("Medidor").
		Preload("Ambientes").
		Preload("Briefing")

	if ano != "" && ano != "TODOS" && mes != "" && mes != "TODOS" {
		mesPad := mes
		if len(mes) == 2 {
			mesPad = ano + "-" + mes
		}
		if tInicio, err := time.Parse("2006-01", mesPad); err == nil {
			tFim := tInicio.AddDate(0, 1, 0)
			query = query.Where("criado_em >= ? AND criado_em < ?", tInicio, tFim)
		}
	} else if ano != "" && ano != "TODOS" {
		if tInicio, err := time.Parse("2006", ano); err == nil {
			tFim := tInicio.AddDate(1, 0, 0)
			query = query.Where("criado_em >= ? AND criado_em < ?", tInicio, tFim)
		}
	} else if mes != "" && mes != "TODOS" {
		if tInicio, err := time.Parse("2006-01", mes); err == nil {
			tFim := tInicio.AddDate(0, 1, 0)
			query = query.Where("criado_em >= ? AND criado_em < ?", tInicio, tFim)
		} else {
			query = query.Where("TO_CHAR(criado_em, 'MM') = ? OR TO_CHAR(criado_em, 'YYYY-MM') = ?", mes, mes)
		}
	}
	if statusFiltro != "" && statusFiltro != "TODOS" {
		query = query.Where("status = ?", statusFiltro)
	}

	if perfil == "LOJA" {
		q := query.Order("criado_em DESC")
		if redeID > 0 {
			// Gestor de Rede com múltiplas lojas (12-16 filiais)
			if lojaFiltro != "" && lojaFiltro != "TODAS" && lojaFiltro != "TODOS" {
				q = q.Where("loja_id = ?", lojaFiltro)
			} else {
				// Todas as lojas da rede
				q = q.Where("loja_id IN (SELECT id FROM lojas WHERE rede_id = ? OR id = ?)", redeID, refID)
			}
		} else {
			// Loja individual
			q = q.Where("loja_id = ?", refID)
		}

		if limit > 0 {
			q = q.Limit(limit)
		} else {
			q = q.Limit(250)
		}
		q.Find(&ordens)
		return c.Status(200).JSON(ordens)
	} else if perfil == "MEDIDOR" {
		q := query.Where("medidor_id = ? OR (medidor_id IS NULL AND status = 'PENDENTE_LOJA')", refID).
			Order("criado_em DESC")
		if limit > 0 {
			q = q.Limit(limit)
		} else {
			q = q.Limit(250)
		}
		q.Find(&ordens)

		var osLiberadas []models.OrdemServico
		for _, os := range ordens {
			if os.MedidorID != nil {
				osLiberadas = append(osLiberadas, os)
				continue
			}
			// Regras de liberação para o radar público dos medidores
			if !os.TermosAceitos {
				continue
			}
			temPlanta := false
			for _, amb := range os.Ambientes {
				if amb.CaminhoPlantaPdf != "" {
					temPlanta = true
					break
				}
			}
			if temPlanta {
				osLiberadas = append(osLiberadas, os)
			}
		}
		return c.Status(200).JSON(osLiberadas)
	}

	// ADMIN vê tudo, mas pode filtrar por loja ou rede
	qAdmin := query.Order("criado_em DESC")
	if lojaFiltro != "" && lojaFiltro != "TODAS" && lojaFiltro != "TODOS" {
		qAdmin = qAdmin.Where("loja_id = ?", lojaFiltro)
	} else if redeFiltro != "" && redeFiltro != "TODAS" && redeFiltro != "TODOS" {
		qAdmin = qAdmin.Where("loja_id IN (SELECT id FROM lojas WHERE rede_id = ?)", redeFiltro)
	}

	if limit > 0 {
		qAdmin = qAdmin.Limit(limit)
	} else {
		qAdmin = qAdmin.Limit(250)
	}
	qAdmin.Find(&ordens)
	return c.Status(200).JSON(ordens)
}

// ObterPrecoBaseAmbiente retorna o preco avulso unitario do ambiente conforme a complexidade tecnica:
// 1. Cozinha / Churrasqueira (2.0x): R$ 62,50
// 2. Escadaria (2.0x): R$ 62,50
// 3. Area de Servico (1.8x): R$ 56,25
// 4. Banheiro (1.6x): R$ 50,00
// 5. Sala (1.4x): R$ 43,75
// 6. Dormitorio / Quarto (1.2x): R$ 37,50
// 7. Varanda / Sacada (1.0x): R$ 31,25
// 8. Outros Ambientes (1.0x): R$ 31,25
// Soma dos 5 comodos padrao = R$ 250,00 (que com 20% de combo trava no teto de R$ 200,00).
func ObterPrecoBaseAmbiente(amb models.Ambiente) float64 {
	nome := strings.ToLower(amb.Nome)
	tipo := strings.ToLower(amb.TipoAmbiente)
	combinado := nome + " " + tipo

	// 1. Cozinha / Churrasqueira / Area Gourmet (Complexidade Alta 2.0x: R$ 62,50)
	if strings.Contains(combinado, "cozinha") || strings.Contains(combinado, "churrasqueira") || strings.Contains(combinado, "gourmet") {
		return 62.50
	}
	// 2. Escadaria (Complexidade Alta 2.0x: R$ 62,50)
	if strings.Contains(combinado, "escada") || strings.Contains(combinado, "escadaria") {
		return 62.50
	}
	// 3. Area de Servico / Lavanderia (Complexidade 1.8x: R$ 56,25)
	if strings.Contains(combinado, "serviço") || strings.Contains(combinado, "servico") || strings.Contains(combinado, "lavanderia") || strings.Contains(combinado, "tanque") {
		return 56.25
	}
	// 4. Banheiro / Lavabo (Complexidade Media/Alta 1.6x: R$ 50,00)
	if strings.Contains(combinado, "banheiro") || strings.Contains(combinado, "lavabo") || strings.Contains(combinado, "w.c") || strings.Contains(combinado, "wc") {
		return 50.00
	}
	// 5. Sala (Complexidade Media 1.4x: R$ 43,75)
	if strings.Contains(combinado, "sala") || strings.Contains(combinado, "estar") || strings.Contains(combinado, "jantar") || strings.Contains(combinado, "living") {
		return 43.75
	}
	// 6. Dormitorio / Quarto / Suite (Complexidade Media 1.2x: R$ 37,50)
	if strings.Contains(combinado, "quarto") || strings.Contains(combinado, "dormitório") || strings.Contains(combinado, "dormitorio") || strings.Contains(combinado, "suíte") || strings.Contains(combinado, "suite") {
		return 37.50
	}
	// 7. Varanda / Sacada (Complexidade Basica 1.0x: R$ 31,25)
	if strings.Contains(combinado, "varanda") || strings.Contains(combinado, "sacada") || strings.Contains(combinado, "terraço") || strings.Contains(combinado, "terraco") {
		return 31.25
	}
	// 8. Outros Ambientes (Escritorio, Closet, Hall, etc. - Complexidade Basica 1.0x: R$ 31,25)
	return 31.25
}

// CalcularFinanceiroOS calcula o valor total da medicao, aplicando desconto progressivo de combo de ambientes
// com teto travado em R$ 200,00 para apartamento completo de 5 comodos e split de 80% medidor / 20% plataforma.
func CalcularFinanceiroOS(ambientes []models.Ambiente, urgencia bool, kmTotal float64) (valorTotalOS, custoMedidor, maoDeObraMedidor, adicionalUrgencia, taxaDeslocamento float64) {
	numAmbientes := len(ambientes)
	if numAmbientes == 0 {
		return 0, 0, 0, 0, 0
	}

	// 1. Soma dos precos individuais avulsos
	somaAvulsa := 0.0
	for _, amb := range ambientes {
		somaAvulsa += ObterPrecoBaseAmbiente(amb)
	}

	// 2. Aplicacao de desconto progressivo por quantidade de ambientes
	var valorMedicaoComDesconto float64

	switch {
	case numAmbientes == 1:
		valorMedicaoComDesconto = somaAvulsa // 0% desconto
	case numAmbientes == 2:
		valorMedicaoComDesconto = somaAvulsa * 0.95 // 5% desconto
	case numAmbientes == 3:
		valorMedicaoComDesconto = somaAvulsa * 0.90 // 10% desconto
	case numAmbientes == 4:
		valorMedicaoComDesconto = somaAvulsa * 0.85 // 15% desconto
	case numAmbientes == 5:
		// Combo Apartamento Completo: 20% desc com teto travado em R$ 200,00
		valorMedicaoComDesconto = somaAvulsa * 0.80
		if valorMedicaoComDesconto > 200.00 {
			valorMedicaoComDesconto = 200.00
		}
	default: // numAmbientes > 5
		// Combo com 20% de desconto proporcional para toda a residencia
		valorMedicaoComDesconto = somaAvulsa * 0.80
	}

	// Arredondamento para 2 casas decimais
	valorMedicaoComDesconto = math.Round(valorMedicaoComDesconto*100) / 100

	// 3. Taxa de deslocamento (franquia urbana de 15 km inclusa no pacote)
	if kmTotal > 15.0 {
		taxaDeslocamento = math.Round((kmTotal-15.0)*1.50*100) / 100
	} else {
		taxaDeslocamento = 0.0
	}

	// 4. Mão de Obra do Medidor (80% da medição)
	maoDeObraMedidor = math.Round((valorMedicaoComDesconto*0.80)*100) / 100

	// 5. Adicional de Urgência (+50% se urgente)
	if urgencia {
		adicionalUrgencia = math.Round((valorMedicaoComDesconto*0.50)*100) / 100
		taxaDeslocamento *= 1.50
	} else {
		adicionalUrgencia = 0.0
	}

	// 6. Custo Medidor (Repasse ao técnico: 80% da mão de obra + urgência integral + deslocamento)
	custoMedidor = maoDeObraMedidor + (adicionalUrgencia * 0.80) + taxaDeslocamento

	// 7. Valor Total da OS cobrado da Loja
	valorTotalOS = valorMedicaoComDesconto + adicionalUrgencia + taxaDeslocamento

	return valorTotalOS, custoMedidor, maoDeObraMedidor, adicionalUrgencia, taxaDeslocamento
}

func CriarOrdem(c *fiber.Ctx) error {
	osData := new(models.OrdemServico)
	if err := c.BodyParser(osData); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados corrompidos"})
	}

	var loja models.Loja
	config.DB.First(&loja, osData.LojaID)
	if osData.RedeID == nil && loja.RedeID != nil {
		osData.RedeID = loja.RedeID
	}
	endOrigem := loja.Endereco
	if endOrigem == "" {
		endOrigem = "Praça da Sé, São Paulo, SP"
	}

	if osData.MedidorID != nil {
		var m models.Medidor
		if err := config.DB.First(&m, *osData.MedidorID).Error; err == nil {
			if m.Endereco != "" {
				endOrigem = m.Endereco
			}
		}
	}

	_, kmTotal, minTotal := utils.CalcularDeslocamentoDinamico(endOrigem, osData.EnderecoObra)
	osData.KmDeslocamento = kmTotal
	osData.TempoDeslocamentoMin = minTotal
	osData.OrigemDeslocamento = endOrigem

	latObra, lonObra, _ := utils.GeocodificarEndereco(osData.EnderecoObra)
	osData.LatitudeObra = latObra
	osData.LongitudeObra = lonObra

	// Aplica o novo modelo financeiro de precificação por ambientes e combo de R$ 200
	valTotal, custoMed, maoDeObra, urgAdic, taxaDesloc := CalcularFinanceiroOS(osData.Ambientes, osData.Urgencia, kmTotal)
	osData.ValorTotalOS = valTotal
	osData.CustoMedidor = custoMed
	osData.MaoDeObraMedidor = maoDeObra
	osData.AdicionalUrgencia = urgAdic
	osData.TaxaDeslocamento = taxaDesloc
	if len(osData.Ambientes) > 0 {
		osData.ValorBaseM2 = valTotal / float64(len(osData.Ambientes))
	} else {
		osData.ValorBaseM2 = 40.00
	}

	osData.Token = utils.GerarTokenUnico()
	osData.Status = "PENDENTE_LOJA"

	if err := config.DB.Create(&osData).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Falha ao gravar no banco"})
	}

	return c.Status(201).JSON(osData)
}

func ObterOrdem(c *fiber.Ctx) error {
	id := c.Params("id")
	var o models.OrdemServico
	if err := config.DB.Preload("Loja").
		Preload("Medidor").
		Preload("Ambientes").
		Preload("Briefing").
		First(&o, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}
	return c.JSON(o)
}

func AtualizarOrdem(c *fiber.Ctx) error {
	var osAtualizada models.OrdemServico
	if err := c.BodyParser(&osAtualizada); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	var osAntiga models.OrdemServico
	if err := config.DB.Preload("Ambientes").First(&osAntiga, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	var loja models.Loja
	config.DB.First(&loja, osAtualizada.LojaID)
	endOrigem := loja.Endereco
	if endOrigem == "" {
		endOrigem = "Praça da Sé, São Paulo, SP"
	}

	if osAntiga.MedidorID != nil {
		var m models.Medidor
		if err := config.DB.First(&m, *osAntiga.MedidorID).Error; err == nil {
			if m.Endereco != "" {
				endOrigem = m.Endereco
			}
		}
	}

	_, kmTotal, minTotal := utils.CalcularDeslocamentoDinamico(endOrigem, osAtualizada.EnderecoObra)
	osAtualizada.KmDeslocamento = kmTotal
	osAtualizada.TempoDeslocamentoMin = minTotal
	osAtualizada.OrigemDeslocamento = endOrigem

	latObra, lonObra, _ := utils.GeocodificarEndereco(osAtualizada.EnderecoObra)
	osAtualizada.LatitudeObra = latObra
	osAtualizada.LongitudeObra = lonObra

	// Aplica o novo modelo financeiro de precificação por ambientes e combo de R$ 200
	valTotal, custoMed, maoDeObra, urgAdic, taxaDesloc := CalcularFinanceiroOS(osAtualizada.Ambientes, osAtualizada.Urgencia, kmTotal)
	osAtualizada.ValorTotalOS = valTotal
	osAtualizada.CustoMedidor = custoMed
	osAtualizada.MaoDeObraMedidor = maoDeObra
	osAtualizada.AdicionalUrgencia = urgAdic
	osAtualizada.TaxaDeslocamento = taxaDesloc
	if len(osAtualizada.Ambientes) > 0 {
		osAtualizada.ValorBaseM2 = valTotal / float64(len(osAtualizada.Ambientes))
	} else {
		osAtualizada.ValorBaseM2 = 40.00
	}

	// Mantém propriedades vitais imutáveis
	osAtualizada.ID = osAntiga.ID
	osAtualizada.Status = osAntiga.Status
	osAtualizada.Token = osAntiga.Token
	osAtualizada.TermosAceitos = osAntiga.TermosAceitos
	osAtualizada.MedidorID = osAntiga.MedidorID
	osAtualizada.CriadoEm = osAntiga.CriadoEm

	// Deleta os ambientes antigos e recria
	config.DB.Where("ordem_servico_id = ?", c.Params("id")).Delete(&models.Ambiente{})
	if err := config.DB.Save(&osAtualizada).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Falha ao salvar no banco"})
	}

	return c.Status(200).JSON(osAtualizada)
}

func AtualizarStatus(c *fiber.Ctx) error {
	type Payload struct {
		MedidorID *uint  `json:"medidor_id"`
		Status    string `json:"status"`
	}
	var p Payload
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	var os models.OrdemServico
	if err := config.DB.Preload("Ambientes").Preload("Loja").First(&os, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	if p.MedidorID == nil || *p.MedidorID == 0 {
		os.MedidorID = nil
	} else {
		os.MedidorID = p.MedidorID
		var m models.Medidor
		config.DB.First(&m, *p.MedidorID)
		taxa := m.TaxaPorM2
		if taxa <= 0 {
			taxa = 3.50
		}
		custoBruto := 0.0
		for _, amb := range os.Ambientes {
			comp := amb.Complexidade
			if comp < 1.0 {
				comp = 1.0
			}
			custoBruto += amb.AreaEstimadaM2 * taxa * comp
		}
		os.MaoDeObraMedidor = custoBruto
		if os.Urgencia {
			os.AdicionalUrgencia = custoBruto * 0.50
		} else {
			os.AdicionalUrgencia = 0.0
		}
		os.CustoMedidor = os.MaoDeObraMedidor + os.AdicionalUrgencia + os.TaxaDeslocamento
	}

	os.Status = p.Status
	if (os.Status == "CONCLUIDO" || os.Status == "CONCLUIDA") && os.DataConclusao == nil {
		now := time.Now()
		os.DataConclusao = &now
	}
	config.DB.Save(&os)

	if os.Status == "CONCLUIDO" || os.Status == "CONCLUIDA" {
		services.ProvisionarFinanceiroOS(&os)
	}

	return c.Status(200).JSON(os)
}

func PegarDemanda(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	if perfil != "MEDIDOR" {
		return c.Status(403).JSON(fiber.Map{"erro": "Apenas medidores podem pegar demandas"})
	}

	var os models.OrdemServico
	if err := config.DB.Preload("Ambientes").First(&os, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	// 1. A demanda DEVE estar paga para poder ser aceita
	if os.StatusPagamento != "PAGO" {
		return c.Status(400).JSON(fiber.Map{"erro": "A medição ainda não foi paga pela loja. O aceite só é liberado após a confirmação do pagamento PIX."})
	}

	// 2. O cliente DEVE ter concluído o agendamento de data e horário
	if os.DataAgendada == "" || os.HoraAgendada == "" || !os.TermosAceitos {
		return c.Status(400).JSON(fiber.Map{"erro": "O cliente ainda não confirmou o agendamento de data e horário no Magic Link. Aguarde o agendamento."})
	}

	os.MedidorID = &refID
	os.Status = "EM_ROTA"
	now := time.Now()
	os.DataAceite = &now

	var m models.Medidor
	if err := config.DB.First(&m, refID).Error; err == nil {
		taxa := m.TaxaPorM2
		if taxa <= 0 {
			taxa = 3.50
		}
		custoBruto := 0.0
		for _, amb := range os.Ambientes {
			comp := amb.Complexidade
			if comp < 1.0 {
				comp = 1.0
			}
			custoBruto += amb.AreaEstimadaM2 * taxa * comp
		}
		if m.Endereco != "" {
			taxaDesloc, kmTotal, minTotal := utils.CalcularDeslocamentoDinamico(m.Endereco, os.EnderecoObra)
			os.TaxaDeslocamento = taxaDesloc
			os.KmDeslocamento = kmTotal
			os.TempoDeslocamentoMin = minTotal
			os.OrigemDeslocamento = m.Endereco
			if os.Urgencia {
				os.TaxaDeslocamento *= 2
			}
		}
		os.CustoMedidor = os.MaoDeObraMedidor + os.AdicionalUrgencia + os.TaxaDeslocamento
		os.ValorTotalOS = os.CustoMedidor / 0.80
	}

	config.DB.Save(&os)

	return c.Status(200).JSON(os)
}

func RecusarDemanda(c *fiber.Ctx) error {
	perfil, _ := getPerfilERefID(c)
	if perfil != "MEDIDOR" {
		return c.Status(403).JSON(fiber.Map{"erro": "Apenas medidores podem recusar demandas"})
	}

	var os models.OrdemServico
	if err := config.DB.First(&os, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	// Devolve a OS para o radar / marketplace aberto
	os.MedidorID = nil
	os.Status = "PENDENTE_LOJA"
	config.DB.Save(&os)

	return c.Status(200).JSON(fiber.Map{"mensagem": "Demanda recusada e devolvida ao Radar com sucesso!"})
}

func MarcarChegada(c *fiber.Ctx) error {
	var os models.OrdemServico
	if err := config.DB.First(&os, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	os.Status = "NO_LOCAL"
	config.DB.Save(&os)
	return c.Status(200).JSON(os)
}

type EntregaDocumentosPayload struct {
	CaminhoMedicao   string `json:"caminho_medicao"`
	MaterialMedicao  string `json:"material_medicao"`
	FotosMedicao     string `json:"fotos_medicao"`
	ArquivoPromob    string `json:"arquivo_promob"`
	DesenhoCroqui    string `json:"desenho_croqui"`
	DocumentosExtras string `json:"documentos_extras"`
}

func EntregarMedicao(c *fiber.Ctx) error {
	var os models.OrdemServico
	if err := config.DB.First(&os, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	var payload EntregaDocumentosPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados de entrega inválidos"})
	}

	if payload.CaminhoMedicao != "" {
		os.CaminhoMedicao = payload.CaminhoMedicao
	}
	if payload.MaterialMedicao != "" {
		os.MaterialMedicao = payload.MaterialMedicao
	}
	if payload.FotosMedicao != "" {
		os.FotosMedicao = payload.FotosMedicao
	}
	if payload.ArquivoPromob != "" {
		os.ArquivoPromob = payload.ArquivoPromob
	}
	if payload.DesenhoCroqui != "" {
		os.DesenhoCroqui = payload.DesenhoCroqui
	}
	if payload.DocumentosExtras != "" {
		os.DocumentosExtras = payload.DocumentosExtras
	}

	os.Status = "CONCLUIDO"
	if os.DataConclusao == nil {
		now := time.Now()
		os.DataConclusao = &now
	}
	config.DB.Save(&os)

	// Provisão contábil e de repasse automática no Livro Caixa
	services.ProvisionarFinanceiroOS(&os)

	return c.Status(200).JSON(os)
}

func AtualizarDocumentosMedicao(c *fiber.Ctx) error {
	var os models.OrdemServico
	if err := config.DB.First(&os, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	var payload EntregaDocumentosPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	updates := map[string]interface{}{}
	if payload.CaminhoMedicao != "" {
		updates["caminho_medicao"] = payload.CaminhoMedicao
	}
	if payload.MaterialMedicao != "" {
		updates["material_medicao"] = payload.MaterialMedicao
	}
	if payload.FotosMedicao != "" {
		updates["fotos_medicao"] = payload.FotosMedicao
	}
	if payload.ArquivoPromob != "" {
		updates["arquivo_promob"] = payload.ArquivoPromob
	}
	if payload.DesenhoCroqui != "" {
		updates["desenho_croqui"] = payload.DesenhoCroqui
	}
	if payload.DocumentosExtras != "" {
		updates["documentos_extras"] = payload.DocumentosExtras
	}

	if len(updates) > 0 {
		config.DB.Model(&os).Updates(updates)
	}
	return c.Status(200).JSON(fiber.Map{
		"mensagem": "Documentos de medição atualizados com sucesso!",
		"os":       os,
	})
}

func DeletarOrdem(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := config.DB.Delete(&models.OrdemServico{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao deletar ordem"})
	}
	return c.JSON(fiber.Map{"mensagem": "Ordem deletada com sucesso"})
}