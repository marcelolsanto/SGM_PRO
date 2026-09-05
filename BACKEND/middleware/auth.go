package middleware

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func getJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "chave_padrao_desenvolvimento"
	}
	return []byte(secret)
}

// Auth valida o token JWT e popula usuario_id, perfil e ref_id no contexto
func Auth(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(401).JSON(fiber.Map{"erro": "Token não fornecido"})
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	if tokenString == authHeader && !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(401).JSON(fiber.Map{"erro": "Formato de token inválido"})
	}

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		return getJWTSecret(), nil
	})

	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"erro": "Token inválido ou expirado"})
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"erro": "Falha ao ler dados do token"})
	}

	idFloat, okID := claims["id"].(float64)
	perfil, okPerfil := claims["perfil"].(string)

	if !okID || !okPerfil {
		return c.Status(401).JSON(fiber.Map{"erro": "Token com dados incompletos"})
	}

	var refID float64
	if r, ok := claims["ref_id"].(float64); ok {
		refID = r
	}

	// Salva com tipos seguros
	c.Locals("usuario_id", uint(idFloat))
	c.Locals("perfil", perfil)
	c.Locals("ref_id", refID)

	return c.Next()
}

// AuthMiddleware é um alias para Auth para compatibilidade
var AuthMiddleware = Auth