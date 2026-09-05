package utils

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type googleMapsResponse struct {
	Rows []struct {
		Elements []struct {
			Distance struct {
				Value int `json:"value"`
			} `json:"distance"`
			Duration struct {
				Value int `json:"value"`
			} `json:"duration"`
			Status string `json:"status"`
		} `json:"elements"`
	} `json:"rows"`
	Status string `json:"status"`
}

type nominatimResult struct {
	Lat string `json:"lat"`
	Lon string `json:"lon"`
}

type osrmResponse struct {
	Code   string `json:"code"`
	Routes []struct {
		Distance float64 `json:"distance"`
		Duration float64 `json:"duration"`
	} `json:"routes"`
}

// calcularTarifaUber calcula a tarifa dinâmica com base em ida e volta (estilo UberX):
// Bandeirada: R$ 5,50 + R$ 1,60/km + R$ 0,35/minuto. Piso mínimo: R$ 25,00.
func calcularTarifaUber(kmIda float64, minutosIda float64) (float64, float64, int) {
	kmTotal := math.Round((kmIda*2.0)*100) / 100
	minutosTotal := int(math.Round(minutosIda * 2.0))
	if minutosTotal < 1 {
		minutosTotal = 1
	}

	bandeirada := 5.50
	tarifaKm := 1.60
	tarifaMinuto := 0.35
	pisoMinimo := 25.00

	taxa := bandeirada + (kmTotal * tarifaKm) + (float64(minutosTotal) * tarifaMinuto)
	if taxa < pisoMinimo {
		taxa = pisoMinimo
	}

	return math.Round(taxa*100) / 100, kmTotal, minutosTotal
}

// geocodificarNominatim busca coordenadas (lat, lon) de um endereço usando OpenStreetMap
func geocodificarNominatim(client *http.Client, endereco string) (float64, float64, error) {
	reqURL := fmt.Sprintf("https://nominatim.openstreetmap.org/search?format=json&q=%s", url.QueryEscape(endereco))
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return 0, 0, err
	}
	req.Header.Set("User-Agent", "SGM_PRO_FieldService/1.0 (contato@sgmpro.com.br)")

	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	var results []nominatimResult
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil || len(results) == 0 {
		return 0, 0, fmt.Errorf("endereço não encontrado")
	}

	lat, err1 := strconv.ParseFloat(results[0].Lat, 64)
	lon, err2 := strconv.ParseFloat(results[0].Lon, 64)
	if err1 != nil || err2 != nil {
		return 0, 0, fmt.Errorf("falha ao converter coordenadas")
	}

	return lat, lon, nil
}

// Constantes de fallback para Brasília - DF (Marco Zero / Plano Piloto)
const (
	FallbackLatBSB      = -15.793889
	FallbackLonBSB      = -47.882778
	FallbackEnderecoBSB = "Plano Piloto, Brasília - DF"
)

type osrmFullResponse struct {
	Code   string `json:"code"`
	Routes []struct {
		Distance float64 `json:"distance"`
		Duration float64 `json:"duration"`
		Geometry struct {
			Coordinates [][]float64 `json:"coordinates"` // [lon, lat]
		} `json:"geometry"`
		Legs []struct {
			Summary  string  `json:"summary"`
			Distance float64 `json:"distance"`
			Duration float64 `json:"duration"`
		} `json:"legs"`
	} `json:"routes"`
}

type DetalhesRota struct {
	DistanciaKm    float64     `json:"distancia_km"`
	DuracaoMinutos int         `json:"duracao_minutos"`
	Tarifa         float64     `json:"tarifa_estimada"`
	Coordenadas    [][]float64 `json:"coordenadas"` // Formato Leaflet [lat, lon]
	NomeVia        string      `json:"nome_via"`
	GoogleMapsURL  string      `json:"google_maps_url"`
}

