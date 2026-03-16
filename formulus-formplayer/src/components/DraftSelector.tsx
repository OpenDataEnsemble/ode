/**
 * DraftSelector.tsx
 *
 * Component for displaying and managing form drafts.
 * Shows available drafts for a form type and allows resuming or deleting them.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Divider,
  useTheme,
} from '@mui/material';
import { Button } from '@ode/components/react-web';
import {
  Delete as DeleteIcon,
  Schedule as ClockIcon,
} from '@mui/icons-material';
import { draftService, DraftSummary } from '../services/DraftService';

interface DraftSelectorProps {
  /** The form type to show drafts for */
  formType: string;
  /** Optional form version for compatibility filtering */
  formVersion?: string;
  /** Called when user selects a draft to resume */
  onResumeDraft: (draftId: string) => void;
  /** Called when user chooses to start a new form */
  onStartNew: () => void;
  /** Called when the component should be closed */
  onClose?: () => void;
  /** Whether to show as a full-screen dialog */
  fullScreen?: boolean;
}

// Container style – matched with other confirm UIs (no semi-transparent overlay)
const CONFIRM_CARD_RADIUS = 0.7;
const CONFIRM_BORDER_WIDTH = 1;
const CONFIRM_CARD_PADDING = 16;

export const DraftSelector: React.FC<DraftSelectorProps> = ({
  formType,
  formVersion,
  onResumeDraft,
  onStartNew,
  onClose,
  fullScreen = false,
}) => {
  const theme = useTheme();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  // We keep this for internal logic if needed later, but we no longer show a verbose message.
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Load drafts on component mount and when formType changes
  const loadDrafts = useCallback(() => {
    const formDrafts = draftService.getDraftsForForm(formType, formVersion);
    setDrafts(formDrafts);

    // Check for old drafts and show cleanup message
    const oldDraftCount = draftService.getOldDraftCount();
    if (oldDraftCount > 0) {
      setCleanupMessage(
        `${oldDraftCount} draft${
          oldDraftCount === 1 ? '' : 's'
        } older than 7 days will be automatically removed.`,
      );
    }
  }, [formType, formVersion]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDrafts();
  }, [loadDrafts]);

  const handleDeleteDraft = (draftId: string) => {
    setDraftToDelete(draftId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteDraft = () => {
    if (draftToDelete) {
      const success = draftService.deleteDraft(draftToDelete);
      if (success) {
        loadDrafts(); // Refresh the list
      }
    }
    setDeleteConfirmOpen(false);
    setDraftToDelete(null);
  };

  const formatDate = (date: Date): string =>
    date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const draftsSection =
    drafts.length > 0 ? (
      <Box
        sx={{
          width: '100%',
          mt: 1,
        }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: 0.75, textAlign: 'left' }}>
          Recent drafts ({drafts.length})
        </Typography>
        <Box
          sx={{
            borderRadius: CONFIRM_CARD_RADIUS,
            border: `${CONFIRM_BORDER_WIDTH}px solid`,
            borderColor: 'divider',
            backgroundColor: theme.palette.background.paper,
            overflow: 'hidden',
          }}>
          {drafts.map((draft, index) => (
            <Box
              key={draft.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 1,
                borderTop:
                  index === 0 ? 'none' : `1px solid ${theme.palette.divider}`,
              }}>
              <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                <Typography
                  variant="body2"
                  color="text.primary"
                  noWrap
                  sx={{ textAlign: 'left' }}>
                  Draft saved {formatDate(draft.updatedAt)}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexShrink: 0,
                }}>
                <Button
                  variant="neutral"
                  size="small"
                  onPress={() => onResumeDraft(draft.id)}>
                  Resume
                </Button>
                <IconButton
                  onClick={() => handleDeleteDraft(draft.id)}
                  size="small"
                  color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    ) : (
      <Box sx={{ textAlign: 'left', py: 2, mt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          No recent drafts found for this form.
        </Typography>
      </Box>
    );

  const content = (
    <Box
      sx={{
        minHeight: fullScreen ? '100dvh' : 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        px: fullScreen ? 2 : 0,
        py: fullScreen ? 2.5 : 2,
        bgcolor: 'background.default',
        color: 'text.primary',
      }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
        }}>
        {/* Header – left-aligned text with tighter spacing */}
        <Box
          sx={{
            mt: 2,
            mb: 1.5,
          }}>
          <Typography
            variant="h6"
            gutterBottom
            color="text.primary"
            sx={{ fontWeight: 600, textAlign: 'left', mb: 0.5 }}>
            Resume Draft or Start New
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: 'left' }}>
            Form: {formType}
            {formVersion && (
              <Chip label={`v${formVersion}`} size="small" sx={{ ml: 1 }} />
            )}
          </Typography>
        </Box>

        {/* Start new form section – concise, left-aligned label with centered CTA */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="subtitle2"
            gutterBottom
            color="text.primary"
            sx={{ fontWeight: 600, textAlign: 'left' }}>
            New Form
          </Typography>
          <Box sx={{ textAlign: 'center', mt: 0.5 }}>
            <Button
              variant="primary"
              size="medium"
              onPress={onStartNew}
              style={{ minWidth: 180 }}>
              Start New Form
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Available drafts – compact list below primary action */}
        {draftsSection}

        {/* Delete confirmation dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}>
          <DialogTitle>Delete Draft</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete this draft? This action cannot be
              undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="neutral"
              onPress={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onPress={confirmDeleteDraft}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );

  if (fullScreen) {
    return (
      <Dialog
        open={true}
        onClose={onClose}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'background.default',
            backgroundImage: 'none',
            color: 'text.primary',
            borderRadius: 0,
            margin: 0,
          },
        }}>
        <DialogContent
          sx={{
            bgcolor: 'background.default',
            p: 0,
            m: 0,
          }}>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
};

export default DraftSelector;
