package controllers

import (
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

func ListarOrdens(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	redeID := getRedeID(c)
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

	if mes != "" && mes != "TODOS" {
		if tInicio, err := time.Parse("2006-01", mes); err == nil {
			tFim := tInicio.AddDate(0, 1, 0)
			query = query.Where("criado_em >= ? AND criado_em < ?", tInicio, tFim)
		} else {
			query = query.Where("TO_CHAR(criado_em, 'YYYY-MM') = ?", mes)
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
	} else if mes == "" {
		qAdmin = qAdmin.Limit(250)
	}
	qAdmin.Find(&ordens)
	return c.Status(200).JSON(ordens)
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

	taxaMedidor := 3.50
	if osData.MedidorID != nil {
		var m models.Medidor
		if err := config.DB.First(&m, *osData.MedidorID).Error; err == nil {
			if m.TaxaPorM2 > 0 {
				taxaMedidor = m.TaxaPorM2
			}
			if m.Endereco != "" {
				endOrigem = m.Endereco
			}
		}
	}

	taxaDesloc, kmTotal, minTotal := utils.CalcularDeslocamentoDinamico(endOrigem, osData.EnderecoObra)
	osData.TaxaDeslocamento = taxaDesloc
	osData.KmDeslocamento = kmTotal
	osData.TempoDeslocamentoMin = minTotal
	osData.OrigemDeslocamento = endOrigem

	latObra, lonObra, _ := utils.GeocodificarEndereco(osData.EnderecoObra)
	osData.LatitudeObra = latObra
	osData.LongitudeObra = lonObra

	if osData.Urgencia {
		osData.TaxaDeslocamento *= 2
	}

	osData.ValorBaseM2 = 5.72
	custoMedicaoBruto := 0.0
	custoMedidorBruto := 0.0

	for i := range osData.Ambientes {
		if osData.Ambientes[i].Complexidade < 1.0 {
			osData.Ambientes[i].Complexidade = 1.0
		}
		area := osData.Ambientes[i].AreaEstimadaM2
		comp := osData.Ambientes[i].Complexidade
		custoMedicaoBruto += area * osData.ValorBaseM2 * comp
		custoMedidorBruto += area * taxaMedidor * comp
	}

	// 1. Mão de Obra do Medidor e Adicional de Urgência (+50%)
	osData.MaoDeObraMedidor = custoMedidorBruto
	if osData.Urgencia {
		osData.AdicionalUrgencia = custoMedidorBruto * 0.50
	} else {
		osData.AdicionalUrgencia = 0.0
	}
	osData.CustoMedidor = osData.MaoDeObraMedidor + osData.AdicionalUrgencia + osData.TaxaDeslocamento

	// 2. Margem da Plataforma SGM fixada em 20% do GMV total (Repasse Medidor = 80%)
	osData.ValorTotalOS = osData.CustoMedidor / 0.80
	if taxaMedidor > 0 {
		osData.ValorBaseM2 = taxaMedidor / 0.80
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

	taxaMedidor := 3.50
	if osAntiga.MedidorID != nil {
		var m models.Medidor
		if err := config.DB.First(&m, *osAntiga.MedidorID).Error; err == nil {
			if m.TaxaPorM2 > 0 {
				taxaMedidor = m.TaxaPorM2
			}
			if m.Endereco != "" {
				endOrigem = m.Endereco
			}
		}
	}

	taxaDesloc, kmTotal, minTotal := utils.CalcularDeslocamentoDinamico(endOrigem, osAtualizada.EnderecoObra)
	osAtualizada.TaxaDeslocamento = taxaDesloc
	osAtualizada.KmDeslocamento = kmTotal
	osAtualizada.TempoDeslocamentoMin = minTotal
	osAtualizada.OrigemDeslocamento = endOrigem

	latObra, lonObra, _ := utils.GeocodificarEndereco(osAtualizada.EnderecoObra)
	osAtualizada.LatitudeObra = latObra
	osAtualizada.LongitudeObra = lonObra

	if osAtualizada.Urgencia {
		osAtualizada.TaxaDeslocamento *= 2
	}

	osAtualizada.ValorBaseM2 = 5.72
	custoMedicaoBruto := 0.0
	custoMedidorBruto := 0.0

	for i := range osAtualizada.Ambientes {
		if osAtualizada.Ambientes[i].Complexidade < 1.0 {
			osAtualizada.Ambientes[i].Complexidade = 1.0
		}
		area := osAtualizada.Ambientes[i].AreaEstimadaM2
		comp := osAtualizada.Ambientes[i].Complexidade
		custoMedicaoBruto += area * osAtualizada.ValorBaseM2 * comp
		custoMedidorBruto += area * taxaMedidor * comp
	}

	// 1. Mão de Obra do Medidor e Adicional de Urgência (+50%)
	osAtualizada.MaoDeObraMedidor = custoMedidorBruto
	if osAtualizada.Urgencia {
		osAtualizada.AdicionalUrgencia = custoMedidorBruto * 0.50
	} else {
		osAtualizada.AdicionalUrgencia = 0.0
	}
	osAtualizada.CustoMedidor = osAtualizada.MaoDeObraMedidor + osAtualizada.AdicionalUrgencia + osAtualizada.TaxaDeslocamento

	// 2. Margem da Plataforma SGM fixada em 20% do GMV total (Repasse Medidor = 80%)
	osAtualizada.ValorTotalOS = osAtualizada.CustoMedidor / 0.80
	if taxaMedidor > 0 {
		osAtualizada.ValorBaseM2 = taxaMedidor / 0.80
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