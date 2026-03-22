package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/utils"
	"github.com/golang-jwt/jwt/v5"
	"github.com/spf13/viper"
)

// normalizeBaseURL trims trailing slashes to avoid double slashes when joining paths.
func normalizeBaseURL(base string) string {
	return strings.TrimRight(base, "/")
}

// TokenResponse represents the response from the authentication endpoint
type TokenResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    int64  `json:"expiresAt"`
}

// Claims represents the JWT claims
type Claims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// Login authenticates with the Synkronus API and returns a token
func Login(username, password string) (*TokenResponse, error) {
	apiURL := normalizeBaseURL(utils.EnsureScheme(viper.GetString("api.url")))
	loginURL := fmt.Sprintf("%s/api/auth/login", apiURL)

	// Prepare login request
	loginData := map[string]string{
		"username": username,
		"password": password,
	}
	jsonData, err := json.Marshal(loginData)
	if err != nil {
		return nil, fmt.Errorf("error marshaling login data: %w", err)
	}

	// Create request with headers
	req, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating login request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	// Add x-formulus-version header (required by some servers)
	apiVersion := viper.GetString("api.version")
	if apiVersion != "" {
		req.Header.Set("x-formulus-version", apiVersion)
	}

	// Send login request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("login request failed for endpoint %s: %w", loginURL, err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("login failed for endpoint %s with status %d: %s", loginURL, resp.StatusCode, string(body))
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}

	// Parse response
	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("error parsing login response: %w\nResponse body: %s", err, string(body))
	}

	// Save token to viper config
	viper.Set("auth.token", tokenResp.Token)
	viper.Set("auth.refresh_token", tokenResp.RefreshToken)
	viper.Set("auth.expires_at", tokenResp.ExpiresAt)
	viper.WriteConfig()

	return &tokenResp, nil
}

// RefreshToken refreshes the JWT token
func RefreshToken() (*TokenResponse, error) {
	apiURL := normalizeBaseURL(utils.EnsureScheme(viper.GetString("api.url")))
	refreshURL := fmt.Sprintf("%s/api/auth/refresh", apiURL)
	refreshToken := viper.GetString("auth.refresh_token")

	// Prepare refresh request
	refreshData := map[string]string{
		"refreshToken": refreshToken, // Updated to match API expectations
	}
	jsonData, err := json.Marshal(refreshData)
	if err != nil {
		return nil, fmt.Errorf("error marshaling refresh data: %w", err)
	}

	// Create request with headers
	req, err := http.NewRequest("POST", refreshURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	// Add x-formulus-version header (required by some servers)
	apiVersion := viper.GetString("api.version")
	if apiVersion != "" {
		req.Header.Set("x-formulus-version", apiVersion)
	}

	// Send refresh request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token refresh failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Read the response body for debugging
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}

	// Parse response
	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("error parsing refresh response: %w\nResponse body: %s", err, string(body))
	}

	// Save token to viper config
	viper.Set("auth.token", tokenResp.Token)
	viper.Set("auth.refresh_token", tokenResp.RefreshToken)
	viper.Set("auth.expires_at", tokenResp.ExpiresAt)
	viper.WriteConfig()

	return &tokenResp, nil
}

// GetToken returns the current token, refreshing it if necessary
func GetToken() (string, error) {
	token := viper.GetString("auth.token")
	expiresAt := viper.GetInt64("auth.expires_at")

	// If token is empty or about to expire, try to refresh it
	if token == "" || time.Now().Unix() > expiresAt-60 {
		refreshToken := viper.GetString("auth.refresh_token")
		if refreshToken == "" {
			return "", fmt.Errorf("no valid token available, please login first")
		}

		tokenResp, err := RefreshToken()
		if err != nil {
			return "", fmt.Errorf("failed to refresh token: %w", err)
		}
		return tokenResp.Token, nil
	}

	return token, nil
}

// GetUserInfo extracts user information from the JWT token
func GetUserInfo() (*Claims, error) {
	tokenString := viper.GetString("auth.token")
	if tokenString == "" {
		return nil, fmt.Errorf("no token available, please login first")
	}

	parser := jwt.NewParser()
	token, _, err := parser.ParseUnverified(tokenString, &Claims{})
	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if claims, ok := token.Claims.(*Claims); ok {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}

// Logout clears the authentication tokens
func Logout() error {
	viper.Set("auth.token", "")
	viper.Set("auth.refresh_token", "")
	viper.Set("auth.expires_at", 0)
	return viper.WriteConfig()
}
