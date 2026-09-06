package controllers

import (
	"time"

    "github.com/gofiber/fiber/v2"
    "workspace/backend/models"
    "workspace/backend/config"
)

func CriarMedidor(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	redeID := getRedeID(c)

	var m models.Medidor
	if err := c.BodyParser(&m); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
	}
	if m.TaxaPorM2 <= 0 {
		m.TaxaPorM2 = 3.50
	}
	m.EstaAtivo = true

	// Se cadastrado por uma Loja, vincula à Loja/Rede
	if perfil == "LOJA" {
		m.OrigemTipo = "LOJA"
		m.OrigemID = &refID
		m.LojaVinculadaID = &refID
		if redeID > 0 {
			m.RedeID = &redeID
		}
	} else if perfil == "MEDIDOR" {
		m.OrigemTipo = "MEDIDOR"
		m.OrigemID = &refID
	} else {
		m.OrigemTipo = "PLATAFORMA"
	}

	config.DB.Create(&m)
	return c.Status(201).JSON(m)
}

// Lista todos os medidores respeitando homologação de loja/rede
func ListarMedidores(c *fiber.Ctx) error {
	perfil, refID := getPerfilERefID(c)
	redeID := getRedeID(c)

	var medidores []models.Medidor
	q := config.DB.Where("esta_ativo = true")

	if perfil == "LOJA" {
		if redeID > 0 {
			q = q.Where("rede_id = ? OR loja_vinculada_id = ? OR (rede_id IS NULL AND loja_vinculada_id IS NULL)", redeID, refID)
		} else {
			q = q.Where("loja_vinculada_id = ? OR (rede_id IS NULL AND loja_vinculada_id IS NULL)", refID)
		}
	}

	q.Order("nome_completo ASC").Find(&medidores)
	return c.JSON(medidores)
}

func ObterMedidor(c *fiber.Ctx) error {
    id := c.Params("id")
    var m models.Medidor
    if err := config.DB.First(&m, id).Error; err != nil {
        return c.Status(404).JSON(fiber.Map{"erro": "Medidor não encontrado"})
    }
    return c.JSON(m)
}

func AtualizarMedidor(c *fiber.Ctx) error {
    id := c.Params("id")
    var m models.Medidor
    if err := config.DB.First(&m, id).Error; err != nil {
        return c.Status(404).JSON(fiber.Map{"erro": "Medidor não encontrado"})
    }
    var input models.Medidor
    if err := c.BodyParser(&input); err != nil {
        return c.Status(400).JSON(fiber.Map{"erro": "Dados inválidos"})
    }
    config.DB.Model(&m).Updates(input)
    return c.JSON(m)
}

func DeletarMedidor(c *fiber.Ctx) error {
    id := c.Params("id")
    if err := config.DB.Delete(&models.Medidor{}, id).Error; err != nil {
        return c.Status(500).JSON(fiber.Map{"erro": "Falha ao deletar medidor"})
    }
    return c.JSON(fiber.Map{"msg": "Medidor deletado"})
}

func AtualizarLocalizacaoMedidor(c *fiber.Ctx) error {
	id := c.Params("id")
	var m models.Medidor
	if err := config.DB.First(&m, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Medidor não encontrado"})
	}

	var payload struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Coordenadas inválidas"})
	}

	agora := time.Now()
	m.Latitude = payload.Latitude
	m.Longitude = payload.Longitude
	m.UltimaLocalizacao = &agora

	config.DB.Model(&m).Select("Latitude", "Longitude", "UltimaLocalizacao").Updates(m)

	return c.JSON(fiber.Map{
		"mensagem":           "Localização GPS atualizada com sucesso",
		"medidor_id":         m.ID,
		"latitude":           m.Latitude,
		"longitude":          m.Longitude,
		"ultima_localizacao": m.UltimaLocalizacao,
	})
}

func ObterLocalizacaoMedidor(c *fiber.Ctx) error {
	id := c.Params("id")
	var m models.Medidor
	if err := config.DB.First(&m, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Medidor não encontrado"})
	}

	return c.JSON(fiber.Map{
		"medidor_id":         m.ID,
		"nome_completo":      m.NomeCompleto,
		"latitude":           m.Latitude,
		"longitude":          m.Longitude,
		"ultima_localizacao": m.UltimaLocalizacao,
	})
}

func AtualizarDisponibilidadeMedidor(c *fiber.Ctx) error {
	id := c.Params("id")
	var m models.Medidor
	if err := config.DB.First(&m, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Medidor não encontrado"})
	}

	type DisponibilidadePayload struct {
		DiasDisponiveis  string `json:"dias_disponiveis"`
		HorasDisponiveis string `json:"horas_disponiveis"`
	}

	var req DisponibilidadePayload
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Corpo da requisição inválido"})
	}

	if req.DiasDisponiveis != "" {
		m.DiasDisponiveis = req.DiasDisponiveis
	}
	if req.HorasDisponiveis != "" {
		m.HorasDisponiveis = req.HorasDisponiveis
	}

	config.DB.Save(&m)
	return c.JSON(fiber.Map{
		"mensagem":          "Disponibilidade da agenda atualizada com sucesso",
		"dias_disponiveis":  m.DiasDisponiveis,
		"horas_disponiveis": m.HorasDisponiveis,
	})
}

