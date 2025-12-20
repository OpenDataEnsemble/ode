// Type definitions for WebView message handlers
// Must match the injected interface in FormulusInterfaceDefinition.ts
import {Observation} from '../database/models/Observation';
import {
  FormInitData,
  FormCompletionResult,
  FormInfo,
} from './FormulusInterfaceDefinition';

export interface FormulusMessageHandlers {
  onInitForm?: (payload: any) => void; // Keep existing, adjust payload type as needed
  /**
   * Handles the 'getVersion' request from the WebView.
   * This function should return a Promise that resolves with the API version string.
   */
  onGetVersion?: () => Promise<string>;
  onSubmitObservation?: (data: {
    formType: string;
    finalData: Record<string, any>;
  }) => void;
  onUpdateObservation?: (data: {
    observationId: string;
    formType: string;
    finalData: Record<string, any>;
  }) => void;
  onRequestCamera?: (fieldId: string) => void;
  onRequestQrcode?: (fieldId: string) => void;
  onRequestLocation?: (fieldId: string) => void;
  onRequestFile?: (fieldId: string) => void;
  onLaunchIntent?: (fieldId: string, intentSpec: Record<string, any>) => void;
  onCallSubform?: (
    fieldId: string,
    formId: string,
    options: Record<string, any>,
  ) => void;
  onRequestAudio?: (fieldId: string) => void;
  onRequestVideo?: (fieldId: string) => void;
  onRequestSignature?: (fieldId: string) => void;
  onRequestBiometric?: (fieldId: string) => void;
  onRequestConnectivityStatus?: () => void;
  onRequestSyncStatus?: () => void;
  onRunLocalModel?: (
    fieldId: string,
    modelId: string,
    input: Record<string, any>,
  ) => void;
  // New handlers to be added
  onGetAvailableForms?: () => Promise<FormInfo[]>;
  onGetObservations?: (
    formId: string,
    isDraft?: boolean,
    includeDeleted?: boolean,
  ) => Promise<Observation[]>;
  onOpenFormplayer?: (data: FormInitData) => Promise<FormCompletionResult>;
  // Called when the Formplayer WebView signals that it has completed initialization
  // via a `formplayerInitialized` message. Primarily used for logging/diagnostics.
  onFormplayerInitialized?: (data: {
    formType?: string;
    status?: string;
  }) => void;
  onFormulusReady?: () => void; // Handler for when the WebView signals it's ready
  onReceiveFocus?: () => void; // Handler for when the WebView signals it's ready
  onUnknownMessage?: (message: any) => void;
  onError?: (error: Error) => void;
  // Add other handlers here as your API grows
}
