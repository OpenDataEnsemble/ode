package auth

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/utils"
	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client/generated"
	"github.com/golang-jwt/jwt/v5"
	"github.com/spf13/viper"
)

func apiVersion() (string, error) {
	version := viper.GetString("api.version")
	if version == "" {
		return "", fmt.Errorf("api.version is required")
	}
	return version, nil
}

// RateLimitError indicates that Synkronus asked the client to back off.
type RateLimitError struct {
	RetryAfter time.Duration
}

func (e *RateLimitError) Error() string {
	if e.RetryAfter > 0 {
		return fmt.Sprintf("authentication rate limited; retry after %s", e.RetryAfter)
	}
	return "authentication rate limited; retry later"
}

func rateLimitError(response *http.Response) error {
	if response == nil || response.StatusCode != http.StatusTooManyRequests {
		return nil
	}
	value := response.Header.Get("Retry-After")
	if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 {
		return &RateLimitError{RetryAfter: time.Duration(seconds) * time.Second}
	}
	if retryAt, err := http.ParseTime(value); err == nil {
		return &RateLimitError{RetryAfter: time.Until(retryAt).Round(time.Second)}
	}
	return &RateLimitError{}
}

func persistAuthConfig() error {
	if err := viper.WriteConfig(); err != nil {
		return err
	}
	if path := viper.ConfigFileUsed(); path != "" {
		if err := os.Chmod(path, 0600); err != nil {
			return fmt.Errorf("secure config permissions: %w", err)
		}
	}
	return nil
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
	baseURL := utils.OriginURL(viper.GetString("api.url"))
	version, err := apiVersion()
	if err != nil {
		return nil, err
	}

	api, err := generated.NewClientWithResponses(baseURL)
	if err != nil {
		return nil, fmt.Errorf("error creating generated client: %w", err)
	}

	resp, err := api.LoginWithResponse(
		context.Background(),
		&generated.LoginParams{XOdeVersion: version},
		generated.LoginJSONRequestBody{
			Username: username,
			Password: password,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("login request failed: %w", err)
	}
	if err := rateLimitError(resp.HTTPResponse); err != nil {
		return nil, err
	}
	if resp.JSON200 == nil {
		return nil, fmt.Errorf("login failed with status %d", resp.StatusCode())
	}
	tokenResp := &TokenResponse{
		Token:        resp.JSON200.Token,
		RefreshToken: resp.JSON200.RefreshToken,
		ExpiresAt:    resp.JSON200.ExpiresAt,
	}

	viper.Set("auth.token", tokenResp.Token)
	viper.Set("auth.refresh_token", tokenResp.RefreshToken)
	viper.Set("auth.expires_at", tokenResp.ExpiresAt)
	if err := persistAuthConfig(); err != nil {
		return nil, fmt.Errorf("persist authentication: %w", err)
	}

	return tokenResp, nil
}

// RefreshToken refreshes the JWT token
func RefreshToken() (*TokenResponse, error) {
	baseURL := utils.OriginURL(viper.GetString("api.url"))
	refreshToken := viper.GetString("auth.refresh_token")
	version, err := apiVersion()
	if err != nil {
		return nil, err
	}

	api, err := generated.NewClientWithResponses(baseURL)
	if err != nil {
		return nil, fmt.Errorf("error creating generated client: %w", err)
	}

	resp, err := api.RefreshTokenWithResponse(
		context.Background(),
		&generated.RefreshTokenParams{XOdeVersion: version},
		generated.RefreshTokenJSONRequestBody{RefreshToken: refreshToken},
	)
	if err != nil {
		return nil, fmt.Errorf("refresh request failed: %w", err)
	}
	if err := rateLimitError(resp.HTTPResponse); err != nil {
		return nil, err
	}
	if resp.JSON200 == nil {
		return nil, fmt.Errorf("token refresh failed with status %d", resp.StatusCode())
	}
	tokenResp := &TokenResponse{
		Token:        resp.JSON200.Token,
		RefreshToken: resp.JSON200.RefreshToken,
		ExpiresAt:    resp.JSON200.ExpiresAt,
	}

	viper.Set("auth.token", tokenResp.Token)
	viper.Set("auth.refresh_token", tokenResp.RefreshToken)
	viper.Set("auth.expires_at", tokenResp.ExpiresAt)
	if err := persistAuthConfig(); err != nil {
		return nil, fmt.Errorf("persist authentication: %w", err)
	}

	return tokenResp, nil
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
	return persistAuthConfig()
}
