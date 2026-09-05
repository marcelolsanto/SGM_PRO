package controllers

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// UploadArquivo faz o upload físico de arquivo e retorna sua URL pública
func UploadArquivo(c *fiber.Ctx) error {
	file, err := c.FormFile("arquivo")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Nenhum arquivo enviado."})
	}

	nomeUnico := fmt.Sprintf("%d_%s", time.Now().UnixNano(), strings.ReplaceAll(file.Filename, " ", "_"))
	caminhoFisico := fmt.Sprintf("./uploads/%s", nomeUnico)

	if err := c.SaveFile(file, caminhoFisico); err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao salvar arquivo no disco."})
	}

	// Base URL configurável ou fallback para localhost:8080
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	urlPublica := fmt.Sprintf("%s/uploads/%s", baseURL, nomeUnico)
	return c.Status(200).JSON(fiber.Map{"url": urlPublica})
}
