package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// UserCreateRequest represents the payload for creating a user
type UserCreateRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// UserResetPasswordRequest represents the payload for resetting a user's password
type UserResetPasswordRequest struct {
	Username    string `json:"username"`
	NewPassword string `json:"newPassword"`
}

// UserChangePasswordRequest represents the payload for changing own password
type UserChangePasswordRequest struct {
	OldPassword string `json:"oldPassword"`
	NewPassword string `json:"newPassword"`
}

// CreateUser calls POST /users to create a new user (admin)
func (c *Client) CreateUser(reqBody UserCreateRequest) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users", c.BaseURL)
	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	request, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	resp, err := c.doRequest(request)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("only admin can create users")
	}
	if resp.StatusCode != http.StatusCreated {
		var apiErr map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		return nil, fmt.Errorf("API error: %v", apiErr)
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	return result, nil
}

// DeleteUser calls DELETE /users/delete/{username} (admin)
func (c *Client) DeleteUser(username string) error {
	url := fmt.Sprintf("%s/users/delete/%s", c.BaseURL, username)
	request, err := http.NewRequest("DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	resp, err := c.doRequest(request)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var apiErr map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		return fmt.Errorf("API error: %v", apiErr)
	}
	return nil
}

// ResetUserPassword calls POST /users/reset-password (admin)
func (c *Client) ResetUserPassword(reqBody UserResetPasswordRequest) error {
	url := fmt.Sprintf("%s/users/reset-password", c.BaseURL)
	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}
	request, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	resp, err := c.doRequest(request)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var apiErr map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		return fmt.Errorf("API error: %v", apiErr)
	}
	return nil
}

// ChangeOwnPassword calls POST /users/change-password (self)
func (c *Client) ChangeOwnPassword(reqBody UserChangePasswordRequest) error {
	url := fmt.Sprintf("%s/users/change-password", c.BaseURL)
	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}
	request, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	resp, err := c.doRequest(request)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var apiErr map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		return fmt.Errorf("API error: %v", apiErr)
	}
	return nil
}

// ListUsers calls GET /users (admin only)
func (c *Client) ListUsers() ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/users", c.BaseURL)
	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	resp, err := c.doRequest(request)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var apiErr map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		return nil, fmt.Errorf("API error: %v", apiErr)
	}
	var users []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	return users, nil
}
