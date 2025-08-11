package mocks

import (
	"context"

	"github.com/opendataensemble/synkronus/pkg/attachment"
)

// MockAttachmentManifestService is a mock implementation of attachment.ManifestService
type MockAttachmentManifestService struct {
	GetManifestFunc     func(ctx context.Context, req attachment.AttachmentManifestRequest) (*attachment.AttachmentManifestResponse, error)
	RecordOperationFunc func(ctx context.Context, attachmentID, operation, clientID string, size *int, contentType *string) error
	InitializeFunc      func(ctx context.Context) error
}

// GetManifest implements attachment.ManifestService
func (m *MockAttachmentManifestService) GetManifest(ctx context.Context, req attachment.AttachmentManifestRequest) (*attachment.AttachmentManifestResponse, error) {
	if m.GetManifestFunc != nil {
		return m.GetManifestFunc(ctx, req)
	}
	return &attachment.AttachmentManifestResponse{
		CurrentVersion:    42,
		Operations:        []attachment.AttachmentOperation{},
		TotalDownloadSize: 0,
		OperationCount: attachment.OperationCount{
			Download: 0,
			Delete:   0,
		},
	}, nil
}

// RecordOperation implements attachment.ManifestService
func (m *MockAttachmentManifestService) RecordOperation(ctx context.Context, attachmentID, operation, clientID string, size *int, contentType *string) error {
	if m.RecordOperationFunc != nil {
		return m.RecordOperationFunc(ctx, attachmentID, operation, clientID, size, contentType)
	}
	return nil
}

// Initialize implements attachment.ManifestService
func (m *MockAttachmentManifestService) Initialize(ctx context.Context) error {
	if m.InitializeFunc != nil {
		return m.InitializeFunc(ctx)
	}
	return nil
}
