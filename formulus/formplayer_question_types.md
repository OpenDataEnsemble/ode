# Formplayer Question Types

This document describes the supported question types in the Formplayer React application and how to implement them in your JSON schemas.

## Overview

The Formplayer supports various question types through custom renderers that integrate with the Formulus React Native app. Each question type is identified by a specific `format` property in the JSON schema.

## Supported Question Types

### 1. Photo Questions

Allows users to capture photos using the device camera.

**Schema Definition:**

```json
{
  "profilePhoto": {
    "type": "object",
    "format": "photo",
    "title": "Profile Photo",
    "description": "Take a photo for your profile"
  }
}
```

**UI Schema:**

```json
{
  "type": "Control",
  "scope": "#/properties/profilePhoto"
}
```

**Features:**

- Camera integration via React Native
- Photo preview with thumbnail display
- Retake and delete functionality
- GUID-based filename generation
- Metadata storage (dimensions, size, etc.)

**Data Structure:**
The photo field stores a JSON object with the following structure:

```json
{
  "id": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "type": "image",
  "filename": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.jpg",
  "uri": "/storage/images/xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.jpg",
  "url": "file:///storage/images/xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx.jpg",
  "timestamp": "2025-01-14T08:30:00.000Z",
  "metadata": {
    "width": 1920,
    "height": 1080,
    "size": 2048576,
    "mimeType": "image/jpeg",
    "source": "camera",
    "quality": 0.8,
    "persistentStorage": true,
    "storageLocation": "/storage/images"
  }
}
```

### 2. QR Code Questions

Allows users to scan QR codes or enter QR code data manually.

**Schema Definition:**

```json
{
  "qrCodeData": {
    "type": "string",
    "format": "qrcode",
    "title": "QR Code Scanner",
    "description": "Scan a QR code or enter data manually"
  }
}
```

**UI Schema:**

```json
{
  "type": "Control",
  "scope": "#/properties/qrCodeData"
}
```

**Features:**

- QR code and barcode scanner integration via React Native
- Manual text input as fallback option
- Support for multiple barcode formats (see supported formats below)
- Real-time validation
- Cancel operation support

**Supported Barcode Formats:**

