package main

import (
	"fmt"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	// If password provided as argument, use it; otherwise use defaults
	passwords := []string{"admin", "password123"}
	if len(os.Args) > 1 {
		passwords = os.Args[1:]
	}

	for _, password := range passwords {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash password: %v", err)
		}
		fmt.Printf("Password: %s\nHash: %s\n\n", password, string(hash))
	}
}
