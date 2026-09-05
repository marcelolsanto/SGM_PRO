package controllers

import (
	"time"

	"workspace/backend/config"
	"workspace/backend/models"

	"github.com/gofiber/fiber/v2"
)

// ObterMagicLink busca os dados da OS pelo token público
func ObterMagicLink(c *fiber.Ctx) error {
	token := c.Params("token")
	var os models.OrdemServico

	err := config.DB.Preload("Loja").
		Preload("Medidor").
		Preload("Ambientes").
		Preload("Briefing").
		Where("token = ?", token).
		First(&os).Error

	if err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Link inválido ou expirado."})
	}

	return c.Status(200).JSON(os)
}

// AceitarMagicLink salva o briefing preenchido e marca os termos como aceitos
func AceitarMagicLink(c *fiber.Ctx) error {
	token := c.Params("token")
	var os models.OrdemServico

	if err := config.DB.Where("token = ?", token).First(&os).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Link inválido."})
	}

	type PayloadBriefing struct {
		DadosJSON string `json:"dados_json"`
	}

	var req PayloadBriefing
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados do formulário inválidos."})
	}

	// Captura dados para auditoria jurídica (Art. 15 Marco Civil da Internet)
	ipOrigem := c.Get("X-Forwarded-For")
	if ipOrigem == "" {
		ipOrigem = c.Get("X-Real-IP")
	}
	if ipOrigem == "" {
		ipOrigem = c.IP()
	}
	userAgent := c.Get("User-Agent")
	agoraUTC := time.Now().UTC()

	// Deleta briefing anterior se houver para não duplicar
	config.DB.Where("ordem_servico_id = ?", os.ID).Delete(&models.BriefingCliente{})
	config.DB.Create(&models.BriefingCliente{
		OrdemServicoID: os.ID,
		DadosJSON:      req.DadosJSON,
		IPOrigem:       ipOrigem,
		UserAgent:      userAgent,
		DataHoraUTC:    agoraUTC,
	})

	os.TermosAceitos = true
	os.DataAceite = &agoraUTC
	config.DB.Save(&os)

	return c.Status(200).JSON(fiber.Map{"mensagem": "Termos aceitos com sucesso!"})
}
