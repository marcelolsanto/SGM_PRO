package controllers

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"workspace/backend/config"
	"workspace/backend/models"
	"workspace/backend/utils"

	"github.com/gofiber/fiber/v2"
)

// TracarRota calcula a rota entre quaisquer duas coordenadas
func TracarRota(c *fiber.Ctx) error {
	origemLat, _ := strconv.ParseFloat(c.Query("origemLat"), 64)
	origemLon, _ := strconv.ParseFloat(c.Query("origemLon"), 64)
	destLat, _ := strconv.ParseFloat(c.Query("destLat"), 64)
	destLon, _ := strconv.ParseFloat(c.Query("destLon"), 64)

	if origemLat == 0 && origemLon == 0 {
		origemLat = utils.FallbackLatBSB
		origemLon = utils.FallbackLonBSB
	}
	if destLat == 0 && destLon == 0 {
		return c.Status(400).JSON(fiber.Map{"erro": "Coordenadas de destino obrigatórias."})
	}

	detalhes, err := utils.ObterDetalhesRota(origemLat, origemLon, destLat, destLon)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao calcular rota: " + err.Error()})
	}

	return c.JSON(detalhes)
}

// TracarRotaOS calcula automaticamente a rota do medidor até a obra do cliente
func TracarRotaOS(c *fiber.Ctx) error {
	osID := c.Params("id")

	var os models.OrdemServico
	if err := config.DB.Preload("Loja").Preload("Medidor").First(&os, osID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem de serviço não encontrada."})
	}

	// 1. Garante que a OS tenha latitude e longitude reais da obra
	if os.LatitudeObra == 0 || os.LongitudeObra == 0 {
		lat, lon, err := utils.GeocodificarEndereco(os.EnderecoObra)
		if err == nil && lat != 0 && lon != 0 {
			os.LatitudeObra = lat
			os.LongitudeObra = lon
			config.DB.Model(&os).Updates(map[string]interface{}{
				"latitude_obra":  lat,
				"longitude_obra": lon,
			})
		}
	}

	// 2. Determina a origem (GPS informado pelo medidor ou fallback do medidor/Brasília)
	origemLat, _ := strconv.ParseFloat(c.Query("origemLat"), 64)
	origemLon, _ := strconv.ParseFloat(c.Query("origemLon"), 64)

	if origemLat == 0 && origemLon == 0 {
		if os.Medidor != nil && os.Medidor.Latitude != 0 && os.Medidor.Longitude != 0 {
			origemLat = os.Medidor.Latitude
			origemLon = os.Medidor.Longitude
		} else {
			// Fallback: Centro de Brasília (Esplanada / Plano Piloto)
			origemLat = utils.FallbackLatBSB
			origemLon = utils.FallbackLonBSB
		}
	}

	destLat := os.LatitudeObra
	destLon := os.LongitudeObra

	if destLat == 0 && destLon == 0 {
		destLat = -15.775440 // Paranoá fallback
		destLon = -47.779763
	}

	detalhes, err := utils.ObterDetalhesRota(origemLat, origemLon, destLat, destLon)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Não foi possível traçar a rota: " + err.Error()})
	}

	// URL personalizada de navegação no Google Maps com o nome do cliente e endereço
	mapsDestino := fmt.Sprintf("%f,%f", destLat, destLon)
	if strings.TrimSpace(os.EnderecoObra) != "" {
		mapsDestino = url.QueryEscape(os.EnderecoObra)
	}
	googleMapsURL := fmt.Sprintf("https://www.google.com/maps/dir/?api=1&origin=%f,%f&destination=%s", origemLat, origemLon, mapsDestino)

	return c.JSON(fiber.Map{
		"os_id":           os.ID,
		"cliente_nome":    os.ClienteNome,
		"endereco_obra":   os.EnderecoObra,
		"distancia_km":    detalhes.DistanciaKm,
		"duracao_minutos": detalhes.DuracaoMinutos,
		"tarifa_estimada": detalhes.Tarifa,
		"coordenadas":     detalhes.Coordenadas,
		"nome_via":        detalhes.NomeVia,
		"google_maps_url": googleMapsURL,
		"origem": fiber.Map{
			"lat":       origemLat,
			"lon":       origemLon,
			"descricao": "Sua Localização Atual",
		},
		"destino": fiber.Map{
			"lat":       destLat,
			"lon":       destLon,
			"descricao": os.ClienteNome,
			"endereco":  os.EnderecoObra,
		},
	})
}
