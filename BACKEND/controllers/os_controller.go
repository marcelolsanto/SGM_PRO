package controllers

import (
	"time"

	"workspace/backend/config"
	"workspace/backend/models"
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

func ListarOrdens(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)

	var ordens []models.OrdemServico
	query := config.DB.Preload("Loja").
		Preload("Medidor").
		Preload("Ambientes").
		Preload("Briefing")

	if perfil == "LOJA" {
		query = query.Where("loja_id = ?", refID).Order("criado_em DESC").Find(&ordens)
		return c.Status(200).JSON(ordens)
	} else if perfil == "MEDIDOR" {
		query = query.Where("medidor_id = ? OR (medidor_id IS NULL AND status = 'PENDENTE_LOJA')", refID).
			Order("criado_em DESC").
			Find(&ordens)

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

	// ADMIN vê tudo
	query.Order("criado_em DESC").Find(&ordens)
	return c.Status(200).JSON(ordens)
}

func CriarOrdem(c *fiber.Ctx) error {
	osData := new(models.OrdemServico)
	if err := c.BodyParser(osData); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados corrompidos"})
	}

	var loja models.Loja
	config.DB.First(&loja, osData.LojaID)
	end := loja.Endereco
	if end == "" {
		end = "Praça da Sé, São Paulo, SP"
	}

	osData.TaxaDeslocamento = utils.CalcularTaxaGoogleMaps(end, osData.EnderecoObra)
	if osData.Urgencia {
		osData.TaxaDeslocamento *= 2
	}

	osData.ValorBaseM2 = 5.72
	custoMedicaoBruto := 0.0
	custoMedidorBruto := 0.0
	taxaMedidor := 3.50

	if osData.MedidorID != nil {
		var m models.Medidor
		config.DB.First(&m, *osData.MedidorID)
		if m.TaxaPorM2 > 0 {
			taxaMedidor = m.TaxaPorM2
		}
	}

	for i := range osData.Ambientes {
		if osData.Ambientes[i].Complexidade < 1.0 {
			osData.Ambientes[i].Complexidade = 1.0
		}
		area := osData.Ambientes[i].AreaEstimadaM2
		comp := osData.Ambientes[i].Complexidade
		custoMedicaoBruto += area * osData.ValorBaseM2 * comp
		custoMedidorBruto += area * taxaMedidor * comp
	}

	qtdAmbientes := len(osData.Ambientes)
	descontoVolume := 0.0
	if !osData.Urgencia {
		if qtdAmbientes == 2 {
			descontoVolume = 0.05
		} else if qtdAmbientes == 3 {
			descontoVolume = 0.10
		} else if qtdAmbientes == 4 {
			descontoVolume = 0.15
		} else if qtdAmbientes >= 5 {
			descontoVolume = 0.20
		}
	}

	subTotal := (custoMedicaoBruto * (1.0 - descontoVolume)) + osData.TaxaDeslocamento
	osData.ValorTotalOS = subTotal + (subTotal * 0.10)
	osData.CustoMedidor = custoMedidorBruto + osData.TaxaDeslocamento
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
	end := loja.Endereco
	if end == "" {
		end = "Praça da Sé, São Paulo, SP"
	}

	osAtualizada.TaxaDeslocamento = utils.CalcularTaxaGoogleMaps(end, osAtualizada.EnderecoObra)
	if osAtualizada.Urgencia {
		osAtualizada.TaxaDeslocamento *= 2
	}

	osAtualizada.ValorBaseM2 = 5.72
	custoMedicaoBruto := 0.0
	custoMedidorBruto := 0.0
	taxaMedidor := 3.50

	if osAntiga.MedidorID != nil {
		var m models.Medidor
		config.DB.First(&m, *osAntiga.MedidorID)
		if m.TaxaPorM2 > 0 {
			taxaMedidor = m.TaxaPorM2
		}
	}

	for i := range osAtualizada.Ambientes {
		if osAtualizada.Ambientes[i].Complexidade < 1.0 {
			osAtualizada.Ambientes[i].Complexidade = 1.0
		}
		area := osAtualizada.Ambientes[i].AreaEstimadaM2
		comp := osAtualizada.Ambientes[i].Complexidade
		custoMedicaoBruto += area * osAtualizada.ValorBaseM2 * comp
		custoMedidorBruto += area * taxaMedidor * comp
	}

	qtdAmbientes := len(osAtualizada.Ambientes)
	descontoVolume := 0.0
	if !osAtualizada.Urgencia {
		if qtdAmbientes == 2 {
			descontoVolume = 0.05
		} else if qtdAmbientes == 3 {
			descontoVolume = 0.10
		} else if qtdAmbientes == 4 {
			descontoVolume = 0.15
		} else if qtdAmbientes >= 5 {
			descontoVolume = 0.20
		}
	}

	subTotal := (custoMedicaoBruto * (1.0 - descontoVolume)) + osAtualizada.TaxaDeslocamento
	osAtualizada.ValorTotalOS = subTotal + (subTotal * 0.10)
	osAtualizada.CustoMedidor = custoMedidorBruto + osAtualizada.TaxaDeslocamento

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
			custoBruto += amb.AreaEstimadaM2 * taxa * amb.Complexidade
		}
		os.CustoMedidor = custoBruto + os.TaxaDeslocamento
	}

	os.Status = p.Status
	config.DB.Save(&os)
	return c.Status(200).JSON(os)
}

func PegarDemanda(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	if perfil != "MEDIDOR" {
		return c.Status(403).JSON(fiber.Map{"erro": "Apenas medidores podem pegar demandas"})
	}

	var os models.OrdemServico
	if err := config.DB.First(&os, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	os.MedidorID = &refID
	os.Status = "EM_ROTA"
	now := time.Now()
	os.DataAceite = &now
	config.DB.Save(&os)

	return c.Status(200).JSON(os)
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

func EntregarMedicao(c *fiber.Ctx) error {
	var os models.OrdemServico
	if err := config.DB.First(&os, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	type EntregaPayload struct {
		CaminhoMedicao  string `json:"caminho_medicao"`
		MaterialMedicao string `json:"material_medicao"`
	}

	var payload EntregaPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados de entrega inválidos"})
	}

	os.CaminhoMedicao = payload.CaminhoMedicao
	os.MaterialMedicao = payload.MaterialMedicao
	os.Status = "CONCLUIDO"
	now := time.Now()
	os.DataConclusao = &now
	config.DB.Save(&os)

	return c.Status(200).JSON(os)
}

func DeletarOrdem(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := config.DB.Delete(&models.OrdemServico{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao deletar ordem"})
	}
	return c.JSON(fiber.Map{"mensagem": "Ordem deletada com sucesso"})
}