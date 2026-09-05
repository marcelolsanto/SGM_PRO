package middleware

import (
	"log"
	"time"
	"github.com/gofiber/fiber/v2"
)

func Logger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		log.Printf("| %s | %s | %s | %s", c.Method(), c.Path(), time.Since(start), c.IP())
		return err
	}
}