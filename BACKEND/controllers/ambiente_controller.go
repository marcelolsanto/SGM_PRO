package controllers

import (
    "github.com/gofiber/fiber/v2"
    "workspace/backend/models"
    "workspace/backend/config"
)

func CriarAmbiente(c *fiber.Ctx) error {
    var a models.Ambiente
    if err := c.BodyParser(&a); err != nil {
        return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
    }
    config.DB.Create(&a)
    return c.JSON(a)
}

func ListarAmbientes(c *fiber.Ctx) error {
    var lista []models.Ambiente
    config.DB.Find(&lista)
    return c.JSON(lista)
}

func ObterAmbiente(c *fiber.Ctx) error {
    id := c.Params("id")
    var a models.Ambiente
    if err := config.DB.First(&a, id).Error; err != nil {
        return c.Status(404).JSON(fiber.Map{"erro": "Ambiente não encontrado"})
    }
    return c.JSON(a)
}

func AtualizarAmbiente(c *fiber.Ctx) error {
    id := c.Params("id")
    var a models.Ambiente
    if err := config.DB.First(&a, id).Error; err != nil {
        return c.Status(404).JSON(fiber.Map{"erro": "Ambiente não encontrado"})
    }
    var input models.Ambiente
    if err := c.BodyParser(&input); err != nil {
        return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
    }
    config.DB.Model(&a).Updates(input)
    return c.JSON(a)
}

func DeletarAmbiente(c *fiber.Ctx) error {
    id := c.Params("id")
    if err := config.DB.Delete(&models.Ambiente{}, id).Error; err != nil {
        return c.Status(500).JSON(fiber.Map{"erro": "Falha ao deletar ambiente"})
    }
    return c.JSON(fiber.Map{"msg": "Ambiente deletado"})
}
