package controllers

import (
	"workspace/backend/config"
	"workspace/backend/models"

	"github.com/gofiber/fiber/v2"
)

func CriarCliente(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)

	var cl models.Cliente
	if err := c.BodyParser(&cl); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	if cl.Nome == "" {
		return c.Status(400).JSON(fiber.Map{"erro": "O nome do cliente é obrigatório"})
	}

	if perfil == "LOJA" {
		cl.LojaID = refID
	}

	if err := config.DB.Create(&cl).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Falha ao cadastrar cliente"})
	}

	return c.Status(201).JSON(cl)
}

func ListarClientes(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)

	var lista []models.Cliente
	if perfil == "LOJA" {
		config.DB.Where("loja_id = ?", refID).Find(&lista)
	} else {
		config.DB.Find(&lista)
	}

	return c.Status(200).JSON(lista)
}

func ObterCliente(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	id := c.Params("id")

	var cl models.Cliente
	if err := config.DB.First(&cl, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Cliente não encontrado"})
	}

	if perfil == "LOJA" && cl.LojaID != refID {
		return c.Status(403).JSON(fiber.Map{"erro": "Acesso negado"})
	}

	return c.JSON(cl)
}

func AtualizarCliente(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	id := c.Params("id")

	var cl models.Cliente
	if err := config.DB.First(&cl, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Cliente não encontrado"})
	}

	if perfil == "LOJA" && cl.LojaID != refID {
		return c.Status(403).JSON(fiber.Map{"erro": "Acesso negado"})
	}

	var input models.Cliente
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	if perfil == "LOJA" {
		input.LojaID = refID
	}

	config.DB.Model(&cl).Updates(input)
	return c.JSON(cl)
}

func DeletarCliente(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	id := c.Params("id")

	var cl models.Cliente
	if err := config.DB.First(&cl, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Cliente não encontrado"})
	}

	if perfil == "LOJA" && cl.LojaID != refID {
		return c.Status(403).JSON(fiber.Map{"erro": "Acesso negado"})
	}

	if err := config.DB.Delete(&cl).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao deletar cliente"})
	}

	return c.JSON(fiber.Map{"mensagem": "Cliente deletado com sucesso"})
}