- **QR Code** - Quick Response codes (most common)
- **Code 128** - Linear barcode used for product identification
- **Code 39** - Alphanumeric barcode standard
- **EAN-13** - European Article Number (product barcodes)
- **EAN-8** - Short version of EAN-13
- **UPC-A** - Universal Product Code (North American products)
- **UPC-E** - Compressed version of UPC-A
- **Data Matrix** - 2D barcode for small items
- **PDF417** - Stacked linear barcode (driver's licenses, ID cards)
- **Aztec** - 2D barcode used for transport tickets

**Data Structure:**
The QR code field stores a simple string value:

```json
"https://example.com"
```

**Example QR Code Values:**

- URLs: `"https://example.com"`
- Plain text: `"Hello World!"`
- JSON data: `"{\"type\":\"contact\",\"name\":\"John Doe\",\"phone\":\"123-456-7890\"}"`
- WiFi configuration: `"WIFI:T:WPA;S:MyNetwork;P:password123;;"`

### 3. Signature Questions

Signature questions allow users to capture digital signatures using either the device's native signature capture or a web-based canvas drawing interface.

**Schema Format:**

```json
{
  "customerSignature": {
    "type": "object",
    "format": "signature",
    "title": "Customer Signature",
    "description": "Please provide your signature"
  }
}
```

**UI Schema:**

```json
{
  "type": "Control",
  "scope": "#/properties/customerSignature"
}
```

**Features:**

- Native signature capture using `react-native-signature-canvas`
- Web-based canvas drawing with touch/mouse support
- Dual capture modes: Native (React Native) and Canvas (Web)
- Signature preview and validation
- Clear/retry functionality
- Mock implementation for development/testing
- Automatic GUID generation for signature files

**Capture Methods:**

1. **Native Signature Capture**: Full-screen signature pad optimized for mobile devices
2. **Canvas Drawing**: Browser-based signature drawing with touch and mouse support

**Data Structure:**
Signatures are stored as objects containing:

```json
{
  "type": "signature",
  "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
  "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "metadata": {
    "width": 400,
    "height": 200,
    "size": 12345,
    "strokeCount": 1
  }
}
```

**Dependencies:**

- `react-native-signature-canvas`: For native signature capture functionality

### 4. File Selection Question

The File Selection question type allows users to select files from their device using native file picker dialogs. This question type is designed to handle file URIs efficiently without base64 encoding, making it suitable for large files.

**Schema Definition:**

```json
{
  "type": "object",
  "properties": {
    "documentUpload": {
      "type": "string",
      "format": "select_file",
      "title": "Upload Document",
      "description": "Select a document to upload"
    }
  }
}
```

**UI Schema:**

```json
{
  "documentUpload": {
    "ui:widget": "file",
    "ui:options": {
      "accept": "*/*",
      "multiple": false
    }
  }
}
```

**Features:**

- Native File Picker: Uses platform-specific file selection dialogs
- URI-Based Storage: Files are stored as URIs, not base64 encoded data
- File Metadata: Captures filename, size, MIME type, and timestamp
- Error Handling: Supports cancellation and error states
- File Preview: Shows selected file information with replace/delete options
- Mock Support: Interactive simulation for development testing

**Data Structure:**
When a file is selected, the field value becomes a structured object:

```json
{
  "filename": "document.pdf",
  "uri": "file:///path/to/cached/document.pdf",
  "size": 1024000,
  "mimeType": "application/pdf",
  "type": "file",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Dependencies:**

- `react-native-document-picker`: For native file selection functionality

### 5. Audio Recording Question

The Audio Recording question type allows users to record audio directly within forms using the device's microphone. This question type provides a complete audio recording and playback interface with URI-based storage for efficient file handling.

**Schema Definition:**

```json
{
  "type": "object",
  "properties": {
    "voiceNote": {
      "type": "string",
      "format": "audio",
      "title": "Voice Note",
      "description": "Record a voice message"
    }
  }
}
```

**UI Schema:**

```json
{
  "voiceNote": {
    "ui:widget": "audio",
    "ui:options": {
      "maxDuration": 300,
      "quality": "high"
    }
  }
}
```

**Features:**

- Native Audio Recording: Uses device microphone with high-quality recording
- Audio Playback: Built-in player with play/pause/stop controls
- Progress Visualization: Real-time progress bar during playback
- File Metadata: Captures duration, format, file size, and timestamp
- Replace/Delete: Options to re-record or remove audio
- Error Handling: Comprehensive permission and recording error management
- Mock Support: Interactive simulation for development testing

**Recording Interface:**

- Large microphone button for easy recording initiation
- Visual feedback during recording process
- Loading states and progress indicators
- Permission handling for microphone access

**Playback Interface:**

- Audio file information display (filename, duration, format, size)
- Play/pause/stop controls with visual feedback
- Progress bar showing current playback position
- Time display (current time / total duration)

**Data Structure:**
When audio is recorded, the field value becomes a structured object:

```json
{
  "type": "audio",
  "filename": "audio_1642234567890.m4a",
  "uri": "file:///path/to/audio/cache/audio_1642234567890.m4a",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "metadata": {
    "duration": 15.5,
    "format": "m4a",
    "size": 245760
  }
}
```

**Audio Result Properties:**

- `filename`: Generated filename for the audio recording
- `uri`: File URI for accessing the audio content
- `timestamp`: ISO timestamp of when recording was completed
- `metadata.duration`: Recording duration in seconds
- `metadata.format`: Audio file format (m4a, wav, etc.)
- `metadata.size`: File size in bytes

**Dependencies:**

- `react-native-nitro-sound`: For native audio recording and playback functionality

### 6. Swipe Layout

Organizes form elements into swipeable pages for better mobile UX.

**UI Schema:**

```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "VerticalLayout",
      "elements": [
        {
          "type": "Label",
          "text": "Basic Information"
        },
        {
          "type": "Control",
          "scope": "#/properties/name"
        },
        {
          "type": "Control",
          "scope": "#/properties/profilePhoto"
        },
        {
          "type": "Control",
          "scope": "#/properties/qrCodeData"
        }
      ]
    },
    {
      "type": "VerticalLayout",
      "elements": [
        {
          "type": "Label",
          "text": "Additional Details"
        },
        {
          "type": "Control",
          "scope": "#/properties/email"
        }
      ]
    },
    {
      "type": "Finalize"
    }
  ]
}
```

**Features:**

- Horizontal swipe navigation between form pages
- Progress indicators
- Automatic validation on page change
- Finalize page for form submission

### 4. Finalize Renderer

Provides form submission functionality with validation.

**UI Schema:**

```json
{
  "type": "Finalize"
}
```

**Features:**

- Form validation before submission
- Error navigation (jumps to pages with validation errors)
- Submit button with loading states
- Integration with Formulus observation system

## GPS/Location Question Type

The GPS question type allows users to capture their current GPS coordinates including latitude, longitude, altitude, accuracy, and timestamp information.

### Schema Definition

```json
{
  "currentLocation": {
    "type": "string",
    "format": "gps",
    "title": "Current Location",
    "description": "Capture your current GPS coordinates"
  }
}
```

### UI Schema (Optional)

```json
{
  "currentLocation": {
    "ui:widget": "gps",
    "ui:options": {
      "label": "Capture GPS Location",
      "description": "This will request your device's current GPS coordinates"
    }
  }
}
```

### Features

- **GPS Coordinate Capture**: Captures latitude, longitude with high precision
- **Altitude Information**: Includes altitude and altitude accuracy when available
- **Accuracy Reporting**: Shows GPS accuracy in meters
- **Timestamp**: Records when the location was captured
- **Re-capture Support**: Allows users to capture location again
- **Delete Functionality**: Users can remove captured location data
- **Permission Handling**: Gracefully handles location permission requests
- **Error Management**: Clear error messages for permission denials or GPS failures

### Data Structure

The GPS question type stores location data as a JSON string with the following structure:

```json
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 5.0,
  "altitude": 52.0,
  "altitudeAccuracy": 3.0,
  "timestamp": "2023-10-15T14:30:00.000Z"
}
```

### Dependencies

- **React Native**: Uses native Geolocation API through `GeolocationService`
- **Permissions**: Requires location permissions on device
- **GeolocationService**: Leverages existing location service infrastructure

### Usage Examples

#### Basic GPS Field

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "siteLocation": {
        "type": "string",
        "format": "gps",
        "title": "Site Location"
      }
    }
  }
}
```

