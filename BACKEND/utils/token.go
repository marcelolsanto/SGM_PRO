package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// GerarTokenUnico gera um token criptograficamente seguro com fallback
func GerarTokenUnico() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}
