package cmd

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/auth"
	"github.com/OpenDataEnsemble/ode/synkronus-cli/internal/utils"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	qrcode "github.com/yeqown/go-qrcode/v2"
	"github.com/yeqown/go-qrcode/writer/standard"
)

// encodeFRMLS replicates the FRMLS encoding used by the Formulus generateQR.ts script.
// Format: FRMLS:v:<b64(v)>;s:<b64(serverUrl)>;u:<b64(username)>;p:<b64(password)>;;
func encodeFRMLS(version int, serverURL, username, password string) string {
	b64 := func(s string) string {
		return base64.StdEncoding.EncodeToString([]byte(s))
	}

	parts := []string{
		fmt.Sprintf("v:%s", b64(fmt.Sprintf("%d", version))),
		fmt.Sprintf("s:%s", b64(serverURL)),
		fmt.Sprintf("u:%s", b64(username)),
		fmt.Sprintf("p:%s", b64(password)),
	}

	return "FRMLS:" + strings.Join(parts, ";") + ";;"
}

// deriveOutputFilename builds a safe default filename from the server URL, using only
// the hostname and path segments (no scheme or port), and appending .png.
func deriveOutputFilename(serverURL string) string {
	if serverURL == "" {
		return "formulus-qr.png"
	}

	parsed, err := url.Parse(serverURL)
	if err != nil {
		// If parsing fails, fall back to a very simple sanitization
		return sanitizeFilename(serverURL) + ".png"
	}

	host := parsed.Hostname()
	path := strings.Trim(parsed.EscapedPath(), "/")
	base := host
	if path != "" {
		// Replace path separators with underscores
		base = base + "_" + strings.ReplaceAll(path, "/", "_")
	}
	if base == "" {
		base = "formulus-qr"
	}

	return sanitizeFilename(base) + ".png"
}

// sanitizeFilename replaces characters that are problematic in filenames with '_'.
func sanitizeFilename(s string) string {
	if s == "" {
		return "formulus-qr"
	}

	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}

	result := b.String()
	if result == "" {
		return "formulus-qr"
	}
	return result
}

func init() {
	qrCmd := &cobra.Command{
		Use:   "qr",
		Short: "Generate a QR code image for configuring Formulus",
		Long: `Generate a QR code PNG file containing FRMLS-encoded settings
for the Formulus mobile app. The QR encodes server URL, username, and password.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			reader := bufio.NewReader(os.Stdin)

			// Defaults from current config / auth status
			defaultURL := viper.GetString("api.url")
			defaultUsername := ""
			if claims, err := auth.GetUserInfo(); err == nil {
				defaultUsername = claims.Username
			}

			// Prompt helper that shows a default and returns either user-entered value or default on empty input
			prompt := func(label, def string) (string, error) {
				if def != "" {
					fmt.Printf("%s [%s]: ", label, def)
				} else {
					fmt.Printf("%s: ", label)
				}
				line, err := reader.ReadString('\n')
				if err != nil {
					return "", err
				}
				line = strings.TrimSpace(line)
				if line == "" {
					return def, nil
				}
				return line, nil
			}

			serverURL, err := prompt("Server URL", defaultURL)
			if err != nil {
				return fmt.Errorf("error reading server URL: %w", err)
			}
			if serverURL == "" {
				return fmt.Errorf("server URL is required")
			}

			username, err := prompt("Username", defaultUsername)
			if err != nil {
				return fmt.Errorf("error reading username: %w", err)
			}
			if username == "" {
				return fmt.Errorf("username is required")
			}

			fmt.Print("Password: ")
			passwordLine, err := reader.ReadString('\n')
			if err != nil {
				return fmt.Errorf("error reading password: %w", err)
			}
			password := strings.TrimSpace(passwordLine)
			if password == "" {
				return fmt.Errorf("password is required")
			}

			encoded := encodeFRMLS(1, serverURL, username, password)

			outputFile, err := cmd.Flags().GetString("output")
			if err != nil {
				return fmt.Errorf("error reading output flag: %w", err)
			}
			if outputFile == "" {
				outputFile = deriveOutputFilename(serverURL)
			}

			// Generate QR code with logo using yeqown/go-qrcode
			logoPath := "qr_logo.png"
			qrc, err := qrcode.New(encoded)
			if err != nil {
				return fmt.Errorf("failed to create QR code: %w", err)
			}

			w, err := standard.New(outputFile, standard.WithLogoImageFilePNG(logoPath))
			if err != nil {
				return fmt.Errorf("failed to create QR writer: %w", err)
			}

			if err := qrc.Save(w); err != nil {
				return fmt.Errorf("failed to generate QR code image: %w", err)
			}

			utils.PrintSuccess("QR code generated successfully")
			fmt.Printf("%s\n", utils.FormatKeyValue("Output file", outputFile))
			return nil
		},
	}

	qrCmd.Flags().StringP("output", "o", "", "Output PNG file path (default derived from server URL)")
	rootCmd.AddCommand(qrCmd)
}
