package auth

import (
	"context"
	"fmt"
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
	if resp.JSON200 == nil {
		return nil, fmt.Errorf("login failed with status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	tokenResp := &TokenResponse{
		Token:        resp.JSON200.Token,
		RefreshToken: resp.JSON200.RefreshToken,
		ExpiresAt:    resp.JSON200.ExpiresAt,
	}

	// Save token to viper config
	viper.Set("auth.token", tokenResp.Token)
	viper.Set("auth.refresh_token", tokenResp.RefreshToken)
	viper.Set("auth.expires_at", tokenResp.ExpiresAt)
	viper.WriteConfig()

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
	if resp.JSON200 == nil {
		return nil, fmt.Errorf("token refresh failed with status %d: %s", resp.StatusCode(), string(resp.Body))
	}
	tokenResp := &TokenResponse{
		Token:        resp.JSON200.Token,
		RefreshToken: resp.JSON200.RefreshToken,
		ExpiresAt:    resp.JSON200.ExpiresAt,
	}

	// Save token to viper config
	viper.Set("auth.token", tokenResp.Token)
	viper.Set("auth.refresh_token", tokenResp.RefreshToken)
	viper.Set("auth.expires_at", tokenResp.ExpiresAt)
	viper.WriteConfig()

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
	return viper.WriteConfig()
}
