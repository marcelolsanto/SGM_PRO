package controllers

import (
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"
	"time"

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

// ObterMeuRoteiro calcula o itinerário multi-paradas completo para o dia do medidor
func ObterMeuRoteiro(c *fiber.Ctx) error {
	_, refID := getPerfilERefID(c)
	medidorID := refID
	if qID, _ := strconv.ParseUint(c.Query("medidorId"), 10, 64); qID > 0 {
		medidorID = uint(qID)
	}
	if medidorID == 0 {
		medidorID = 1 // Fallback para Medidor #1
	}

	origemLat, _ := strconv.ParseFloat(c.Query("origemLat"), 64)
	origemLon, _ := strconv.ParseFloat(c.Query("origemLon"), 64)

	if origemLat == 0 && origemLon == 0 {
		var m models.Medidor
		if err := config.DB.First(&m, medidorID).Error; err == nil && m.Latitude != 0 {
			origemLat = m.Latitude
			origemLon = m.Longitude
		} else {
			origemLat = -15.779017
			origemLon = -47.997900
		}
	}

	// Busca ordens atribuídas ao medidor com status EM_ROTA ordenadas pela sequência do roteiro
	var ordens []models.OrdemServico
	config.DB.Where("medidor_id = ? AND status = 'EM_ROTA'", medidorID).
		Order("CASE WHEN ordem_rota > 0 THEN ordem_rota ELSE 9999 END, hora_agendada ASC, id ASC").
		Find(&ordens)

	var paradas []utils.ParadaRota
	totalRepasse := 0.0

	for i, os := range ordens {
		lat := os.LatitudeObra
		lon := os.LongitudeObra
		if lat == 0 || lon == 0 {
			latGeocoded, lonGeocoded, err := utils.GeocodificarEndereco(os.EnderecoObra)
			if err == nil && latGeocoded != 0 {
				lat = latGeocoded
				lon = lonGeocoded
				config.DB.Model(&os).Updates(map[string]interface{}{"latitude_obra": lat, "longitude_obra": lon})
			}
		}

		tempoObra := os.TempoEstimadoMin
		if tempoObra <= 0 {
			tempoObra = 60
		}

		paradas = append(paradas, utils.ParadaRota{
			OSID:             os.ID,
			ClienteNome:      os.ClienteNome,
			Endereco:         os.EnderecoObra,
			Latitude:         lat,
			Longitude:        lon,
			HoraAgendada:     os.HoraAgendada,
			OrdemIndex:       i + 1,
			TempoEstimadoMin: tempoObra,
			CustoMedidor:     os.CustoMedidor,
		})
		totalRepasse += os.CustoMedidor
	}

	rotaMulti, err := utils.ObterRotaMultiParadas(origemLat, origemLon, paradas)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"erro": "Falha ao calcular roteiro do dia: " + err.Error()})
	}

	// Calcula cronograma estimado das visitas com base no horário agendado e duração da medição
	type CronogramaItem struct {
		Ordem             int     `json:"ordem"`
		OSID              uint    `json:"os_id"`
		Cliente           string  `json:"cliente"`
		Endereco          string  `json:"endereco"`
		HoraAgendada      string  `json:"hora_agendada"`
		PrevisaoChegada   string  `json:"previsao_chegada"`
		TempoMedicaoMin   int     `json:"tempo_medicao_min"`
		PrevisaoTermino   string  `json:"previsao_termino"`
		DistanciaTrechoKm float64 `json:"distancia_trecho_km"`
		TempoTrechoMin    int     `json:"tempo_trecho_min"`
		Repasse           float64 `json:"repasse"`
		Latitude          float64 `json:"latitude"`
		Longitude         float64 `json:"longitude"`
	}

	var cronograma []CronogramaItem
	for i, p := range paradas {
		distTrecho := 0.0
		durTrecho := 0
		if i < len(rotaMulti.Trechos) {
			distTrecho = rotaMulti.Trechos[i].DistanciaKm
			durTrecho = rotaMulti.Trechos[i].DuracaoMinutos
		}

		horaBase := p.HoraAgendada
		if horaBase == "" {
			horaBase = fmt.Sprintf("%02d:00", 9+i*2)
		}

		var termino string
		if t, err := time.Parse("15:04", horaBase); err == nil {
			tTermino := t.Add(time.Duration(p.TempoEstimadoMin) * time.Minute)
			termino = tTermino.Format("15:04")
		} else {
			termino = horaBase
		}

		cronograma = append(cronograma, CronogramaItem{
			Ordem:             i + 1,
			OSID:              p.OSID,
			Cliente:           p.ClienteNome,
			Endereco:          p.Endereco,
			HoraAgendada:      horaBase,
			PrevisaoChegada:   horaBase,
			TempoMedicaoMin:   p.TempoEstimadoMin,
			PrevisaoTermino:   termino,
			DistanciaTrechoKm: distTrecho,
			TempoTrechoMin:    durTrecho,
			Repasse:           p.CustoMedidor,
			Latitude:          p.Latitude,
			Longitude:         p.Longitude,
		})
	}

	return c.JSON(fiber.Map{
		"medidor_id":                medidorID,
		"total_paradas":             len(paradas),
		"total_km":                  rotaMulti.TotalKm,
		"total_distancia_km":        rotaMulti.TotalKm,
		"total_tempo_transito":      rotaMulti.TotalDuracaoMin,
		"duracao_transito_min":      rotaMulti.TotalDuracaoMin,
		"total_tempo_medicoes":      rotaMulti.TotalTempoObraMin,
		"duracao_medicao_min":       rotaMulti.TotalTempoObraMin,
		"total_tempo_jornada":       rotaMulti.TotalDuracaoMin + rotaMulti.TotalTempoObraMin,
		"duracao_total_min":         rotaMulti.TotalDuracaoMin + rotaMulti.TotalTempoObraMin,
		"total_repasse":             totalRepasse,
		"ganho_total_repasse":       totalRepasse,
		"total_tarifa_desloc":       rotaMulti.TotalTarifa,
		"origem": fiber.Map{
			"lat":       origemLat,
			"lon":       origemLon,
			"descricao": "Sua Localização (Medidor)",
		},
		"paradas":                    paradas,
		"trechos":                    rotaMulti.Trechos,
		"cronograma":                 cronograma,
		"coordenadas":                rotaMulti.Coordenadas,
		"google_maps_url":            rotaMulti.GoogleMapsURL,
		"google_maps_multi_stop_url": rotaMulti.GoogleMapsURL,
	})
}