// ObterDetalhesRota busca trajeto viário completo com coordenadas, km e duração
func ObterDetalhesRota(lat1, lon1, lat2, lon2 float64) (*DetalhesRota, error) {
	if lat1 == 0 && lon1 == 0 {
		lat1, lon1 = FallbackLatBSB, FallbackLonBSB
	}
	if lat2 == 0 && lon2 == 0 {
		lat2, lon2 = -15.775440, -47.779763 // Paranoá como destino padrão
	}

	client := &http.Client{Timeout: 8 * time.Second}
	reqURL := fmt.Sprintf("https://router.project-osrm.org/route/v1/driving/%f,%f;%f,%f?overview=full&geometries=geojson", lon1, lat1, lon2, lat2)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "SGM_PRO_FieldService/1.0 (contato@sgmpro.com.br)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var osrm osrmFullResponse
	if err := json.NewDecoder(resp.Body).Decode(&osrm); err != nil || osrm.Code != "Ok" || len(osrm.Routes) == 0 {
		return nil, fmt.Errorf("falha ao obter rota do servidor viário")
	}

	route := osrm.Routes[0]
	km := math.Round((route.Distance/1000.0)*10) / 10
	dur := int(math.Round(route.Duration / 60.0))
	if dur < 1 {
		dur = 1
	}

	// Inverte coordenadas do GeoJSON [lon, lat] para o padrão Leaflet [lat, lon]
	var coordsLeaflet [][]float64
	for _, p := range route.Geometry.Coordinates {
		if len(p) >= 2 {
			coordsLeaflet = append(coordsLeaflet, []float64{p[1], p[0]})
		}
	}

	nomeVia := "Rota principal"
	if len(route.Legs) > 0 && route.Legs[0].Summary != "" {
		nomeVia = route.Legs[0].Summary
	}

	tarifa, _, _ := calcularTarifaUber(km, float64(dur))
	mapsURL := fmt.Sprintf("https://www.google.com/maps/dir/?api=1&origin=%f,%f&destination=%f,%f", lat1, lon1, lat2, lon2)

	return &DetalhesRota{
		DistanciaKm:    km,
		DuracaoMinutos: dur,
		Tarifa:         tarifa,
		Coordenadas:    coordsLeaflet,
		NomeVia:        nomeVia,
		GoogleMapsURL:  mapsURL,
	}, nil
}

type ParadaRota struct {
	OSID             uint    `json:"os_id"`
	ClienteNome      string  `json:"cliente_nome"`
	Endereco         string  `json:"endereco"`
	Latitude         float64 `json:"latitude"`
	Longitude        float64 `json:"longitude"`
	HoraAgendada     string  `json:"hora_agendada"`
	OrdemIndex       int     `json:"ordem_index"`
	TempoEstimadoMin int     `json:"tempo_estimado_min"`
	CustoMedidor     float64 `json:"custo_medidor"`
}

type TrechoRota struct {
	Indice         int     `json:"indice"`
	OrigemNome     string  `json:"origem_nome"`
	DestinoNome    string  `json:"destino_nome"`
	DistanciaKm    float64 `json:"distancia_km"`
	DuracaoMinutos int     `json:"duracao_minutos"`
	NomeVia        string  `json:"nome_via"`
	TarifaEstimada float64 `json:"tarifa_estimada"`
}

type RotaMultiParadas struct {
	TotalKm           float64      `json:"total_km"`
	TotalDuracaoMin   int          `json:"total_duracao_min"`
	TotalTarifa       float64      `json:"total_tarifa"`
	TotalTempoObraMin int          `json:"total_tempo_obra_min"`
	Coordenadas       [][]float64  `json:"coordenadas"` // [[lat, lon], ...]
	Trechos           []TrechoRota `json:"trechos"`
	Paradas           []ParadaRota `json:"paradas"`
	GoogleMapsURL     string       `json:"google_maps_url"`
}

