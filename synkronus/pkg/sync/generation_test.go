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
		name        string
		headerValue string
		body        *int64
		want        int64
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

// TestParseClientRepositoryGenerationSent exercises the "did the client send
// an epoch at all?" flag. This is the server-side half of the fresh-install
// fix: a brand-new Formulus install omits the header and body entirely, and
// the server must treat that as "adopt current", not as `1` that could
// mismatch a previously-reset server.
func TestParseClientRepositoryGenerationSent(t *testing.T) {
	body5 := int64(5)

	tests := []struct {
		name        string
		headerValue string
		body        *int64
		wantGen     int64
		wantSent    bool
	}{
		{
			name:        "omitted header and body => not sent, returns default",
			headerValue: "",
			body:        nil,
			wantGen:     DefaultRepositoryGeneration,
			wantSent:    false,
		},
		{
			name:        "valid header => sent",
			headerValue: "4",
			body:        nil,
			wantGen:     4,
			wantSent:    true,
		},
		{
			name:        "body only => sent",
			headerValue: "",
			body:        &body5,
			wantGen:     5,
			wantSent:    true,
		},
		{
			name:        "malformed header => treated as not sent, default gen",
			headerValue: "nope",
			body:        nil,
			wantGen:     DefaultRepositoryGeneration,
			wantSent:    false,
		},
		{
			name:        "header zero => treated as not sent, default gen",
			headerValue: "0",
			body:        nil,
			wantGen:     DefaultRepositoryGeneration,
			wantSent:    false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/", nil)
			if tc.headerValue != "" {
				req.Header.Set(HeaderRepositoryGeneration, tc.headerValue)
			}
			gotGen, gotSent := ParseClientRepositoryGenerationSent(req, tc.body)
			if gotGen != tc.wantGen || gotSent != tc.wantSent {
				t.Fatalf("ParseClientRepositoryGenerationSent() = (%d, %v), want (%d, %v)",
					gotGen, gotSent, tc.wantGen, tc.wantSent)
			}
		})
	}
}
