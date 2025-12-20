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
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Grid,
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PlayArrow as ResumeIcon,
  Schedule as ClockIcon,
  Description as FormIcon,
} from '@mui/icons-material';
import { draftService, DraftSummary } from './DraftService';

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

export const DraftSelector: React.FC<DraftSelectorProps> = ({
  formType,
  formVersion,
  onResumeDraft,
  onStartNew,
  onClose,
  fullScreen = false,
}) => {
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
    const diffDays = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'recent';
    if (diffDays < 3) return 'old';
    return 'very-old';
  };

  const content = (
    <Box sx={{ p: fullScreen ? 3 : 0 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Resume Draft or Start New
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Form: {formType}
          {formVersion && <Chip label={`v${formVersion}`} size="small" sx={{ ml: 1 }} />}
        </Typography>
      </Box>

      {/* Cleanup message */}
      {cleanupMessage && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {cleanupMessage}
        </Alert>
      )}

      {/* Drafts list */}
      {drafts.length > 0 ? (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Available Drafts ({drafts.length})
          </Typography>
          <Grid container spacing={2}>
            {drafts.map((draft) => (
              <Grid item xs={12} key={draft.id}>
                <Card
                  variant="outlined"
                  sx={{
                    position: 'relative',
                    '&:hover': {
                      boxShadow: 2,
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <FormIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography variant="subtitle1">
                            Draft from {formatDate(draft.updatedAt)}
                          </Typography>
                          <Chip
                            icon={<ClockIcon />}
                            label={getDraftAge(draft.updatedAt)}
                            size="small"
                            color={
                              getDraftAge(draft.updatedAt) === 'recent'
                                ? 'success'
                                : getDraftAge(draft.updatedAt) === 'old'
                                ? 'warning'
                                : 'error'
                            }
                            sx={{ ml: 1 }}
                          />
                        </Box>

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {draft.dataPreview}
                        </Typography>

                        <Typography variant="caption" color="text.secondary">
                          Created: {draft.createdAt.toLocaleDateString()}{' '}
                          {draft.createdAt.toLocaleTimeString()}
                          {draft.observationId && (
                            <> • Editing observation: {draft.observationId}</>
                          )}
                        </Typography>
                      </Box>

                      <IconButton
                        onClick={() => handleDeleteDraft(draft.id)}
                        size="small"
                        color="error"
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ pt: 0 }}>
                    <Button
                      startIcon={<ResumeIcon />}
                      onClick={() => onResumeDraft(draft.id)}
                      variant="contained"
                      size="small"
                    >
                      Resume Draft
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4, mb: 3 }}>
          <Typography variant="body1" color="text.secondary">
            No recent drafts found for this form.
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Start new form section */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Start Fresh
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Begin a new form without any saved data.
        </Typography>
        <Button variant="outlined" size="large" onClick={onStartNew} sx={{ minWidth: 200 }}>
          Start New Form
        </Button>
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Draft</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this draft? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteDraft} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
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
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Select Draft</Typography>
            {onClose && <Button onClick={onClose}>Close</Button>}
          </Box>
        </DialogTitle>
        <DialogContent>{content}</DialogContent>
      </Dialog>
    );
  }

  return content;
};

export default DraftSelector;