// ObterRotaMultiParadas calcula a rota viária encadeada para múltiplas paradas
func ObterRotaMultiParadas(origemLat, origemLon float64, paradas []ParadaRota) (*RotaMultiParadas, error) {
	if len(paradas) == 0 {
		return &RotaMultiParadas{
			Coordenadas: [][]float64{},
			Trechos:     []TrechoRota{},
			Paradas:     []ParadaRota{},
		}, nil
	}

	if origemLat == 0 && origemLon == 0 {
		origemLat = FallbackLatBSB
		origemLon = FallbackLonBSB
	}

	// Monta a string de coordenadas para o OSRM: lon0,lat0;lon1,lat1;lon2,lat2...
	coordPairs := []string{fmt.Sprintf("%f,%f", origemLon, origemLat)}
	for _, p := range paradas {
		pLat := p.Latitude
		pLon := p.Longitude
		if pLat == 0 && pLon == 0 {
			pLat = FallbackLatBSB
			pLon = FallbackLonBSB
		}
		coordPairs = append(coordPairs, fmt.Sprintf("%f,%f", pLon, pLat))
	}

	reqURL := fmt.Sprintf("https://router.project-osrm.org/route/v1/driving/%s?overview=full&geometries=geojson", strings.Join(coordPairs, ";"))
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "SGM_PRO_FieldService/1.0 (contato@sgmpro.com.br)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var osrm osrmFullResponse
	if err := json.NewDecoder(resp.Body).Decode(&osrm); err != nil || osrm.Code != "Ok" || len(osrm.Routes) == 0 {
		return nil, fmt.Errorf("falha ao calcular rota multi-paradas")
	}

	route := osrm.Routes[0]
	totalKm := math.Round((route.Distance/1000.0)*10) / 10
	totalDur := int(math.Round(route.Duration / 60.0))

	var coordsLeaflet [][]float64
	for _, p := range route.Geometry.Coordinates {
		if len(p) >= 2 {
			coordsLeaflet = append(coordsLeaflet, []float64{p[1], p[0]})
		}
	}

	var trechos []TrechoRota
	totalTarifa := 0.0
	totalTempoObra := 0

	for i, leg := range route.Legs {
		if i >= len(paradas) {
			break
		}
		origNome := "Sua Posição (Medidor)"
		if i > 0 && i-1 < len(paradas) {
			origNome = fmt.Sprintf("Parada %d: %s", i, paradas[i-1].ClienteNome)
		}
		destNome := fmt.Sprintf("Parada %d: %s", i+1, paradas[i].ClienteNome)

		legKm := math.Round((leg.Distance/1000.0)*10) / 10
		legDur := int(math.Round(leg.Duration / 60.0))
		if legDur < 1 {
			legDur = 1
		}
		legTarifa, _, _ := calcularTarifaUber(legKm, float64(legDur))
		totalTarifa += legTarifa

		via := "Via principal"
		if leg.Summary != "" {
			via = leg.Summary
		}

		trechos = append(trechos, TrechoRota{
			Indice:         i + 1,
			OrigemNome:     origNome,
			DestinoNome:    destNome,
			DistanciaKm:    legKm,
			DuracaoMinutos: legDur,
			NomeVia:        via,
			TarifaEstimada: legTarifa,
		})
	}

	for _, p := range paradas {
		if p.TempoEstimadoMin > 0 {
			totalTempoObra += p.TempoEstimadoMin
		} else {
			totalTempoObra += 60
		}
	}

	// Google Maps Multi-Stop URL
	var gmapsURL string
	if len(paradas) == 1 {
		gmapsURL = fmt.Sprintf("https://www.google.com/maps/dir/?api=1&origin=%f,%f&destination=%f,%f", origemLat, origemLon, paradas[0].Latitude, paradas[0].Longitude)
	} else {
		orig := fmt.Sprintf("%f,%f", origemLat, origemLon)
		dest := fmt.Sprintf("%f,%f", paradas[len(paradas)-1].Latitude, paradas[len(paradas)-1].Longitude)
		var intermediate []string
		for i := 0; i < len(paradas)-1; i++ {
			intermediate = append(intermediate, fmt.Sprintf("%f,%f", paradas[i].Latitude, paradas[i].Longitude))
		}
		gmapsURL = fmt.Sprintf("https://www.google.com/maps/dir/?api=1&origin=%s&destination=%s&waypoints=%s", orig, dest, strings.Join(intermediate, "|"))
	}

	return &RotaMultiParadas{
		TotalKm:           totalKm,
		TotalDuracaoMin:   totalDur,
		TotalTarifa:       math.Round(totalTarifa*100) / 100,
		TotalTempoObraMin: totalTempoObra,
		Coordenadas:       coordsLeaflet,
		Trechos:           trechos,
		Paradas:           paradas,
		GoogleMapsURL:     gmapsURL,
	}, nil
}

