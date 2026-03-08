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
import { alpha } from '@mui/material/styles';
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

// Container style required
const CONFIRM_CARD_RADIUS = 0.7;
const CONFIRM_INNER_RADIUS = 0.7;
const CONFIRM_BORDER_WIDTH = 1;
const CONFIRM_CARD_PADDING = 16;
const CONTAINER_ALPHA = 0.4;

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

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else {
      return 'Just now';
    }
  };

  const getDraftAge = (date: Date): 'recent' | 'old' | 'very-old' => {
    const diffDays = Math.floor(
      (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 1) return 'recent';
    if (diffDays < 3) return 'old';
    return 'very-old';
  };

  const content = (
    <Box
      sx={{
        minHeight: fullScreen ? '100dvh' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: fullScreen ? 3 : 0,
        py: fullScreen ? 4 : 0,
        bgcolor: 'background.default',
        color: 'text.primary',
      }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
          textAlign: 'center',
        }}>
        {/* Header – theme-aware */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom color="text.primary">
            Resume Draft or Start New
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Form: {formType}
            {formVersion && (
              <Chip label={`v${formVersion}`} size="small" sx={{ ml: 1 }} />
            )}
          </Typography>
        </Box>

        {/* Cleanup message */}
        {cleanupMessage && (
          <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
            {cleanupMessage}
          </Alert>
        )}

        {/* Available drafts – same outer + inner container style as Missing required fields dialog */}
        {drafts.length > 0 ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              mb: 3,
            }}>
            <Box
              sx={{
                width: '100%',
                maxWidth: 340,
                borderRadius: CONFIRM_CARD_RADIUS,
                border: `${CONFIRM_BORDER_WIDTH}px solid`,
                borderColor: 'divider',
                padding: `${CONFIRM_CARD_PADDING}px`,
                backgroundColor: alpha(
                  theme.palette.background.paper,
                  CONTAINER_ALPHA,
                ),
                overflow: 'hidden',
              }}>
              <Box
                sx={{
                  borderRadius: CONFIRM_INNER_RADIUS,
                  padding: `${CONFIRM_CARD_PADDING}px`,
                  backgroundColor: theme.palette.background.paper,
                  overflow: 'hidden',
                }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, textAlign: 'center', mb: 1.5 }}>
                  Available Drafts ({drafts.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {drafts.map((draft, index) => {
                    const age = getDraftAge(draft.updatedAt);
                    const chipColor =
                      age === 'recent'
                        ? 'primary'
                        : age === 'old'
                          ? 'warning'
                          : 'error';

                    return (
                      <Box key={draft.id}>
                        {index > 0 && (
                          <Divider sx={{ my: 1.5, borderColor: 'divider' }} />
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: 1,
                          }}>
                          <Typography variant="subtitle1" color="text.primary">
                            Draft from {formatDate(draft.updatedAt)}
                          </Typography>
                          <Chip
                            icon={<ClockIcon />}
                            label={age}
                            size="small"
                            color={chipColor}
                            sx={
                              age === 'recent'
                                ? {
                                    mt: 0.5,
                                    bgcolor: theme.palette.primary.main,
                                    color: theme.palette.primary.contrastText,
                                  }
                                : { mt: 0.5 }
                            }
                          />

                          <IconButton
                            onClick={() => handleDeleteDraft(draft.id)}
                            size="small"
                            color="error"
                            sx={{ mt: 0.25 }}>
                            <DeleteIcon />
                          </IconButton>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}>
                            {draft.dataPreview}
                          </Typography>

                          <Typography variant="caption" color="text.secondary">
                            Created: {draft.createdAt.toLocaleDateString()}{' '}
                            {draft.createdAt.toLocaleTimeString()}
                            {draft.observationId && (
                              <> • Editing observation: {draft.observationId}</>
                            )}
                          </Typography>

                          <Button
                            variant="neutral"
                            size="medium"
                            onPress={() => onResumeDraft(draft.id)}>
                            Resume Draft
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4, mb: 3 }}>
            <Typography variant="body1" color="text.secondary">
              No recent drafts found for this form.
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Start new form section – theme-aware */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom color="text.primary">
            Start Fresh
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Begin a new form without any saved data.
          </Typography>
          <Button
            variant="primary"
            size="large"
            onPress={onStartNew}
            style={{ minWidth: 200 }}>
            Start New Form
          </Button>
        </Box>

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
          },
        }}>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <Typography variant="h6" color="text.primary">
            Select Draft
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: 'background.default' }}>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
};

export default DraftSelector;
