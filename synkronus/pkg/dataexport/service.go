package dataexport

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/apache/arrow/go/v14/arrow"
	"github.com/apache/arrow/go/v14/arrow/array"
	"github.com/apache/arrow/go/v14/arrow/memory"
	"github.com/apache/arrow/go/v14/parquet"
	"github.com/apache/arrow/go/v14/parquet/pqarrow"
	"github.com/opendataensemble/synkronus/pkg/config"
)

// Service defines the interface for data export operations
type Service interface {
	// ExportParquetZip exports observations data as a ZIP file containing Parquet files per form type
	ExportParquetZip(ctx context.Context) (io.ReadCloser, error)
}

// service implements the Service interface
type service struct {
	db     DatabaseInterface
	config *config.Config
}

// NewService creates a new data export service
func NewService(db DatabaseInterface, cfg *config.Config) Service {
	return &service{
		db:     db,
		config: cfg,
	}
}

// ExportParquetZip exports observations data as a ZIP file containing Parquet files per form type
func (s *service) ExportParquetZip(ctx context.Context) (io.ReadCloser, error) {
	// Get all form types
	formTypes, err := s.db.GetFormTypes(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get form types: %w", err)
	}

	// Create ZIP buffer
	zipBuffer := &bytes.Buffer{}
	zipWriter := zip.NewWriter(zipBuffer)

	// Process each form type
	for _, formType := range formTypes {
		if err := s.exportFormTypeToZip(ctx, formType, zipWriter); err != nil {
			zipWriter.Close()
			return nil, fmt.Errorf("failed to export form type %s: %w", formType, err)
		}
	}

	// Close ZIP writer
	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("failed to close ZIP writer: %w", err)
	}

	// Return reader for the ZIP buffer
	return io.NopCloser(bytes.NewReader(zipBuffer.Bytes())), nil
}

// exportFormTypeToZip exports a single form type as a parquet file to the ZIP archive
func (s *service) exportFormTypeToZip(ctx context.Context, formType string, zipWriter *zip.Writer) error {
	// Get schema for this form type
	schema, err := s.db.GetFormTypeSchema(ctx, formType)
	if err != nil {
		return fmt.Errorf("failed to get schema for form type %s: %w", formType, err)
	}

	// Get observations for this form type
	observations, err := s.db.GetObservationsForFormType(ctx, formType, schema)
	if err != nil {
		return fmt.Errorf("failed to get observations for form type %s: %w", formType, err)
	}

	// Skip if no observations
	if len(observations) == 0 {
		return nil
	}

	// Create parquet file in ZIP
	filename := s.sanitizeFilename(formType) + ".parquet"
	zipFile, err := zipWriter.Create(filename)
	if err != nil {
		return fmt.Errorf("failed to create ZIP file entry %s: %w", filename, err)
	}

	// Write parquet data
	if err := s.writeParquetData(observations, schema, zipFile); err != nil {
		return fmt.Errorf("failed to write parquet data for %s: %w", formType, err)
	}

	return nil
}

// writeParquetData writes observation data as parquet format
func (s *service) writeParquetData(observations []ObservationRow, schema *FormTypeSchema, writer io.Writer) error {
	// Build Arrow schema
	arrowSchema := s.buildArrowSchema(schema)

	// Create Arrow record
	record, err := s.buildArrowRecord(observations, schema, arrowSchema)
	if err != nil {
		return fmt.Errorf("failed to build Arrow record: %w", err)
	}
	defer record.Release()

	// Write as Parquet
	props := parquet.NewWriterProperties()
	arrowProps := pqarrow.NewArrowWriterProperties(pqarrow.WithStoreSchema())

	pqWriter, err := pqarrow.NewFileWriter(arrowSchema, writer, props, arrowProps)
	if err != nil {
		return fmt.Errorf("failed to create parquet writer: %w", err)
	}
	defer pqWriter.Close()

	if err := pqWriter.Write(record); err != nil {
		return fmt.Errorf("failed to write parquet record: %w", err)
	}

	return nil
}

