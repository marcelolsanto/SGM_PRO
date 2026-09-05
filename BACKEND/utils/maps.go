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

// GeocodificarEndereco converte um endereço em latitude e longitude (com fallback)
func GeocodificarEndereco(endereco string) (float64, float64, error) {
	endereco = strings.TrimSpace(endereco)
	if endereco == "" {
		return -23.550520, -46.633308, nil // Praça da Sé, SP como fallback
	}
	client := &http.Client{Timeout: 5 * time.Second}
	lat, lon, err := geocodificarNominatim(client, endereco)
	if err != nil {
		return -23.550520, -46.633308, err
	}
	return lat, lon, nil
}

// rotearOSRM busca distância em km e duração em minutos entre duas coordenadas
func rotearOSRM(client *http.Client, lat1, lon1, lat2, lon2 float64) (float64, float64, error) {
	reqURL := fmt.Sprintf("http://router.project-osrm.org/route/v1/driving/%f,%f;%f,%f?overview=false", lon1, lat1, lon2, lat2)
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
		origem = "Praça da Sé, São Paulo, SP"
	}
	if destino == "" {
		destino = "Praça da Sé, São Paulo, SP"
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
