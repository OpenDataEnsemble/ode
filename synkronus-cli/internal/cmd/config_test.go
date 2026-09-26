package cmd

import "testing"

func TestRedactConfigMap(t *testing.T) {
	settings := map[string]any{
		"api": map[string]any{"url": "https://example.test"},
		"auth": map[string]any{
			"token":         "access",
			"refresh_token": "refresh",
			"expires_at":    123,
		},
		"database_password": "password",
	}
	redacted := redactConfigMap(settings)
	auth := redacted["auth"].(map[string]any)
	if auth["token"] != "***REDACTED***" || auth["refresh_token"] != "***REDACTED***" {
		t.Fatalf("tokens were not redacted: %#v", auth)
	}
	if auth["expires_at"] != 123 {
		t.Fatalf("non-secret value changed: %#v", auth)
	}
	if redacted["database_password"] != "***REDACTED***" {
		t.Fatal("password was not redacted")
	}
}
