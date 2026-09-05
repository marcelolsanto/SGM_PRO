package controllers

import (
	"workspace/backend/models"
	"workspace/backend/services" // Importa o Service

	"github.com/gofiber/fiber/v2"
)

func ListarLojas(c *fiber.Ctx) error {
	perfil := c.Locals("perfil").(string)
	refID := uint(c.Locals("ref_id").(float64))

	// 🔥 COMUNICAÇÃO: O Controller pede para o Service buscar os dados
	lojas, err := services.ObterLojas(perfil, refID)
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