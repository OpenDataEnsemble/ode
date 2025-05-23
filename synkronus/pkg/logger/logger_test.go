package logger

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestLogger(t *testing.T) {
	// Create a buffer to capture log output
	var buf bytes.Buffer

	// Create a new logger with the buffer as output
	log := NewLogger(
		WithOutputWriter(&buf),
		WithLevel(LevelDebug),
		WithPrettyPrint(false),
	)

	// Test each log level
	tests := []struct {
		name     string
		logFunc  func(string, ...any)
		level    string
		message  string
		expected bool
	}{
		{"Debug", log.Debug, "DEBUG", "debug message", true},
		{"Info", log.Info, "INFO", "info message", true},
		{"Warn", log.Warn, "WARN", "warn message", true},
		{"Error", log.Error, "ERROR", "error message", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear the buffer
			buf.Reset()

			// Call the log function
			tt.logFunc(tt.message, "key", "value")

			// Check if log was written
			output := buf.String()
			if tt.expected {
				if !strings.Contains(output, tt.level) {
					t.Errorf("Expected output to contain %s, got %s", tt.level, output)
				}
				if !strings.Contains(output, tt.message) {
					t.Errorf("Expected output to contain %s, got %s", tt.message, output)
				}
				if !strings.Contains(output, "key") {
					t.Errorf("Expected output to contain 'key', got %s", output)
				}
				if !strings.Contains(output, "value") {
					t.Errorf("Expected output to contain 'value', got %s", output)
				}

				// Verify it's valid JSON
				var logEntry map[string]any
				err := json.Unmarshal(buf.Bytes(), &logEntry)
				if err != nil {
					t.Errorf("Failed to unmarshal JSON: %v", err)
				}

				// Check fields
				if logEntry["level"] != tt.level {
					t.Errorf("Expected level %s, got %s", tt.level, logEntry["level"])
				}
				if logEntry["message"] != tt.message {
					t.Errorf("Expected message %s, got %s", tt.message, logEntry["message"])
				}
				if logEntry["key"] != "value" {
					t.Errorf("Expected key value to be 'value', got %s", logEntry["key"])
				}
			} else {
				if output != "" {
					t.Errorf("Expected empty output, got %s", output)
				}
			}
		})
	}
}

func TestLogLevelFiltering(t *testing.T) {
	// Create a buffer to capture log output
	var buf bytes.Buffer

	// Create a new logger with Info level
	log := NewLogger(
		WithOutputWriter(&buf),
		WithLevel(LevelInfo),
	)

	// Debug should not be logged
	log.Debug("debug message")
	if buf.String() != "" {
		t.Errorf("Expected empty output for debug message, got %s", buf.String())
	}

	// Info should be logged
	buf.Reset()
	log.Info("info message")
	if buf.String() == "" {
		t.Error("Expected non-empty output for info message")
	}
	if !strings.Contains(buf.String(), "info message") {
		t.Errorf("Expected output to contain 'info message', got %s", buf.String())
	}
}

func TestShouldLog(t *testing.T) {
	tests := []struct {
		msgLevel    Level
		loggerLevel Level
		expected    bool
	}{
		{LevelDebug, LevelDebug, true},
		{LevelDebug, LevelInfo, false},
		{LevelInfo, LevelDebug, true},
		{LevelInfo, LevelInfo, true},
		{LevelWarn, LevelInfo, true},
		{LevelError, LevelWarn, true},
		{LevelFatal, LevelError, true},
	}

	for _, tt := range tests {
		t.Run(string(tt.msgLevel)+"_"+string(tt.loggerLevel), func(t *testing.T) {
			result := shouldLog(tt.msgLevel, tt.loggerLevel)
			if result != tt.expected {
				t.Errorf("shouldLog(%s, %s) = %v, want %v", tt.msgLevel, tt.loggerLevel, result, tt.expected)
			}
		})
	}
}
