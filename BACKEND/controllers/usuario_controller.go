package controllers

import (
	"workspace/backend/config"
	"workspace/backend/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

func CriarUsuario(c *fiber.Ctx) error {
	perfilLogado, refID := getPerfilERefID(c)

	var u models.Usuario
	if err := c.BodyParser(&u); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	if perfilLogado == "LOJA" {
		u.Perfil = "LOJA"
		u.RefID = refID
	}

	senhaPadrao := u.Senha
	if senhaPadrao == "" {
		senhaPadrao = "mudar@123"
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(senhaPadrao), 10)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Erro ao criptografar senha"})
	}
	u.Senha = string(hashed)

	if err := config.DB.Create(&u).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Falha ao criar usuário. Verifique se o e-mail já existe."})
	}

	return c.Status(201).JSON(u)
}

func ListarUsuarios(c *fiber.Ctx) error {
	perfilLogado, refID := getPerfilERefID(c)

	var usuarios []models.Usuario
	if perfilLogado == "LOJA" {
		config.DB.Where("perfil = 'LOJA' AND ref_id = ?", refID).Find(&usuarios)
	} else {
		config.DB.Find(&usuarios)
	}

	// Não expõe hash de senha
	for i := range usuarios {
		usuarios[i].Senha = ""
	}

	return c.Status(200).JSON(usuarios)
}

func ObterUsuario(c *fiber.Ctx) error {
	perfilLogado, refID := getPerfilERefID(c)
	id := c.Params("id")

	var u models.Usuario
	if err := config.DB.First(&u, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Usuário não encontrado"})
	}

	if perfilLogado == "LOJA" && (u.Perfil != "LOJA" || u.RefID != refID) {
		return c.Status(403).JSON(fiber.Map{"erro": "Acesso negado"})
	}

	u.Senha = ""
	return c.JSON(u)
}

func AtualizarUsuario(c *fiber.Ctx) error {
	perfilLogado, refID := getPerfilERefID(c)
	id := c.Params("id")

	var u models.Usuario
	if err := config.DB.First(&u, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Usuário não encontrado"})
	}

	if perfilLogado == "LOJA" && (u.Perfil != "LOJA" || u.RefID != refID) {
		return c.Status(403).JSON(fiber.Map{"erro": "Acesso negado"})
	}

	type UpdateData struct {
		Nome   string `json:"nome"`
		Email  string `json:"email"`
		Perfil string `json:"perfil"`
		RefID  uint   `json:"ref_id"`
		Senha  string `json:"senha"`
	}

	var p UpdateData
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	u.Nome = p.Nome
	u.Email = p.Email

	if perfilLogado != "LOJA" {
		if p.Perfil != "" {
			u.Perfil = p.Perfil
		}
		u.RefID = p.RefID
	}

	if p.Senha != "" {
		hashed, err := bcrypt.GenerateFromPassword([]byte(p.Senha), 10)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"erro": "Erro ao atualizar senha"})
		}
		u.Senha = string(hashed)
	}

	if err := config.DB.Save(&u).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Falha ao salvar usuário"})
	}

	u.Senha = ""
	return c.Status(200).JSON(u)
}

func DeletarUsuario(c *fiber.Ctx) error {
	perfilLogado, refID := getPerfilERefID(c)
	id := c.Params("id")

	var u models.Usuario
	if err := config.DB.First(&u, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Usuário não encontrado"})
	}

	if perfilLogado == "LOJA" && (u.Perfil != "LOJA" || u.RefID != refID) {
		return c.Status(403).JSON(fiber.Map{"erro": "Acesso negado"})
	}

	if err := config.DB.Delete(&u).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao deletar usuário"})
	}

	return c.Status(200).JSON(fiber.Map{"mensagem": "Usuário deletado com sucesso"})
}