// buildArrowSchema creates an Arrow schema from the form type schema
func (s *service) buildArrowSchema(schema *FormTypeSchema) *arrow.Schema {
	fields := []arrow.Field{
		{Name: "observation_id", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "form_type", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "form_version", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "created_at", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "updated_at", Type: arrow.BinaryTypes.String, Nullable: false},
		{Name: "synced_at", Type: arrow.BinaryTypes.String, Nullable: true},
		{Name: "deleted", Type: arrow.FixedWidthTypes.Boolean, Nullable: false},
		{Name: "version", Type: arrow.PrimitiveTypes.Int64, Nullable: false},
		{Name: "geolocation", Type: arrow.BinaryTypes.String, Nullable: true},
	}

	// Add data fields
	for _, col := range schema.Columns {
		fieldName := "data_" + col.Key
		var fieldType arrow.DataType
		switch col.SQLType {
		case "numeric":
			fieldType = arrow.PrimitiveTypes.Float64
		case "boolean":
			fieldType = arrow.FixedWidthTypes.Boolean
		default:
			fieldType = arrow.BinaryTypes.String
		}
		fields = append(fields, arrow.Field{Name: fieldName, Type: fieldType, Nullable: true})
	}

	return arrow.NewSchema(fields, nil)
}

// buildArrowRecord creates an Arrow record from observations
func (s *service) buildArrowRecord(observations []ObservationRow, schema *FormTypeSchema, arrowSchema *arrow.Schema) (arrow.Record, error) {
	mem := memory.NewGoAllocator()
	builder := array.NewRecordBuilder(mem, arrowSchema)
	defer builder.Release()

	// Build base columns
	obsIDBuilder := builder.Field(0).(*array.StringBuilder)
	formTypeBuilder := builder.Field(1).(*array.StringBuilder)
	formVersionBuilder := builder.Field(2).(*array.StringBuilder)
	createdAtBuilder := builder.Field(3).(*array.StringBuilder)
	updatedAtBuilder := builder.Field(4).(*array.StringBuilder)
	syncedAtBuilder := builder.Field(5).(*array.StringBuilder)
	deletedBuilder := builder.Field(6).(*array.BooleanBuilder)
	versionBuilder := builder.Field(7).(*array.Int64Builder)
	geolocationBuilder := builder.Field(8).(*array.StringBuilder)

	for _, obs := range observations {
		obsIDBuilder.Append(obs.ObservationID)
		formTypeBuilder.Append(obs.FormType)
		formVersionBuilder.Append(obs.FormVersion)
		createdAtBuilder.Append(obs.CreatedAt)
		updatedAtBuilder.Append(obs.UpdatedAt)
		if obs.SyncedAt != nil {
			syncedAtBuilder.Append(*obs.SyncedAt)
		} else {
			syncedAtBuilder.AppendNull()
		}
		deletedBuilder.Append(obs.Deleted)
		versionBuilder.Append(obs.Version)
		if obs.Geolocation != nil {
			geolocationBuilder.Append(string(obs.Geolocation))
		} else {
			geolocationBuilder.AppendNull()
		}
	}

	// Build data field columns
	for i, col := range schema.Columns {
		fieldBuilder := builder.Field(9 + i)
		fieldName := "data_" + col.Key

		for _, obs := range observations {
			value, exists := obs.DataFields[fieldName]
			if !exists || value == nil {
				fieldBuilder.AppendNull()
				continue
			}

			switch col.SQLType {
			case "numeric":
				if fb, ok := fieldBuilder.(*array.Float64Builder); ok {
					if v, ok := value.(float64); ok {
						fb.Append(v)
					} else {
						fb.AppendNull()
					}
				}
			case "boolean":
				if fb, ok := fieldBuilder.(*array.BooleanBuilder); ok {
					if v, ok := value.(bool); ok {
						fb.Append(v)
					} else {
						fb.AppendNull()
					}
				}
			default:
				if fb, ok := fieldBuilder.(*array.StringBuilder); ok {
					if v, ok := value.(string); ok {
						fb.Append(v)
					} else {
						fb.Append(fmt.Sprintf("%v", value))
					}
				}
			}
		}
	}

	return builder.NewRecord(), nil
}

// sanitizeFilename sanitizes a form type name for use as a filename
func (s *service) sanitizeFilename(formType string) string {
	// Replace invalid filename characters
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	result := formType
	for _, char := range invalidChars {
		result = strings.ReplaceAll(result, char, "_")
	}
	// Limit length
	if len(result) > 100 {
		result = result[:100]
	}
	return result
}
