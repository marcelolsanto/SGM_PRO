package controllers

import (
	"os"
	"time"

	"workspace/backend/config"
	"workspace/backend/models"
	"workspace/backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func getJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "chave_padrao_desenvolvimento"
	}
	return []byte(secret)
}

func Login(c *fiber.Ctx) error {
	var input struct {
		Email string `json:"email"`
		Senha string `json:"senha"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	var usuario models.Usuario
	if err := config.DB.Where("email = ?", input.Email).First(&usuario).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"erro": "Credenciais incorretas."})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(usuario.Senha), []byte(input.Senha)); err != nil {
		return c.Status(401).JSON(fiber.Map{"erro": "Credenciais incorretas."})
	}

	var redeID uint = 0
	if usuario.RedeID != nil {
		redeID = *usuario.RedeID
	}

	claims := jwt.MapClaims{
		"id":      usuario.ID,
		"nome":    usuario.Nome,
		"email":   usuario.Email,
		"perfil":  usuario.Perfil,
		"ref_id":  usuario.RefID,
		"rede_id": redeID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString(getJWTSecret())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao gerar token"})
	}

	return c.JSON(fiber.Map{
		"token":   t,
		"nome":    usuario.Nome,
		"perfil":  usuario.Perfil,
		"ref_id":  usuario.RefID,
		"rede_id": usuario.RedeID,
	})
}

func EsqueciSenha(c *fiber.Ctx) error {
	var req struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	var u models.Usuario
	if err := config.DB.Where("email = ?", req.Email).First(&u).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "E-mail não encontrado."})
	}

	u.ResetToken = utils.GerarTokenUnico()
	exp := time.Now().Add(1 * time.Hour)
	u.ResetTokenExp = &exp
	config.DB.Save(&u)

	return c.Status(200).JSON(fiber.Map{"mensagem": "Instruções enviadas para o e-mail."})
}

func ResetarSenha(c *fiber.Ctx) error {
	var req struct {
		Token     string `json:"token"`
		NovaSenha string `json:"nova_senha"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}

	var u models.Usuario
	if err := config.DB.Where("reset_token = ? AND reset_token_exp > ?", req.Token, time.Now()).First(&u).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Link inválido ou expirado."})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.NovaSenha), 10)
	u.Senha = string(hash)
	u.ResetToken = ""
	u.ResetTokenExp = nil
	config.DB.Save(&u)

	return c.Status(200).JSON(fiber.Map{"mensagem": "Senha atualizada!"})
}