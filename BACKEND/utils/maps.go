package utils

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
)

type googleMapsResponse struct {
	Rows []struct {
		Elements []struct {
			Distance struct {
				Value int `json:"value"`
			} `json:"distance"`
			Status string `json:"status"`
		} `json:"elements"`
	} `json:"rows"`
	Status string `json:"status"`
}

// CalcularTaxaGoogleMaps calcula a taxa de deslocamento em reais baseada na distância em km
func CalcularTaxaGoogleMaps(origem string, destino string) float64 {
	apiKey := os.Getenv("GOOGLE_MAPS_API_KEY")
	precoPorKm := 1.50
	taxaPadrao := 25.00

	if apiKey == "" || apiKey == "COLOQUE_SUA_API_KEY_AQUI" {
		return taxaPadrao
	}

	baseURL := "https://maps.googleapis.com/maps/api/distancematrix/json"
	reqURL := fmt.Sprintf("%s?origins=%s&destinations=%s&key=%s", baseURL, url.QueryEscape(origem), url.QueryEscape(destino), apiKey)

	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(reqURL)
	if err != nil {
		fmt.Println("⚠️ Google Maps timeout/falha. Utilizando taxa padrão de deslocamento.")
		return taxaPadrao
	}
	defer resp.Body.Close()

	var mapsData googleMapsResponse
	if err := json.NewDecoder(resp.Body).Decode(&mapsData); err != nil {
		return taxaPadrao
	}

	if mapsData.Status == "OK" && len(mapsData.Rows) > 0 && len(mapsData.Rows[0].Elements) > 0 {
		if mapsData.Rows[0].Elements[0].Status == "OK" {
			metros := mapsData.Rows[0].Elements[0].Distance.Value
			return (float64(metros) / 1000.0) * precoPorKm
		}
	}

	return taxaPadrao
}
