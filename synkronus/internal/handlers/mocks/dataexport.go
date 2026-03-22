package mocks

import (
	"context"
	"io"

	"github.com/opendataensemble/synkronus/pkg/dataexport"
)

// MockDataExportService is a mock implementation of dataexport.Service
type MockDataExportService struct {
	ExportParquetZipFunc func(ctx context.Context, w io.Writer) error
	ExportRawJSONZipFunc func(ctx context.Context, w io.Writer) error
}

// NewMockDataExportService creates a new mock data export service
func NewMockDataExportService() *MockDataExportService {
	return &MockDataExportService{}
}

// ExportParquetZip implements dataexport.Service
func (m *MockDataExportService) ExportParquetZip(ctx context.Context, w io.Writer) error {
	if m.ExportParquetZipFunc != nil {
		return m.ExportParquetZipFunc(ctx, w)
	}
	return nil
}

// ExportRawJSONZip implements dataexport.Service
func (m *MockDataExportService) ExportRawJSONZip(ctx context.Context, w io.Writer) error {
	if m.ExportRawJSONZipFunc != nil {
		return m.ExportRawJSONZipFunc(ctx, w)
	}
	return nil
}

// Ensure MockDataExportService implements dataexport.Service
var _ dataexport.Service = (*MockDataExportService)(nil)
