package utils

import "testing"

func TestAPIBaseURL(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{"https://example.com", "https://example.com/api"},
		{"https://example.com/", "https://example.com/api"},
		{"https://example.com/api", "https://example.com/api"},
		{"https://example.com/api/", "https://example.com/api"},
		{"http://localhost:8080", "http://localhost:8080/api"},
		{"", ""},
	}
	for _, tt := range tests {
		if got := APIBaseURL(tt.raw); got != tt.want {
			t.Errorf("APIBaseURL(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}

func TestOriginURL(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{"https://example.com", "https://example.com"},
		{"https://example.com/api", "https://example.com"},
		{"https://example.com/api/", "https://example.com"},
		{"http://localhost:8080/api", "http://localhost:8080"},
		{"", ""},
	}
	for _, tt := range tests {
		if got := OriginURL(tt.raw); got != tt.want {
			t.Errorf("OriginURL(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}
