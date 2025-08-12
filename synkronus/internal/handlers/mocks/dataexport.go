package mocks

import (
	"context"
	"io"

	"github.com/opendataensemble/synkronus/pkg/dataexport"
)

// MockDataExportService is a mock implementation of dataexport.Service
type MockDataExportService struct {
	ExportParquetZipFunc func(ctx context.Context) (io.ReadCloser, error)
}

// NewMockDataExportService creates a new mock data export service
func NewMockDataExportService() *MockDataExportService {
	return &MockDataExportService{}
}

// ExportParquetZip implements dataexport.Service
func (m *MockDataExportService) ExportParquetZip(ctx context.Context) (io.ReadCloser, error) {
	if m.ExportParquetZipFunc != nil {
		return m.ExportParquetZipFunc(ctx)
	}
	return io.NopCloser(io.LimitReader(nil, 0)), nil
}

// Ensure MockDataExportService implements dataexport.Service
var _ dataexport.Service = (*MockDataExportService)(nil)
