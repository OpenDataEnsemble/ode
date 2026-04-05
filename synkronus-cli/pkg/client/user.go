package client

import (
	"context"
	"fmt"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client/generated"
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
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}

	body := generated.CreateUserJSONRequestBody{
		Username: reqBody.Username,
		Password: reqBody.Password,
		Role:     generated.CreateUserJSONBodyRole(reqBody.Role),
	}

	resp, err := c.api.CreateUserWithResponse(
		context.Background(),
		&generated.CreateUserParams{XOdeVersion: version},
		body,
	)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode() == 403 {
		return nil, fmt.Errorf("only admin can create users")
	}
	if resp.JSON201 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMap(resp.JSON201)
}

// DeleteUser calls DELETE /users/delete/{username} (admin)
func (c *Client) DeleteUser(username string) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return err
	}
	resp, err := c.api.DeleteUserWithResponse(
		context.Background(),
		username,
		&generated.DeleteUserParams{XOdeVersion: version},
	)
	if err != nil {
		return err
	}
	if resp.StatusCode() != 200 {
		return apiError(resp.StatusCode(), resp.Body)
	}
	return nil
}

// ResetUserPassword calls POST /users/reset-password (admin)
func (c *Client) ResetUserPassword(reqBody UserResetPasswordRequest) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return err
	}

	body := generated.ResetUserPasswordJSONRequestBody{
		Username:    reqBody.Username,
		NewPassword: reqBody.NewPassword,
	}

	resp, err := c.api.ResetUserPasswordWithResponse(
		context.Background(),
		&generated.ResetUserPasswordParams{XOdeVersion: version},
		body,
	)
	if err != nil {
		return err
	}
	if resp.StatusCode() != 200 {
		return apiError(resp.StatusCode(), resp.Body)
	}
	return nil
}

// ChangeOwnPassword calls POST /users/change-password (self)
func (c *Client) ChangeOwnPassword(reqBody UserChangePasswordRequest) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return err
	}

	body := generated.ChangePasswordJSONRequestBody{
		CurrentPassword: reqBody.OldPassword,
		NewPassword:     reqBody.NewPassword,
	}

	resp, err := c.api.ChangePasswordWithResponse(
		context.Background(),
		&generated.ChangePasswordParams{XOdeVersion: version},
		body,
	)
	if err != nil {
		return err
	}
	if resp.StatusCode() != 200 {
		return apiError(resp.StatusCode(), resp.Body)
	}
	return nil
}

// ListUsers calls GET /users (admin only)
func (c *Client) ListUsers() ([]map[string]interface{}, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	version, err := c.requiredVersion()
	if err != nil {
		return nil, err
	}
	resp, err := c.api.ListUsersWithResponse(
		context.Background(),
		&generated.ListUsersParams{XOdeVersion: version},
	)
	if err != nil {
		return nil, err
	}
	if resp.JSON200 == nil {
		return nil, apiError(resp.StatusCode(), resp.Body)
	}
	return toMapSlice(*resp.JSON200)
}