#### GPS Field with Custom UI

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "inspectionLocation": {
        "type": "string",
        "format": "gps",
        "title": "Inspection Location",
        "description": "Record the exact location where this inspection was conducted"
      }
    }
  },
  "uischema": {
    "inspectionLocation": {
      "ui:options": {
        "label": "Capture Inspection Location"
      }
    }
  }
}
```

## Implementation Guide

When adding new question types to the Formplayer, follow this established pattern:

1. **Define Result Interfaces**: Create `*ResultData` and `*Result` types in `FormulusInterfaceDefinition.ts`
2. **Update FormulusInterface**: Add `request*` method returning `Promise<*Result>`
3. **Update FormulusClient**: Implement client-side request forwarding
4. **Create React Component**: Build UI renderer following existing patterns
5. **Register Renderer**: Add to custom renderers array in `App.tsx`
6. **Add AJV Validation**: Include format validator for schema compliance
7. **Mock Implementation**: Add development simulation in `webview-mock.ts`
8. **React Native Handler**: Implement native functionality in `FormulusMessageHandlers.ts`
9. **Update Documentation**: Document usage, schema, and features

This pattern ensures consistency across all question types and maintains the separation between WebView (React) and React Native components.

### Step-by-Step Implementation Process

Follow these steps in order to implement a new question type. Each step includes code templates and specific file locations.

#### Step 1: Define Result Interface and Types

**File:** `src/webview/FormulusInterfaceDefinition.ts` (in both formulus and formplayer projects)

Add the result data interface and type alias:

```typescript
// 1. Add the result data interface
export interface MyCustomResultData {
  type: 'mycustom'; // Unique identifier for this result type
  value: string; // The actual data (adjust type as needed)
  timestamp: string; // ISO timestamp of when the action completed
  // Add any additional fields specific to your question type
}

// 2. Add the result type alias
export type MyCustomResult = ActionResult<MyCustomResultData>;
```

**Template Variables to Replace:**

- `MyCustom` → Your question type name (PascalCase)
- `mycustom` → Your question type identifier (lowercase)
- `value: string` → Adjust the data type as needed for your question type

#### Step 2: Add Interface Method

**File:** `src/webview/FormulusInterfaceDefinition.ts` (in both projects)

Add the request method to the FormulusInterface:

```typescript
export interface FormulusInterface {
  // ... existing methods
  requestMyCustom(fieldId: string): Promise<MyCustomResult>;
}
```

#### Step 3: Update FormulusClient Implementation

**File:** `src/FormulusInterface.ts` (formplayer project only)

Add the import and implement the client method:

```typescript
// 1. Add import at the top
import {
  // ... existing imports
  MyCustomResult,
} from './webview/FormulusInterfaceDefinition';

