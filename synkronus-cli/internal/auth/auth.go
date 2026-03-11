package auth

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/spf13/viper"
)

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

// getFormulusVersion returns the version to send in X-Formulus-Version header (required by Synkronus).
// Falls back to a valid semver when config isn't loaded yet.
func getFormulusVersion() string {
	if v := strings.TrimSpace(viper.GetString("api.version")); v != "" {
		return v
	}
	return "1.0.0"
}

type apiErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func parseAPIErrorMessage(body []byte) string {
	var apiErr apiErrorResponse
	if err := json.Unmarshal(body, &apiErr); err != nil {
		return ""
	}
	if msg := strings.TrimSpace(apiErr.Message); msg != "" {
		return msg
	}
	return strings.TrimSpace(apiErr.Error)
}

func formatLoginFailure(loginURL string, status int, body []byte) error {
	// Friendly, actionable auth failure message
	if status == http.StatusUnauthorized || status == http.StatusForbidden {
		return fmt.Errorf("authentication failed: invalid username or password")
	}

	// Use JSON {message,error} if present (e.g. version mismatch middleware)
	if msg := parseAPIErrorMessage(body); msg != "" {
		return fmt.Errorf("login failed: %s", msg)
	}

	trimmed := strings.TrimSpace(string(body))
	if trimmed != "" {
		return fmt.Errorf("login failed (status %d): %s", status, trimmed)
	}
	return fmt.Errorf("login failed for endpoint %s with status %d", loginURL, status)
}

func isNetworkConnectivityError(err error) bool {
	// Unwrap common net/http errors
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		err = urlErr.Err
	}

	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		return true
	}

	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}

	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "no such host") ||
		strings.Contains(msg, "connection refused") ||
		strings.Contains(msg, "network is unreachable") ||
		strings.Contains(msg, "i/o timeout") ||
		strings.Contains(msg, "tls handshake timeout") {
		return true
	}
	return false
}

// Login authenticates with the Synkronus API and returns a token
func Login(username, password string) (*TokenResponse, error) {
	apiURL := viper.GetString("api.url")
	loginURL := fmt.Sprintf("%s/auth/login", apiURL)

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
	req.Header.Set("X-Formulus-Version", getFormulusVersion())

	// Send login request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		if isNetworkConnectivityError(err) {
			return nil, fmt.Errorf(
				"unable to reach API server: check your network connection and --api-url",
			)
		}
		return nil, fmt.Errorf("login request failed for endpoint %s: %w", loginURL, err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		// Ensure failed logins do not leave an existing session behind
		_ = Logout()
		return nil, formatLoginFailure(loginURL, resp.StatusCode, body)
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
	_ = viper.WriteConfig()

	return &tokenResp, nil
}

// RefreshToken refreshes the JWT token
func RefreshToken() (*TokenResponse, error) {
	apiURL := viper.GetString("api.url")
	refreshURL := fmt.Sprintf("%s/auth/refresh", apiURL)
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
	req.Header.Set("X-Formulus-Version", getFormulusVersion())

	// Send refresh request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		if isNetworkConnectivityError(err) {
			return nil, fmt.Errorf(
				"unable to reach API server: check your network connection and --api-url",
			)
		}
		return nil, fmt.Errorf("refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		_ = Logout()
		// Refresh failures should prompt re-login rather than surfacing raw API responses.
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			return nil, fmt.Errorf("authentication failed: please run synk login")
		}
		if msg := parseAPIErrorMessage(body); msg != "" {
			return nil, fmt.Errorf("authentication failed: %s", msg)
		}
		trimmed := strings.TrimSpace(string(body))
		if trimmed != "" {
			return nil, fmt.Errorf("authentication failed (status %d): %s", resp.StatusCode, trimmed)
		}
		return nil, fmt.Errorf("authentication failed (status %d): please run synk login", resp.StatusCode)
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
	_ = viper.WriteConfig()

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
