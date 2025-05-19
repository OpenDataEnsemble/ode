package utils

import (
	"fmt"

	"github.com/fatih/color"
)

var (
	// Success prints text in green
	Success = color.New(color.FgGreen).SprintFunc()
	// Error prints text in red
	Error = color.New(color.FgRed).SprintFunc()
	// Warning prints text in yellow
	Warning = color.New(color.FgYellow).SprintFunc()
	// Info prints text in bright white (for better readability on dark backgrounds)
	Info = color.New(color.FgHiGreen).SprintFunc()
	// Bold prints text in bold
	Bold = color.New(color.Bold).SprintFunc()
	// Heading prints text in cyan and bold
	Heading = color.New(color.FgCyan, color.Bold).SprintFunc()
	// Cyan prints text in cyan
	Cyan = color.New(color.FgCyan).SprintFunc()
	// Gray prints text in gray
	Gray = color.New(color.FgHiBlack).SprintFunc()
	// White prints text in white
	White = color.New(color.FgWhite).SprintFunc()
)

// SuccessIcon returns a green checkmark
func SuccessIcon() string {
	return Success("✓")
}

// ErrorIcon returns a red X
func ErrorIcon() string {
	return Error("✗")
}

// WarningIcon returns a yellow exclamation mark
func WarningIcon() string {
	return Warning("!")
}

// InfoIcon returns a blue information mark
func InfoIcon() string {
	return Info("i")
}

// PrintSuccess prints a success message with a green checkmark
func PrintSuccess(format string, a ...interface{}) {
	fmt.Printf("%s %s\n", SuccessIcon(), Success(fmt.Sprintf(format, a...)))
}

// PrintError prints an error message with a red X
func PrintError(format string, a ...interface{}) {
	fmt.Printf("%s %s\n", ErrorIcon(), Error(fmt.Sprintf(format, a...)))
}

// PrintWarning prints a warning message with a yellow exclamation mark
func PrintWarning(format string, a ...interface{}) {
	fmt.Printf("%s %s\n", WarningIcon(), Warning(fmt.Sprintf(format, a...)))
}

// PrintInfo prints an info message with a blue information mark
func PrintInfo(format string, a ...interface{}) {
	fmt.Printf("%s %s\n", InfoIcon(), Info(fmt.Sprintf(format, a...)))
}

// PrintHeading prints a heading in cyan and bold
func PrintHeading(format string, a ...interface{}) {
	fmt.Println(Heading(fmt.Sprintf(format, a...)))
}

// FormatKeyValue formats a key-value pair with the key in bold
func FormatKeyValue(key string, value interface{}) string {
	return fmt.Sprintf("%s: %v", Bold(key), value)
}