// 2. Add method to FormulusClient class
export class FormulusClient {
  // ... existing methods

  public requestMyCustom(fieldId: string): Promise<MyCustomResult> {
    if (this.formulus) {
      return this.formulus.requestMyCustom(fieldId);
    } else {
      return Promise.reject({
        fieldId,
        status: 'error' as const,
        message: 'Formulus interface not available',
      });
    }
  }
}
```

#### Step 4: Create Mock Implementation

**File:** `src/webview-mock.ts` (formplayer project only)

Add mock support for development and testing:

```typescript
// 1. Add to imports
import {
  // ... existing imports
  MyCustomResult,
} from './webview/FormulusInterfaceDefinition';

// 2. Add pending promises map
private pendingMyCustomPromises: Map<string, {
  resolve: (result: MyCustomResult) => void;
  reject: (error: any) => void;
}> = new Map();

// 3. Add to MockFormulus interface
interface MockFormulus {
  // ... existing methods
  requestMyCustom: (fieldId: string) => Promise<MyCustomResult>;
}

// 4. Implement the mock method
requestMyCustom: (fieldId: string): Promise<MyCustomResult> => {
  return new Promise<MyCustomResult>((resolve, reject) => {
    this.pendingMyCustomPromises.set(fieldId, { resolve, reject });
    this.showMyCustomSimulationPopup(fieldId);
  });
},

