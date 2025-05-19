package main

import (
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	passwords := []string{"admin", "password123"}

	for _, password := range passwords {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash password: %v", err)
		}
		fmt.Printf("Password: %s\nHash: %s\n\n", password, string(hash))
	}
}
