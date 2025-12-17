package sync

import (
	"encoding/json"
	"testing"
)

func TestGeolocationSerialization(t *testing.T) {
	// Test complete geolocation data
	geo := &Geolocation{
		Latitude:         37.7749,
		Longitude:        -122.4194,
		Accuracy:         5.0,
		Altitude:         func() *float64 { v := 100.5; return &v }(),
		AltitudeAccuracy: func() *float64 { v := 3.0; return &v }(),
	}

	// Test JSON marshaling
	jsonData, err := json.Marshal(geo)
	if err != nil {
		t.Fatalf("Failed to marshal geolocation: %v", err)
	}

	// Test JSON unmarshaling
	var unmarshaled Geolocation
	err = json.Unmarshal(jsonData, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal geolocation: %v", err)
	}

	// Verify all fields
	if unmarshaled.Latitude != geo.Latitude {
		t.Errorf("Latitude mismatch: expected %f, got %f", geo.Latitude, unmarshaled.Latitude)
	}
	if unmarshaled.Longitude != geo.Longitude {
		t.Errorf("Longitude mismatch: expected %f, got %f", geo.Longitude, unmarshaled.Longitude)
	}
	if unmarshaled.Accuracy != geo.Accuracy {
		t.Errorf("Accuracy mismatch: expected %f, got %f", geo.Accuracy, unmarshaled.Accuracy)
	}
	if unmarshaled.Altitude == nil || *unmarshaled.Altitude != *geo.Altitude {
		t.Errorf("Altitude mismatch: expected %f, got %v", *geo.Altitude, unmarshaled.Altitude)
	}
	if unmarshaled.AltitudeAccuracy == nil || *unmarshaled.AltitudeAccuracy != *geo.AltitudeAccuracy {
		t.Errorf("AltitudeAccuracy mismatch: expected %f, got %v", *geo.AltitudeAccuracy, unmarshaled.AltitudeAccuracy)
	}
}

func TestGeolocationMinimalData(t *testing.T) {
	// Test minimal geolocation data (only required fields)
	geo := &Geolocation{
		Latitude:  40.7128,
		Longitude: -74.0060,
		Accuracy:  10.0,
		// Altitude and AltitudeAccuracy are nil (optional)
	}

	// Test JSON marshaling
	jsonData, err := json.Marshal(geo)
	if err != nil {
		t.Fatalf("Failed to marshal minimal geolocation: %v", err)
	}

	// Test JSON unmarshaling
	var unmarshaled Geolocation
	err = json.Unmarshal(jsonData, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal minimal geolocation: %v", err)
	}

	// Verify required fields
	if unmarshaled.Latitude != geo.Latitude {
		t.Errorf("Latitude mismatch: expected %f, got %f", geo.Latitude, unmarshaled.Latitude)
	}
	if unmarshaled.Longitude != geo.Longitude {
		t.Errorf("Longitude mismatch: expected %f, got %f", geo.Longitude, unmarshaled.Longitude)
	}
	if unmarshaled.Accuracy != geo.Accuracy {
		t.Errorf("Accuracy mismatch: expected %f, got %f", geo.Accuracy, unmarshaled.Accuracy)
	}

	// Verify optional fields are nil
	if unmarshaled.Altitude != nil {
		t.Errorf("Expected Altitude to be nil, got %v", unmarshaled.Altitude)
	}
	if unmarshaled.AltitudeAccuracy != nil {
		t.Errorf("Expected AltitudeAccuracy to be nil, got %v", unmarshaled.AltitudeAccuracy)
	}
}

func TestObservationWithGeolocation(t *testing.T) {
	// Test observation with geolocation
	obs := &Observation{
		ObservationID: "test-obs-123",
		FormType:      "location_form",
		FormVersion:   "1.0",
		Data:          json.RawMessage(`{"field1": "value1"}`),
		CreatedAt:     "2025-08-12T10:00:00Z",
		UpdatedAt:     "2025-08-12T10:00:00Z",
		Deleted:       false,
		Version:       1,
		Geolocation: &Geolocation{
			Latitude:  51.5074,
			Longitude: -0.1278,
			Accuracy:  8.5,
		},
	}

	// Test JSON marshaling
	jsonData, err := json.Marshal(obs)
	if err != nil {
		t.Fatalf("Failed to marshal observation with geolocation: %v", err)
	}

	// Test JSON unmarshaling
	var unmarshaled Observation
	err = json.Unmarshal(jsonData, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal observation with geolocation: %v", err)
	}

	// Verify geolocation is preserved
	if unmarshaled.Geolocation == nil {
		t.Fatal("Geolocation should not be nil after unmarshaling")
	}
	if unmarshaled.Geolocation.Latitude != obs.Geolocation.Latitude {
		t.Errorf("Geolocation latitude mismatch: expected %f, got %f",
			obs.Geolocation.Latitude, unmarshaled.Geolocation.Latitude)
	}
	if unmarshaled.Geolocation.Longitude != obs.Geolocation.Longitude {
		t.Errorf("Geolocation longitude mismatch: expected %f, got %f",
			obs.Geolocation.Longitude, unmarshaled.Geolocation.Longitude)
	}
}

func TestObservationWithoutGeolocation(t *testing.T) {
	// Test observation without geolocation (should be nil)
	obs := &Observation{
		ObservationID: "test-obs-456",
		FormType:      "simple_form",
		FormVersion:   "1.0",
		Data:          json.RawMessage(`{"field1": "value1"}`),
		CreatedAt:     "2025-08-12T10:00:00Z",
		UpdatedAt:     "2025-08-12T10:00:00Z",
		Deleted:       false,
		Version:       1,
		// Geolocation is nil
	}

	// Test JSON marshaling
	jsonData, err := json.Marshal(obs)
	if err != nil {
		t.Fatalf("Failed to marshal observation without geolocation: %v", err)
	}

	// Test JSON unmarshaling
	var unmarshaled Observation
	err = json.Unmarshal(jsonData, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal observation without geolocation: %v", err)
	}

	// Verify geolocation is nil
	if unmarshaled.Geolocation != nil {
		t.Errorf("Expected Geolocation to be nil, got %v", unmarshaled.Geolocation)
	}
}
