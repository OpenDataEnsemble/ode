package sync

import (
	"net/http/httptest"
	"testing"
)

func TestParseClientRepositoryGeneration(t *testing.T) {
	body5 := int64(5)
	body2 := int64(2)
	bodyNeg := int64(-1)

	tests := []struct {
		name         string
		headerValue  string
		body         *int64
		want         int64
	}{
		{
			name:        "omitted header and body defaults to 1",
			headerValue: "",
			body:        nil,
			want:        DefaultRepositoryGeneration,
		},
		{
			name:        "body only",
			headerValue: "",
			body:        &body5,
			want:        5,
		},
		{
			name:        "header only",
			headerValue: "7",
			body:        nil,
			want:        7,
		},
		{
			name:        "header wins over body when both present",
			headerValue: "3",
			body:        &body5,
			want:        3,
		},
		{
			name:        "invalid header string falls back to default 1 (body ignored)",
			headerValue: "not-a-number",
			body:        &body2,
			want:        DefaultRepositoryGeneration,
		},
		{
			name:        "header zero is invalid uses default 1",
			headerValue: "0",
			body:        &body5,
			want:        DefaultRepositoryGeneration,
		},
		{
			name:        "negative body ignored uses default when no valid header",
			headerValue: "",
			body:        &bodyNeg,
			want:        DefaultRepositoryGeneration,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/", nil)
			if tc.headerValue != "" {
				req.Header.Set(HeaderRepositoryGeneration, tc.headerValue)
			}
			got := ParseClientRepositoryGeneration(req, tc.body)
			if got != tc.want {
				t.Fatalf("ParseClientRepositoryGeneration() = %d, want %d", got, tc.want)
			}
		})
	}
}
