package utils

import (
	"strings"

	"github.com/spf13/cobra"
)

// ColoredHelpTemplate is a custom help template with color formatting
var ColoredHelpTemplate = `{{Bold "NAME"}}
  {{.CommandPath}} - {{.Short}}

{{if .Long}}{{Bold "SYNOPSIS"}}
  {{.Long | Trim}}
{{end}}{{if .Runnable}}
{{Bold "USAGE"}}
  {{Info .UseLine}}{{end}}{{if .HasAvailableSubCommands}}
{{Bold "COMMANDS"}}{{range .Commands}}{{if (or .IsAvailableCommand (eq .Name "help"))}}
  {{Cyan .Name}}{{if .Short}} - {{.Short}}{{end}}{{end}}{{end}}{{end}}{{if .HasAvailableLocalFlags}}

{{Bold "FLAGS"}}
{{.LocalFlags.FlagUsages | Colorize}}{{end}}{{if .HasAvailableInheritedFlags}}

{{Bold "GLOBAL FLAGS"}}
{{.InheritedFlags.FlagUsages | Colorize}}{{end}}{{if .HasExample}}

{{Bold "EXAMPLES"}}
{{.Example | Colorize}}{{end}}{{if .HasHelpSubCommands}}

{{Bold "ADDITIONAL HELP TOPICS"}}{{range .Commands}}{{if .IsAdditionalHelpTopicCommand}}
  {{.CommandPath}} - {{.Short}}{{end}}{{end}}{{end}}{{if .HasAvailableSubCommands}}

Use "{{.CommandPath}} {{Cyan "[command]"}} --help" for more information about a command.{{end}}
`

// SetupColoredHelp configures the command to use the colored help template
func SetupColoredHelp(rootCmd *cobra.Command) {
	// Override the default help and usage templates
	cobra.AddTemplateFunc("Bold", Bold)
	cobra.AddTemplateFunc("Cyan", Cyan)
	cobra.AddTemplateFunc("Info", Info)
	cobra.AddTemplateFunc("Success", Success)
	cobra.AddTemplateFunc("Colorize", colorizeFlags)
	cobra.AddTemplateFunc("Trim", strings.TrimSpace)

	// Set the help template for the root command
	rootCmd.SetHelpTemplate(ColoredHelpTemplate)
	rootCmd.SetUsageTemplate(ColoredHelpTemplate)

	// Apply to all subcommands
	for _, cmd := range rootCmd.Commands() {
		applyTemplateRecursive(cmd)
	}
}

// applyTemplateRecursive applies the colored help template to a command and its subcommands
func applyTemplateRecursive(cmd *cobra.Command) {
	cmd.SetHelpTemplate(ColoredHelpTemplate)
	cmd.SetUsageTemplate(ColoredHelpTemplate)
	for _, subcmd := range cmd.Commands() {
		applyTemplateRecursive(subcmd)
	}
}

// colorizeFlags adds color to flag descriptions
func colorizeFlags(s string) string {
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		parts := strings.SplitN(line, "   ", 2)
		if len(parts) < 2 {
			continue
		}

		// Color the flag name
		flagPart := parts[0]
		descPart := parts[1]

		// Highlight required flags
		descPart = strings.Replace(descPart, "[required]", Warning("[required]"), 1)

		// Format the flag part
		if strings.HasPrefix(flagPart, "-") {
			flagPart = Cyan(flagPart)
		}

		lines[i] = flagPart + "   " + descPart
	}
	return strings.Join(lines, "\n")
}
