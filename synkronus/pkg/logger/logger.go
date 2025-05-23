package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"runtime"
	"time"
)

// Fields is a map of key-value pairs to include in log entries
type Fields map[string]any

// Level represents the log level
type Level string

const (
	// LevelDebug logs detailed information for debugging
	LevelDebug Level = "DEBUG"
	// LevelInfo logs informational messages
	LevelInfo Level = "INFO"
	// LevelWarn logs warnings
	LevelWarn Level = "WARN"
	// LevelError logs error conditions
	LevelError Level = "ERROR"
	// LevelFatal logs critical errors and exits
	LevelFatal Level = "FATAL"
)

// String returns a string representation of the log level
func (l Level) String() string {
	return string(l)
}

// Logger provides structured JSON logging
type Logger struct {
	out         io.Writer
	level       Level
	prettyPrint bool
}

// Option is a function that configures a Logger
type Option func(*Logger)

// WithOutputWriter sets the output writer for the logger
func WithOutputWriter(out io.Writer) Option {
	return func(l *Logger) {
		l.out = out
	}
}

// WithLevel sets the log level
func WithLevel(level Level) Option {
	return func(l *Logger) {
		l.level = level
	}
}

// WithPrettyPrint enables or disables pretty printing of JSON logs
func WithPrettyPrint(pretty bool) Option {
	return func(l *Logger) {
		l.prettyPrint = pretty
	}
}

// NewLogger creates a new Logger with configuration options
func NewLogger(opts ...Option) *Logger {
	// Default configuration
	l := &Logger{
		out:         os.Stdout,
		level:       LevelInfo,
		prettyPrint: false,
	}

	// Apply options
	for _, opt := range opts {
		opt(l)
	}

	return l
}

// Debug logs a debug message
func (l *Logger) Debug(msg string, args ...any) {
	l.log(LevelDebug, msg, args...)
}

// Info logs an info message
func (l *Logger) Info(msg string, args ...any) {
	l.log(LevelInfo, msg, args...)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string, args ...any) {
	l.log(LevelWarn, msg, args...)
}

// Error logs an error message
func (l *Logger) Error(msg string, args ...any) {
	l.log(LevelError, msg, args...)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(msg string, args ...any) {
	l.log(LevelFatal, msg, args...)
	os.Exit(1)
}

// shouldLog determines if a message at the given level should be logged
func shouldLog(msgLevel, loggerLevel Level) bool {
	levels := map[Level]int{
		LevelDebug: 0,
		LevelInfo:  1,
		LevelWarn:  2,
		LevelError: 3,
		LevelFatal: 4,
	}

	msgLevelValue, msgOk := levels[msgLevel]
	loggerLevelValue, logOk := levels[loggerLevel]

	// If level not found, default to allowing the log
	if !msgOk || !logOk {
		return true
	}

	return msgLevelValue >= loggerLevelValue
}

// log logs a message at the specified level with key-value pairs
func (l *Logger) log(level Level, msg string, args ...any) {
	// Check if we should log this level
	if !shouldLog(level, l.level) {
		return
	}

	// Create a new entry
	entry := map[string]any{
		"timestamp": time.Now().Format(time.RFC3339),
		"level":     level.String(),
		"message":   msg,
	}

	// Add caller information
	if _, file, line, ok := runtime.Caller(2); ok {
		entry["caller"] = fmt.Sprintf("%s:%d", file, line)
	}

	// Process the variadic args as key-value pairs
	for i := 0; i < len(args); i += 2 {
		if i+1 < len(args) {
			if key, ok := args[i].(string); ok {
				entry[key] = args[i+1]
			}
		} else {
			// If we have an odd number of args, add the last one with a generic key
			entry[fmt.Sprintf("arg%d", i)] = args[i]
		}
	}

	// Encode as JSON
	var data []byte
	var err error
	if l.prettyPrint {
		data, err = json.MarshalIndent(entry, "", "  ")
	} else {
		data, err = json.Marshal(entry)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling log entry: %v\n", err)
		return
	}

	// Write to output
	fmt.Fprintln(l.out, string(data))
}
