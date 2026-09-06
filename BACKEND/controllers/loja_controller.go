package controllers

import (
	"workspace/backend/models"
	"workspace/backend/services" // Importa o Service

	"github.com/gofiber/fiber/v2"
)

func ListarLojas(c *fiber.Ctx) error {
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
	var redeID uint
	if rd, ok := c.Locals("rede_id").(float64); ok {
		redeID = uint(rd)
	} else if rd, ok := c.Locals("rede_id").(uint); ok {
		redeID = rd
	}

	lojas, err := services.ObterLojas(perfil, refID, redeID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao buscar as lojas no banco"})
	}

	return c.Status(200).JSON(lojas)
}

func CriarLoja(c *fiber.Ctx) error {
	loja := new(models.Loja)
	
	if err := c.BodyParser(loja); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados enviados estão corrompidos"})
	}

	// 🔥 COMUNICAÇÃO: Manda o Service criar a loja (o Service vai formatar o CNPJ sozinho)
	if err := services.CriarLoja(loja); err != nil {
		// Se der erro aqui, geralmente é porque o CNPJ já existe no banco (Unique)
		return c.Status(400).JSON(fiber.Map{"erro": "Não foi possível criar a loja. Verifique se o CNPJ já está cadastrado."})
	}

	return c.Status(201).JSON(loja)
}

func AtualizarLoja(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	lojaRequest := new(models.Loja)
	
	if err := c.BodyParser(lojaRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	lojaAtualizada, err := services.AtualizarLoja(uint(id), lojaRequest)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Loja não encontrada ou erro ao atualizar"})
	}

	return c.Status(200).JSON(lojaAtualizada)
}

func DeletarLoja(c *fiber.Ctx) error {
	id := c.Params("id")
	
	if err := services.DeletarLoja(id); err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Não foi possível deletar a loja"})
	}
	
	return c.Status(200).JSON(fiber.Map{"mensagem": "Loja excluída com sucesso!"})
}