// GeocodificarEndereco converte um endereço em latitude e longitude (com fallback em Brasília)
func GeocodificarEndereco(endereco string) (float64, float64, error) {
	endereco = strings.TrimSpace(endereco)
	if endereco == "" {
		return FallbackLatBSB, FallbackLonBSB, nil
	}
	client := &http.Client{Timeout: 5 * time.Second}
	lat, lon, err := geocodificarNominatim(client, endereco)
	if err != nil {
		return FallbackLatBSB, FallbackLonBSB, err
	}
	return lat, lon, nil
}

// rotearOSRM busca distância em km e duração em minutos entre duas coordenadas
func rotearOSRM(client *http.Client, lat1, lon1, lat2, lon2 float64) (float64, float64, error) {
	reqURL := fmt.Sprintf("https://router.project-osrm.org/route/v1/driving/%f,%f;%f,%f?overview=false", lon1, lat1, lon2, lat2)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return 0, 0, err
	}
	req.Header.Set("User-Agent", "SGM_PRO_FieldService/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	var osrm osrmResponse
	if err := json.NewDecoder(resp.Body).Decode(&osrm); err != nil || osrm.Code != "Ok" || len(osrm.Routes) == 0 {
		return 0, 0, fmt.Errorf("falha ao traçar rota OSRM")
	}

	distKm := osrm.Routes[0].Distance / 1000.0
	durMin := osrm.Routes[0].Duration / 60.0
	return distKm, durMin, nil
}

// CalcularDeslocamentoDinamico calcula a taxa dinâmica de deslocamento, km total e tempo total
func CalcularDeslocamentoDinamico(origem string, destino string) (float64, float64, int) {
	origem = strings.TrimSpace(origem)
	destino = strings.TrimSpace(destino)

	if origem == "" {
		origem = FallbackEnderecoBSB
	}
	if destino == "" {
		destino = FallbackEnderecoBSB
	}

	client := &http.Client{Timeout: 6 * time.Second}
	apiKey := os.Getenv("GOOGLE_MAPS_API_KEY")

	// 1. Tentar via Google Maps API se chave estiver presente
	if apiKey != "" && apiKey != "COLOQUE_SUA_API_KEY_AQUI" {
		baseURL := "https://maps.googleapis.com/maps/api/distancematrix/json"
		reqURL := fmt.Sprintf("%s?origins=%s&destinations=%s&mode=driving&language=pt-BR&key=%s", baseURL, url.QueryEscape(origem), url.QueryEscape(destino), apiKey)

		resp, err := client.Get(reqURL)
		if err == nil {
			defer resp.Body.Close()
			var mapsData googleMapsResponse
			if err := json.NewDecoder(resp.Body).Decode(&mapsData); err == nil {
				if mapsData.Status == "OK" && len(mapsData.Rows) > 0 && len(mapsData.Rows[0].Elements) > 0 {
					elem := mapsData.Rows[0].Elements[0]
					if elem.Status == "OK" && elem.Distance.Value > 0 {
						kmIda := float64(elem.Distance.Value) / 1000.0
						minIda := float64(elem.Duration.Value) / 60.0
						return calcularTarifaUber(kmIda, minIda)
					}
				}
			}
		}
	}

	// 2. Fallback dinâmico: Geocodificação Nominatim + Roteamento OSRM
	lat1, lon1, err1 := geocodificarNominatim(client, origem)
	lat2, lon2, err2 := geocodificarNominatim(client, destino)
	if err1 == nil && err2 == nil {
		kmIda, minIda, errRoute := rotearOSRM(client, lat1, lon1, lat2, lon2)
		if errRoute == nil && kmIda > 0 {
			return calcularTarifaUber(kmIda, minIda)
		}
	}

	// 3. Fallback inteligente final (caso ambos os serviços online sofram timeout)
	// Estimativa razoável de rota urbana local: 10 km de ida (20 km total) e 25 min de trânsito
	return calcularTarifaUber(10.0, 25.0)
}

// CalcularTaxaGoogleMaps mantém retrocompatibilidade retornando apenas o valor monetário
func CalcularTaxaGoogleMaps(origem string, destino string) float64 {
	taxa, _, _ := CalcularDeslocamentoDinamico(origem, destino)
	return taxa
}