// 5. Add simulation popup method
private showMyCustomSimulationPopup(fieldId: string): void {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000; font-family: Arial, sans-serif; text-align: center;
  `;

  popup.innerHTML = `
    <h3>🔧 MyCustom Simulation</h3>
    <p>Simulate your custom action for field: <strong>${fieldId}</strong></p>
    <div style="margin: 15px 0;">
      <button id="success-btn" style="margin: 5px; padding: 10px 15px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Success
      </button>
      <button id="cancel-btn" style="margin: 5px; padding: 10px 15px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Cancel
      </button>
      <button id="error-btn" style="margin: 5px; padding: 10px 15px; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Error
      </button>
    </div>
  `;

  document.body.appendChild(popup);

  // Add event listeners
  popup.querySelector('#success-btn')?.addEventListener('click', () => {
    this.resolveMyCustomPromise(fieldId, 'success', 'Sample result data');
    document.body.removeChild(popup);
  });

  popup.querySelector('#cancel-btn')?.addEventListener('click', () => {
    this.resolveMyCustomPromise(fieldId, 'cancelled');
    document.body.removeChild(popup);
  });

  popup.querySelector('#error-btn')?.addEventListener('click', () => {
    this.resolveMyCustomPromise(fieldId, 'error', undefined, 'Simulated error occurred');
    document.body.removeChild(popup);
  });
}

// 6. Add promise resolution method
private resolveMyCustomPromise(fieldId: string, status: 'success' | 'cancelled' | 'error', value?: string, message?: string): void {
  const promise = this.pendingMyCustomPromises.get(fieldId);
  if (promise) {
    this.pendingMyCustomPromises.delete(fieldId);

    if (status === 'success') {
      promise.resolve({
        fieldId,
        status: 'success',
        data: {
          type: 'mycustom',
          value: value || 'default-value',
          timestamp: new Date().toISOString()
        }
      });
    } else if (status === 'cancelled') {
      promise.reject({
        fieldId,
        status: 'cancelled',
        message: 'User cancelled the operation'
      });
    } else {
      promise.reject({
        fieldId,
        status: 'error',
        message: message || 'Operation failed'
      });
    }
  }
}
```

#### Step 5: Create the Question Renderer Component

**File:** `src/MyCustomQuestionRenderer.tsx` (formplayer project only)

Create the React component:

```typescript
import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
} from '@mui/material';
import {Build as MyCustomIcon, Delete as DeleteIcon} from '@mui/icons-material';
import {withJsonFormsControlProps} from '@jsonforms/react';
import {
  ControlProps,
  rankWith,
  schemaTypeIs,
  and,
  schemaMatches,
} from '@jsonforms/core';
import {FormulusClient} from './FormulusInterface';
import {MyCustomResult} from './webview/FormulusInterfaceDefinition';

// Tester function - determines when this renderer should be used
export const myCustomQuestionTester = rankWith(
  5, // Priority (higher = more specific)
  and(
    schemaTypeIs('string'), // Expects string data type
    schemaMatches(schema => schema.format === 'mycustom'), // Matches format
  ),
);

const MyCustomQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
  visible = true,
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Refs
  const formulusClient = useRef(new FormulusClient());

  // Extract field ID from path
  const fieldId = path.split('.').pop() || path;

  // Initialize manual input with current data
  useEffect(() => {
    if (data && typeof data === 'string') {
      setManualInput(data);
    }
  }, [data]);

  // Handle the main action (e.g., scanning, capturing, etc.)
  const handleMyCustomAction = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result: MyCustomResult =
        await formulusClient.current.requestMyCustom(fieldId);

      if (result.status === 'success' && result.data) {
        // Update form data with the result
        handleChange(path, result.data.value);
        setManualInput(result.data.value);
        setShowManualInput(false);
      }
    } catch (err: any) {
      if (err.status === 'cancelled') {
        // User cancelled - don't show error
        console.log('MyCustom action cancelled by user');
      } else if (err.status === 'error') {
        setError(err.message || 'MyCustom action failed');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  }, [fieldId, handleChange, path]);

  // Handle manual input changes
  const handleManualInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setManualInput(value);
      handleChange(path, value);
      setError(null);
    },
    [handleChange, path],
  );

  // Handle delete/clear
  const handleDelete = useCallback(() => {
    handleChange(path, '');
    setManualInput('');
    setShowManualInput(false);
    setError(null);
  }, [handleChange, path]);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  const hasData = data && typeof data === 'string' && data.length > 0;
  const hasError = errors && errors.length > 0;

  return (
    <Box sx={{mb: 2}}>
      {/* Title and Description */}
      {schema.title && (
        <Typography variant="subtitle1" sx={{mb: 1, fontWeight: 500}}>
          {schema.title}
        </Typography>
      )}
      {schema.description && (
        <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
          {schema.description}
        </Typography>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{mb: 2}}>
          {error}
        </Alert>
      )}

      {/* Validation Errors */}
      {hasError && (
        <Alert severity="error" sx={{mb: 2}}>
          {errors.join(', ')}
        </Alert>
      )}

      {/* Main Action Button */}
      <Box sx={{mb: 2}}>
        <Button
          variant="contained"
          startIcon={
            isLoading ? <CircularProgress size={20} /> : <MyCustomIcon />
          }
          onClick={handleMyCustomAction}
          disabled={!enabled || isLoading}
          fullWidth
          sx={{mb: 1}}>
          {isLoading ? 'Processing...' : 'Start MyCustom Action'}
        </Button>

        <Button
          variant="outlined"
          onClick={() => setShowManualInput(!showManualInput)}
          disabled={!enabled}
          fullWidth
          size="small">
          {showManualInput ? 'Hide Manual Input' : 'Enter Manually'}
        </Button>
      </Box>

      {/* Manual Input Section */}
      {showManualInput && (
        <Box sx={{mb: 2}}>
          <TextField
            label="Enter data manually"
            value={manualInput}
            onChange={handleManualInputChange}
            disabled={!enabled}
            fullWidth
            multiline
            rows={3}
            placeholder="Enter your data here..."
          />
        </Box>
      )}

      {/* Data Display */}
      {hasData && (
        <Paper sx={{p: 2, bgcolor: 'grey.50'}}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
            <Box sx={{flex: 1}}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{mb: 1}}>
                Current Data:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  bgcolor: 'white',
                  p: 1,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.300',
                }}>
                {data}
              </Typography>
            </Box>
            <IconButton
              onClick={handleDelete}
              disabled={!enabled}
              size="small"
              sx={{ml: 1}}>
              <DeleteIcon />
            </IconButton>
          </Box>
        </Paper>
      )}

      {/* Development Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{mt: 2, p: 1, bgcolor: 'info.light', borderRadius: 1}}>
          <Typography variant="caption" sx={{fontFamily: 'monospace'}}>
            Debug: fieldId="{fieldId}", path="{path}", format="mycustom"
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default withJsonFormsControlProps(MyCustomQuestionRenderer);
```

#### Step 6: Register the Renderer

**File:** `src/App.tsx` (formplayer project only)

Register the new renderer:

```typescript
// 1. Add import
import MyCustomQuestionRenderer, {
  myCustomQuestionTester,
} from './MyCustomQuestionRenderer';

// 2. Add to customRenderers array
const customRenderers = [
  ...materialRenderers,
  {tester: photoQuestionTester, renderer: PhotoQuestionRenderer},
  {tester: qrcodeQuestionTester, renderer: QrcodeQuestionRenderer},
  {tester: myCustomQuestionTester, renderer: MyCustomQuestionRenderer}, // Add this line
  {tester: swipeLayoutTester, renderer: SwipeLayoutRenderer},
  {tester: finalizeTester, renderer: FinalizeRenderer},
];
```

#### Step 7: Add AJV Format Validation

**File:** `src/App.tsx` (formplayer project only)

Add custom format validation:

```typescript
// Add after existing format validations
ajv.addFormat('mycustom', (data: any) => {
  // Allow null, undefined, or empty string (for optional fields)
  if (data === null || data === undefined || data === '') {
    return true;
  }

  // Validate the actual data format
  // Adjust this validation logic based on your data type requirements
  return typeof data === 'string';
});
```

#### Step 8: Update Sample Data (Optional)

**File:** `src/webview-mock.ts` (formplayer project only)

Add sample form data for testing:

```typescript
// In the sampleFormData object
const sampleFormData = {
  // ... existing fields
  myCustomField: "", // Add your field
};

// In the sampleUISchema
{
  "type": "Control",
  "scope": "#/properties/myCustomField"
}

// In the sampleSchema properties
"myCustomField": {
  "type": "string",
  "format": "mycustom",
  "title": "My Custom Field",
  "description": "Test your custom question type"
}
```

7. **React Native Handler**: `onRequestSignature` handler with modal integration
8. **Dependencies**: `react-native-signature-canvas` added to package.json

**Testing & Polish:**

- [ ] ✅ Add sample data to mock for testing
- [ ] ✅ Test success, cancel, and error scenarios
- [ ] ✅ Verify form validation works correctly
- [ ] ✅ Test in development browser environment
- [ ] ✅ Add proper error handling and user feedback
- [ ] ✅ Ensure accessibility compliance
- [ ] ✅ Add loading states and progress indicators

**Documentation:**

- [ ] ✅ Update this documentation with your question type
- [ ] ✅ Add usage examples and schema definitions
- [ ] ✅ Document any special configuration requirements

### Common Patterns and Tips

**Data Types:**

- Use `string` for simple text data (QR codes, barcodes, etc.)
- Use `object` for complex structured data (photos, audio with metadata)
- Always include a `timestamp` field for audit trails

**Error Handling:**

- Always handle `cancelled` status gracefully (don't show as error)
- Provide clear, actionable error messages
- Include fallback options when possible (manual input, retry, etc.)

**UI/UX Best Practices:**

- Use appropriate Material-UI icons for your action type
- Provide loading states during async operations
- Include manual input options as fallbacks
- Show clear data previews when data is captured
- Allow users to delete/retry actions

**Mock Implementation:**

- Create realistic simulation popups for testing
- Include multiple test scenarios (success, cancel, error)
- Use sample data that represents real-world usage
- Add delays to simulate real device operations

**Performance:**

- Minimize re-renders with proper `useCallback` usage
- Clean up resources and event listeners
- Optimize for mobile device constraints

### Development and Testing

**Mock Environment:**
The Formplayer includes a comprehensive mock environment for development:

- Interactive popups simulate native functionality
- Sample data generation for testing
- Debug information panels
- Hot reload support

**Testing Your Question Types:**

1. Start the development server: `npm start`
2. Open http://localhost:3000 in your browser
3. Use the mock popups to simulate user interactions
4. Check the browser console for debug information

### Integration with React Native

Question types that require native functionality (camera, QR scanner, etc.) communicate with the React Native host through the Formulus interface:

1. **Request Action**: Component calls `FormulusClient.requestXxx(fieldId)`
2. **Native Processing**: React Native handles the native functionality
3. **Result Delivery**: Native returns result via Promise resolution/rejection
4. **UI Update**: Component updates based on the result

### Error Handling

All question types should implement consistent error handling:

```typescript
try {
  const result = await formulusClient.current.requestXxx(fieldId);
  if (result.status === 'success') {
    // Handle success
    handleChange(path, result.data.value);
  }
} catch (err: any) {
  if (err.status === 'cancelled') {
    // User cancelled - don't show error
  } else if (err.status === 'error') {
    // Show error message
    setError(err.message || 'Operation failed');
  }
}
```

## Best Practices

1. **Consistent UI/UX**: Follow Material-UI design patterns
2. **Error Handling**: Provide clear error messages and recovery options
3. **Loading States**: Show loading indicators during async operations
4. **Validation**: Implement both client-side and schema validation
5. **Accessibility**: Ensure components are accessible to all users
6. **Performance**: Optimize for mobile devices and slower networks
7. **Testing**: Test thoroughly in both mock and native environments

## Troubleshooting

### Common Issues

**"Unknown format" AJV Error:**

- Ensure the custom format is registered with AJV in `App.tsx`
- Check that the format name matches exactly between schema and registration

**Component Not Rendering:**

- Verify the tester function is correctly implemented
- Check that the renderer is registered in the `customRenderers` array
- Ensure the schema format matches the tester conditions

**Native Integration Issues:**

- Check that the method is implemented in both interface definition files
- Verify the FormulusClient has the corresponding method
- Test with the mock implementation first

**Mock Not Working:**

- Ensure you're in development mode (`NODE_ENV=development`)
- Check that the mock method is implemented in `webview-mock.ts`
- Verify the mock is initialized in `App.tsx`

---

## Video Question Type

The video question type allows users to record videos using the device's camera functionality.

### Schema Configuration

```json
{
  "instructionalVideo": {
    "type": "string",
    "format": "video",
    "title": "Instructional Video",
    "description": "Record a video demonstration"
  }
}
```

### UI Schema Configuration

```json
{
  "instructionalVideo": {
    "ui:widget": "video",
    "ui:options": {
      "label": "Record Video",
      "maxDuration": 60,
      "quality": "high"
    }
  }
}
```

### Features

- **Video Recording**: Uses device camera to record videos
- **Video Playback**: Built-in video player with play/pause/stop controls
- **Duration Limit**: Configurable maximum recording duration (default 60 seconds)
- **Quality Settings**: High-quality video recording
- **File Metadata**: Displays duration, file size, format, and resolution
- **Re-record**: Allows users to record a new video
- **Delete**: Option to remove recorded video
- **Permission Handling**: Gracefully handles camera permission requests
- **Error Handling**: Shows appropriate messages for camera/recording errors

### Data Structure

The video question type stores video data as a JSON string containing:

```json
{
  "type": "video",
  "filename": "video_1701944200000.mp4",
  "uri": "file:///data/user/0/com.app/files/videos/video_1701944200000.mp4",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "metadata": {
    "duration": 45.2,
    "format": "mp4",
    "size": 15728640,
    "width": 1920,
    "height": 1080
  }
}
```

### Dependencies

- **React Native**: Uses react-native-image-picker for video recording
- **Permissions**: Requires camera permissions on the device
- **Storage**: Uses react-native-fs for file management
- **Camera Hardware**: Requires device with camera capability

### Usage Example

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "trainingVideo": {
        "type": "string",
        "format": "video",
        "title": "Training Video",
        "description": "Record a video showing the proper procedure"
      },
      "testimonial": {
        "type": "string",
        "format": "video",
        "title": "Customer Testimonial",
        "description": "Record a brief testimonial video"
      }
    },
    "required": ["trainingVideo"]
  },
  "uiSchema": {
    "trainingVideo": {
      "ui:widget": "video",
      "ui:options": {
        "label": "Record Training Video",
        "maxDuration": 120
      }
    },
    "testimonial": {
      "ui:widget": "video",
      "ui:options": {
        "label": "Record Testimonial",
        "maxDuration": 30
      }
    }
  }
}
```

### Implementation

The video question type is implemented using:

1. **VideoQuestionRenderer**: React component for video recording and playback UI
2. **FormulusClient.requestVideo()**: Client-side video request method
3. **react-native-image-picker**: React Native library for camera access and video recording
4. **react-native-fs**: File system access for video storage
5. **Mock Support**: Development environment simulation with interactive popups

The component provides a comprehensive interface for video recording with built-in playback controls, detailed metadata display, and user-friendly error handling. Videos are stored locally on the device and referenced by URI to avoid memory issues with large video files.