// ReordenarRoteiro altera a sequência de visitação das ordens do dia
func ReordenarRoteiro(c *fiber.Ctx) error {
	type Payload struct {
		Sequencia []uint `json:"sequencia"`
		OrdemIDs  []uint `json:"ordem_ids"`
	}
	var p Payload
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"erro": "Payload inválido."})
	}
	ids := p.Sequencia
	if len(ids) == 0 {
		ids = p.OrdemIDs
	}
	if len(ids) == 0 {
		return c.Status(400).JSON(fiber.Map{"erro": "Nenhum ID de OS informado para reordenação."})
	}

	for idx, osID := range ids {
		config.DB.Model(&models.OrdemServico{}).Where("id = ?", osID).Update("ordem_rota", idx+1)
	}

	return c.JSON(fiber.Map{"mensagem": "Roteiro reordenado com sucesso!", "sequencia": ids})
}

// AdicionarAoRoteiro aceita uma OS e a adiciona à rota de hoje do medidor
func AdicionarAoRoteiro(c *fiber.Ctx) error {
	osID := c.Params("id")
	_, refID := getPerfilERefID(c)
	if refID == 0 {
		refID = 1
	}

	var os models.OrdemServico
	if err := config.DB.First(&os, osID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	var maxOrdem int
	config.DB.Model(&models.OrdemServico{}).Where("medidor_id = ?", refID).Select("COALESCE(MAX(ordem_rota), 0)").Scan(&maxOrdem)

	agora := time.Now()
	os.MedidorID = &refID
	os.Status = "EM_ROTA"
	os.OrdemRota = maxOrdem + 1
	os.DataAceite = &agora
	if os.TempoEstimadoMin <= 0 {
		os.TempoEstimadoMin = 60
	}
	config.DB.Save(&os)

	return c.JSON(fiber.Map{
		"mensagem":   "Ordem de serviço adicionada ao seu roteiro com sucesso!",
		"os_id":      os.ID,
		"ordem_rota": os.OrdemRota,
	})
}

// OtimizarPorProximidade reordena as ordens para minimizar a distância total (Nearest-Neighbor)
func OtimizarPorProximidade(c *fiber.Ctx) error {
	_, refID := getPerfilERefID(c)
	medidorID := refID
	if medidorID == 0 {
		medidorID = 1
	}

	origemLat, _ := strconv.ParseFloat(c.Query("origemLat"), 64)
	origemLon, _ := strconv.ParseFloat(c.Query("origemLon"), 64)
	if origemLat == 0 {
		origemLat, _ = strconv.ParseFloat(c.Query("lat"), 64)
	}
	if origemLon == 0 {
		origemLon, _ = strconv.ParseFloat(c.Query("lon"), 64)
	}

	type OtimizarBody struct {
		Lat       float64 `json:"lat"`
		Lon       float64 `json:"lon"`
		OrigemLat float64 `json:"origemLat"`
		OrigemLon float64 `json:"origemLon"`
	}
	var b OtimizarBody
	if err := c.BodyParser(&b); err == nil {
		if b.Lat != 0 {
			origemLat = b.Lat
		} else if b.OrigemLat != 0 {
			origemLat = b.OrigemLat
		}
		if b.Lon != 0 {
			origemLon = b.Lon
		} else if b.OrigemLon != 0 {
			origemLon = b.OrigemLon
		}
	}

	if origemLat == 0 && origemLon == 0 {
		origemLat = -15.779017
		origemLon = -47.997900
	}

	var ordens []models.OrdemServico
	config.DB.Where("medidor_id = ? AND status = 'EM_ROTA'", medidorID).Find(&ordens)

	if len(ordens) <= 1 {
		return c.JSON(fiber.Map{"mensagem": "Poucas ordens para otimizar", "ordens": ordens})
	}

	restantes := make([]models.OrdemServico, len(ordens))
	copy(restantes, ordens)

	var otimizadas []models.OrdemServico
	currLat, currLon := origemLat, origemLon

	for len(restantes) > 0 {
		melhorIdx := 0
		menorDist := math.MaxFloat64

		for i, o := range restantes {
			d := calcularDistanciaEuclidiana(currLat, currLon, o.LatitudeObra, o.LongitudeObra)
			if d < menorDist {
				menorDist = d
				melhorIdx = i
			}
		}

		escolhida := restantes[melhorIdx]
		otimizadas = append(otimizadas, escolhida)
		currLat = escolhida.LatitudeObra
		currLon = escolhida.LongitudeObra
		restantes = append(restantes[:melhorIdx], restantes[melhorIdx+1:]...)
	}

	for idx, o := range otimizadas {
		config.DB.Model(&models.OrdemServico{}).Where("id = ?", o.ID).Update("ordem_rota", idx+1)
	}

	return c.JSON(fiber.Map{
		"mensagem":  "Roteiro otimizado por proximidade com sucesso!",
		"sequencia": otimizadas,
	})
}

func calcularDistanciaEuclidiana(lat1, lon1, lat2, lon2 float64) float64 {
	dLat := (lat2 - lat1) * 111.0
	dLon := (lon2 - lon1) * 111.0 * math.Cos(lat1*math.Pi/180.0)
	return math.Sqrt(dLat*dLat + dLon*dLon)
}

// RemoverOuRecusarParada retira a ordem do roteiro do medidor ou recusa uma demanda pendente
func RemoverOuRecusarParada(c *fiber.Ctx) error {
	id := c.Params("id")
	var os models.OrdemServico
	if err := config.DB.First(&os, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"erro": "Ordem não encontrada"})
	}

	// Volta a ordem para PENDENTE_LOJA e desassocia do medidor
	config.DB.Model(&os).Updates(map[string]interface{}{
		"status":     "PENDENTE_LOJA",
		"medidor_id": nil,
		"ordem_rota": 0,
	})

	return c.JSON(fiber.Map{
		"mensagem": "Ordem retirada do roteiro com sucesso!",
		"os_id":    os.ID,
	})
}

