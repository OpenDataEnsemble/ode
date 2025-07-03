package logger

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"runtime"
	"sync"
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
	entryPool   sync.Pool
	bufferPool  sync.Pool
}

// entry represents a log entry
type entry struct {
	Timestamp string         `json:"timestamp"`
	Level     string         `json:"level"`
	Message   string         `json:"message"`
	Caller    string         `json:"caller,omitempty"`
	Fields    map[string]any `json:"-"`
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
		entryPool: sync.Pool{
			New: func() any {
				return &entry{
					Fields: make(map[string]any, 4),
				}
			},
		},
		bufferPool: sync.Pool{
			New: func() any {
				return bytes.NewBuffer(make([]byte, 0, 256)) // Pre-allocate buffer with initial capacity
			},
		},
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

// levelToInt converts a log level to an integer for comparison
func levelToInt(l Level) int {
	switch l {
	case LevelDebug:
		return 0
	case LevelInfo:
		return 1
	case LevelWarn:
		return 2
	case LevelError:
		return 3
	case LevelFatal:
		return 4
	default:
		return -1 // Unknown levels are always logged
	}
}

// shouldLog determines if a message at the given level should be logged
func shouldLog(msgLevel, loggerLevel Level) bool {
	msgLevelValue := levelToInt(msgLevel)
	loggerLevelValue := levelToInt(loggerLevel)

	// If level not found, default to allowing the log
	if msgLevelValue < 0 || loggerLevelValue < 0 {
		return true
	}

	return msgLevelValue >= loggerLevelValue
}

// getEntry gets a log entry from the pool
func (l *Logger) getEntry() *entry {
	e := l.entryPool.Get().(*entry)
	e.Timestamp = time.Now().Format(time.RFC3339)

	// Clear fields
	for k := range e.Fields {
		delete(e.Fields, k)
	}

	return e
}

// putEntry returns an entry to the pool
func (l *Logger) putEntry(e *entry) {
	l.entryPool.Put(e)
}

// log logs a message at the specified level with key-value pairs
func (l *Logger) log(level Level, msg string, args ...any) {
	// Fast path: check if we should log this level before any allocations
	if !shouldLog(level, l.level) {
		return
	}

	// Get an entry from the pool
	e := l.getEntry()
	e.Level = level.String()
	e.Message = msg

	// Add caller information
	if _, file, line, ok := runtime.Caller(2); ok {
		e.Caller = fmt.Sprintf("%s:%d", file, line)
	}

	// Process the variadic args as key-value pairs
	for i := 0; i < len(args); i += 2 {
		if i+1 < len(args) {
			if key, ok := args[i].(string); ok {
				e.Fields[key] = args[i+1]
			}
		} else {
			// If we have an odd number of args, add the last one with a generic key
			e.Fields[fmt.Sprintf("arg%d", i)] = args[i]
		}
	}

	// Get a buffer from the pool
	buf := l.bufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer l.bufferPool.Put(buf)

	// Encode the entry
	encoder := json.NewEncoder(buf)
	if l.prettyPrint {
		encoder.SetIndent("", "  ")
	}

	// Create a temporary map to hold all fields
	logData := make(map[string]any, len(e.Fields)+3)
	logData["timestamp"] = e.Timestamp
	logData["level"] = e.Level
	logData["message"] = e.Message
	if e.Caller != "" {
		logData["caller"] = e.Caller
	}

	// Add all fields
	for k, v := range e.Fields {
		logData[k] = v
	}

	// Encode to JSON
	if err := encoder.Encode(logData); err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling log entry: %v\n", err)
		l.putEntry(e)
		return
	}

	// Remove the trailing newline added by Encode()
	if buf.Len() > 0 && buf.Bytes()[buf.Len()-1] == '\n' {
		buf.Truncate(buf.Len() - 1)
	}

	// Write to output
	buf.WriteByte('\n')
	if _, err := l.out.Write(buf.Bytes()); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing log entry: %v\n", err)
	}

	// Return the entry to the pool
	l.putEntry(e)

	// Handle fatal level
	if level == LevelFatal {
		os.Exit(1)
	}
}
